import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../components/ui/Header';
import { PlayPage } from '../features/play/PlayPage';
import { GameBoard } from '../components/board/GameBoard';
import { BoardSpaceTile } from '../components/board/BoardSpaceTile';
import { PlayerStrip } from '../components/player/PlayerStrip';
import { RoomManager } from '../../server/rooms/room-manager';
import { RoomMember } from '../domain/game-types';
import { DEFAULT_HOST_RULES } from '../domain/ruleset';
import { BOARD_SPACES } from '../domain/board-config';
import { createInitialGame } from '../domain/game-engine/create-initial-game';

vi.mock('../services/socket/socket-client', () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onRoomState: vi.fn(),
    onPlayerAction: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    emitPlayerAction: vi.fn(),
  },
}));

describe('Settings Popup, Board Visual Enhancements, and UI Refinements', () => {
  beforeEach(() => {
    localStorage.clear();
    // Mock global fetch for LAN info endpoint
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ip: '192.168.1.100', port: 4173 }),
    } as unknown as Response);
  });

  describe('1. Global Settings Popup Dialog', () => {
    it('renders Settings button in the Header and opens SettingsModal on click', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      const settingsBtn = screen.getByTestId('header-settings-button');
      expect(settingsBtn).toBeInTheDocument();

      // Modal is not visible initially
      expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();

      // Click to open Settings popup
      fireEvent.click(settingsBtn);

      const modal = screen.getByTestId('settings-modal');
      expect(modal).toBeInTheDocument();
      expect(screen.getByText('Game Settings & Preferences')).toBeInTheDocument();

      // Close via close button
      const closeBtn = screen.getByTestId('close-settings-modal-button');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
      });
    });

    it('closes SettingsModal when Escape key is pressed', async () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('header-settings-button'));
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('2. Landing Page Rules (?) Button', () => {
    it('renders Rules (?) button on landing PlayPage and opens RulesModal', async () => {
      render(
        <MemoryRouter>
          <PlayPage />
        </MemoryRouter>
      );

      const rulesBtn = screen.getByTestId('landing-rules-button');
      expect(rulesBtn).toBeInTheDocument();

      // Click to open Rules modal
      fireEvent.click(rulesBtn);

      expect(screen.getByTestId('rules-modal-overlay')).toBeInTheDocument();
      expect(screen.getByText('Official Rulebook & Strategy Reference')).toBeInTheDocument();
    });
  });

  describe('3. Default CPU Naming Format (CPU1, CPU2, CPU3...) without space', () => {
    it('generates CPU1, CPU2, CPU3 names by default in RoomManager', async () => {
      const rm = new RoomManager();
      const hostSession = rm.registerPlayer('HostPlayer');
      const createRes = await rm.createRoom(hostSession.uid, DEFAULT_HOST_RULES);
      expect(createRes.ok).toBe(true);
      const room = createRes.room!;

      const res1 = rm.addCpu(room.roomId, hostSession.uid);
      expect(res1.ok).toBe(true);
      expect(res1.cpuMember?.displayName).toBe('CPU1');

      const res2 = rm.addCpu(room.roomId, hostSession.uid);
      expect(res2.ok).toBe(true);
      expect(res2.cpuMember?.displayName).toBe('CPU2');

      const res3 = rm.addCpu(room.roomId, hostSession.uid);
      expect(res3.ok).toBe(true);
      expect(res3.cpuMember?.displayName).toBe('CPU3');
    });
  });

  describe('4. Central Board Wave Animation and Corner Tile Styling', () => {
    it('verifies central board has clean plain background without decorative wave layers or watermark', () => {
      const mockMembers: Record<string, RoomMember> = {
        p1: {
          uid: 'p1',
          displayName: 'Player 1',
          photoURL: null,
          isReady: true,
          joinedAt: 1,
          colorToken: '#3B82F6',
          isCpu: false,
          playerType: 'HUMAN',
        },
        p2: {
          uid: 'p2',
          displayName: 'CPU1',
          photoURL: null,
          isReady: true,
          joinedAt: 2,
          colorToken: '#EF4444',
          isCpu: true,
          playerType: 'COMPUTER',
        },
      };

      const gameState = createInitialGame('r1', 'g1', mockMembers);

      render(
        <GameBoard
          gameState={gameState}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          userUid="p1"
          onRollDice={vi.fn()}
        />
      );

      expect(screen.queryByTestId('central-board-wave-layer')).not.toBeInTheDocument();
      expect(screen.getByTestId('board-dice-container')).toBeInTheDocument();
    });

    it('matches REST and GO TO JAIL tile background to START tile', () => {
      const startSpace = BOARD_SPACES[0]; // START
      const restSpace = BOARD_SPACES[20]; // REST
      const goToJailSpace = BOARD_SPACES[30]; // GO TO JAIL

      const { container: startContainer } = render(
        <BoardSpaceTile
          space={startSpace}
          playersHere={[]}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );
      const startTile = startContainer.firstChild as HTMLElement;
      expect(startTile.className).toContain('bg-indian-parchment-100');
      expect(startTile.className).toContain('animate-start-glow');

      const { container: restContainer } = render(
        <BoardSpaceTile
          space={restSpace}
          playersHere={[]}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );
      const restTile = restContainer.firstChild as HTMLElement;
      expect(restTile.className).toContain('bg-indian-parchment-100');

      const { container: jailContainer } = render(
        <BoardSpaceTile
          space={goToJailSpace}
          playersHere={[]}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );
      const jailTile = jailContainer.firstChild as HTMLElement;
      expect(jailTile.className).toContain('bg-indian-parchment-100');
    });
  });

  describe('5. Spacing in Left Panel Keyboard Shortcuts Reference', () => {
    it('has bottom margin spacing applied to prevent touching screen edge', () => {
      const mockMembers: Record<string, RoomMember> = {
        p1: {
          uid: 'p1',
          displayName: 'Player 1',
          photoURL: null,
          isReady: true,
          joinedAt: 1,
          colorToken: '#3B82F6',
          isCpu: false,
          playerType: 'HUMAN',
        },
        p2: {
          uid: 'p2',
          displayName: 'CPU1',
          photoURL: null,
          isReady: true,
          joinedAt: 2,
          colorToken: '#EF4444',
          isCpu: true,
          playerType: 'COMPUTER',
        },
      };

      const gameState = createInitialGame('r1', 'g1', mockMembers);

      render(
        <PlayerStrip
          players={gameState.players}
          currentPlayerUid="p1"
          properties={gameState.properties}
        />
      );

      const shortcutRef = screen.getByTestId('keyboard-shortcuts-reference');
      expect(shortcutRef).toBeInTheDocument();
      expect(shortcutRef.className).toContain('mb-2');
      expect(shortcutRef.className).toContain('pb-0.5');
    });
  });
});
