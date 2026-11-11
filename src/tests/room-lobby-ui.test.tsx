/**
 * Unit & Component Tests for CreateRoomRulesModal and 6-Slot Waiting Lobby UI
 *
 * Verifies:
 * 1. CreateRoomRulesModal renders without CPU controls or max player selector.
 * 2. CreateRoomRulesModal submits with fixed maxPlayers: 6.
 * 3. Lobby renders 6 fixed player slots with distinct readiness indicators (text & icons).
 * 4. Host has Add CPU, inline rename, and remove controls for CPUs.
 * 5. Non-host does not have CPU management controls.
 * 6. Dynamic explanation banner explains start blocker (e.g. unready human players or < 2 players).
 * 7. Start Game button enabled only when host + all humans are ready and >= 2 players.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateRoomRulesModal } from '@/components/rooms/CreateRoomRulesModal';
import { LobbyPage } from '@/features/rooms/LobbyPage';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { RoomState } from '@/domain/game-types';
import { DEFAULT_HOST_RULES } from '@/domain/ruleset';

describe('CreateRoomRulesModal UI Simplification', () => {
  it('renders starting cash, salary, and timer without CPU configuration or max player buttons', () => {
    const handleCreate = vi.fn();
    const handleClose = vi.fn();

    render(
      <CreateRoomRulesModal
        isOpen={true}
        onClose={handleClose}
        onCreate={handleCreate}
      />
    );

    // Verify modal title
    expect(screen.getByText('Create Room Settings')).toBeDefined();

    // Verify Starting Cash slider exists
    expect(screen.getByLabelText(/Starting Cash Slider/i)).toBeDefined();

    // Verify Start Crossing Money exists
    expect(screen.getByText(/Start Crossing Money/i)).toBeDefined();

    // Verify Turn Timer Limit exists
    expect(screen.getByText(/Turn Timer Limit/i)).toBeDefined();

    // Verify NO "Computer Players", "Add CPU", or "Maximum Players" buttons exist in modal
    expect(screen.queryByText(/Computer Players/i)).toBeNull();
    expect(screen.queryByText(/Add CPU/i)).toBeNull();
    expect(screen.queryByText(/Maximum Players/i)).toBeNull();
    expect(screen.queryByText(/4 Players/i)).toBeNull();
    expect(screen.queryByText(/6 Players/i)).toBeNull();
  });

  it('submits with fixed 6 maximum player capacity', () => {
    const handleCreate = vi.fn();
    const handleClose = vi.fn();

    render(
      <CreateRoomRulesModal
        isOpen={true}
        onClose={handleClose}
        onCreate={handleCreate}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Create Room/i });
    fireEvent.click(submitBtn);

    expect(handleCreate).toHaveBeenCalledTimes(1);
    const submittedRules = handleCreate.mock.calls[0][0];
    expect(submittedRules.maxPlayers).toBe(6);
    expect(submittedRules.startingCash).toBeGreaterThanOrEqual(5000);
  });
});

describe('LobbyPage 6-Slot Grid, Readiness & Host CPU Controls UI', () => {
  const mockHostUser = {
    uid: 'user_host_1',
    displayName: 'Aarav (Host)',
    avatarColor: '#C85A32',
  };

  const createMockRoom = (overrides?: Partial<RoomState>): RoomState => {
    const base: RoomState = {
      roomId: 'room_test_123',
      hostUid: 'user_host_1',
      inviteCode: 'TEST99',
      inviteCodeHash: 'hash_test_99',
      status: 'LOBBY',
      maxPlayers: 6,
      turnTimerSeconds: 30,
      gameMode: 'STANDARD',
      members: {
        user_host_1: {
          uid: 'user_host_1',
          displayName: 'Aarav (Host)',
          colorToken: '#C85A32',
          photoURL: null,
          isReady: false,
          isCpu: false,
          playerType: 'HUMAN',
          joinedAt: Date.now(),
        },
        cpu_1: {
          uid: 'cpu_1',
          displayName: 'CPU 1',
          colorToken: '#1A2B4C',
          photoURL: null,
          isReady: true,
          isCpu: true,
          playerType: 'COMPUTER',
          joinedAt: Date.now() + 1,
        },
      },
      memberUids: ['user_host_1', 'cpu_1'],
      customRules: { ...DEFAULT_HOST_RULES, maxPlayers: 6 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };
    return { ...base, ...overrides };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      player: mockHostUser,
      reconnectToken: 'token_123',
      isAuthInitialized: true,
      isNamePromptOpen: false,
    });
  });

  it('renders 6 fixed slots showing occupied members and open slots', () => {
    const mockRoom = createMockRoom();
    useRoomStore.setState({
      currentRoom: mockRoom,
      isLoading: false,
      error: null,
      subscribeToRoom: vi.fn().mockReturnValue(() => {}),
    });

    render(
      <MemoryRouter initialEntries={['/room/room_test_123']}>
        <LobbyPage />
      </MemoryRouter>
    );

    // Verify room slot summary displays 2 / 6
    expect(screen.getByText(/Room Slots \(2 \/ 6\)/i)).toBeDefined();

    // Verify occupied slots
    expect(screen.getByText('Aarav (Host)')).toBeDefined();
    expect(screen.getByText('CPU 1')).toBeDefined();

    // Verify 4 remaining available slots (Slot 3, Slot 4, Slot 5, Slot 6)
    expect(screen.getByText(/Slot 3: Available/i)).toBeDefined();
    expect(screen.getByText(/Slot 4: Available/i)).toBeDefined();
    expect(screen.getByText(/Slot 5: Available/i)).toBeDefined();
    expect(screen.getByText(/Slot 6: Available/i)).toBeDefined();
  });

  it('shows distinct readiness indicators and disables start when host is not ready', () => {
    const mockRoom = createMockRoom();
    useRoomStore.setState({
      currentRoom: mockRoom,
      isLoading: false,
      error: null,
      subscribeToRoom: vi.fn().mockReturnValue(() => {}),
    });

    render(
      <MemoryRouter initialEntries={['/room/room_test_123']}>
        <LobbyPage />
      </MemoryRouter>
    );

    // Aarav (Host) is not ready
    expect(screen.getByText('Not Ready')).toBeDefined();
    // CPU 1 is auto ready
    expect(screen.getByText('Ready')).toBeDefined();

    // Dynamic explanation banner for unready host
    expect(
      screen.getByText(/Waiting for You \(Host\) to get ready/i)
    ).toBeDefined();

    // Start Game button should be disabled
    const startBtn = screen.getByRole('button', { name: /Start Game/i });
    expect(startBtn).toHaveProperty('disabled', true);
  });

  it('allows host to toggle ready state and start game when ready', () => {
    const mockToggleReady = vi.fn().mockResolvedValue(true);
    const mockStartGame = vi.fn().mockResolvedValue({ ok: true, gameId: 'game_1' });

    const mockRoom = createMockRoom({
      members: {
        user_host_1: {
          uid: 'user_host_1',
          displayName: 'Aarav (Host)',
          colorToken: '#C85A32',
          photoURL: null,
          isReady: true, // Host is ready!
          isCpu: false,
          playerType: 'HUMAN',
          joinedAt: Date.now(),
        },
        cpu_1: {
          uid: 'cpu_1',
          displayName: 'CPU 1',
          colorToken: '#1A2B4C',
          photoURL: null,
          isReady: true,
          isCpu: true,
          playerType: 'COMPUTER',
          joinedAt: Date.now() + 1,
        },
      },
    });

    useRoomStore.setState({
      currentRoom: mockRoom,
      isLoading: false,
      error: null,
      toggleReady: mockToggleReady,
      startGame: mockStartGame,
      subscribeToRoom: vi.fn().mockReturnValue(() => {}),
    });

    render(
      <MemoryRouter initialEntries={['/room/room_test_123']}>
        <LobbyPage />
      </MemoryRouter>
    );

    // Both Host and CPU are ready -> Start Game is enabled
    const startBtn = screen.getByRole('button', { name: /Start Game/i });
    expect(startBtn).toHaveProperty('disabled', false);

    fireEvent.click(startBtn);
    expect(mockStartGame).toHaveBeenCalledWith('room_test_123');

    // Toggle ready button for host should say "Set to Not Ready"
    const toggleReadyBtn = screen.getByRole('button', { name: /Set to Not Ready/i });
    fireEvent.click(toggleReadyBtn);
    expect(mockToggleReady).toHaveBeenCalledWith('room_test_123', false);
  });

  it('provides host with Add CPU, inline rename, and remove CPU controls', async () => {
    const mockAddCpu = vi.fn().mockResolvedValue({ ok: true });
    const mockRemoveCpu = vi.fn().mockResolvedValue({ ok: true });
    const mockRenameCpu = vi.fn().mockResolvedValue({ ok: true });

    const mockRoom = createMockRoom();

    useRoomStore.setState({
      currentRoom: mockRoom,
      isLoading: false,
      error: null,
      addCpu: mockAddCpu,
      removeCpu: mockRemoveCpu,
      renameCpu: mockRenameCpu,
      subscribeToRoom: vi.fn().mockReturnValue(() => {}),
    });

    render(
      <MemoryRouter initialEntries={['/room/room_test_123']}>
        <LobbyPage />
      </MemoryRouter>
    );

    // The "Room Slots" section header does not contain an Add CPU button on its right side
    const roomSlotsHeading = screen.getByText(/Room Slots \(2 \/ 6\)/i).closest('div');
    expect(roomSlotsHeading?.querySelector('button')).toBeNull();

    // Host can click "Add CPU" button in available slot cards
    const addCpuBtns = screen.getAllByRole('button', { name: /Add CPU/i });
    expect(addCpuBtns.length).toBeGreaterThan(0);
    fireEvent.click(addCpuBtns[0]);
    expect(mockAddCpu).toHaveBeenCalledTimes(1);

    // Host can click Rename CPU button (pencil)
    const renameBtn = screen.getByTitle('Rename CPU');
    fireEvent.click(renameBtn);

    // Inline input field appears
    const input = screen.getByPlaceholderText('CPU Name');
    expect(input).toBeDefined();
    fireEvent.change(input, { target: { value: 'Vikram AI' } });

    // Save rename
    const saveBtn = screen.getByTitle('Save Name');
    fireEvent.click(saveBtn);
    expect(mockRenameCpu).toHaveBeenCalledWith('cpu_1', 'Vikram AI');

    // Host can click Remove CPU button (trash) after rename finishes
    const removeBtn = await screen.findByTitle('Remove CPU');
    fireEvent.click(removeBtn);
    expect(mockRemoveCpu).toHaveBeenCalledWith('cpu_1');
  });

  it('hides CPU management controls from non-host players', () => {
    const nonHostUser = {
      uid: 'user_guest_2',
      displayName: 'Diya (Guest)',
      avatarColor: '#2D6A4F',
    };

    useAuthStore.setState({
      player: nonHostUser,
    });

    const mockRoom = createMockRoom({
      members: {
        user_host_1: {
          uid: 'user_host_1',
          displayName: 'Aarav (Host)',
          colorToken: '#C85A32',
          photoURL: null,
          isReady: true,
          isCpu: false,
          playerType: 'HUMAN',
          joinedAt: Date.now(),
        },
        user_guest_2: {
          uid: 'user_guest_2',
          displayName: 'Diya (Guest)',
          colorToken: '#2D6A4F',
          photoURL: null,
          isReady: false,
          isCpu: false,
          playerType: 'HUMAN',
          joinedAt: Date.now() + 1,
        },
      },
    });

    useRoomStore.setState({
      currentRoom: mockRoom,
      isLoading: false,
      error: null,
      subscribeToRoom: vi.fn().mockReturnValue(() => {}),
    });

    render(
      <MemoryRouter initialEntries={['/room/room_test_123']}>
        <LobbyPage />
      </MemoryRouter>
    );

    // Non-host should NOT see Add CPU buttons
    expect(screen.queryByRole('button', { name: /Add CPU/i })).toBeNull();

    // Non-host should NOT see Start Game button
    expect(screen.queryByRole('button', { name: /Start Game/i })).toBeNull();
    expect(
      screen.getByText(/Waiting for host to start match once all players are ready/i)
    ).toBeDefined();

    // Guest has their own "Ready Up" button
    const readyUpBtn = screen.getByRole('button', { name: /Ready Up/i });
    expect(readyUpBtn).toBeDefined();
  });
});
