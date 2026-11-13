import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GamePage } from '@/features/game/GamePage';
import { useGameStore } from '@/features/game/use-game-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { formatGameTimer, DEFAULT_HOST_RULES } from '@/domain/ruleset';
import { GameState, RoomMember } from '@/domain/game-types';
import { createInitialGame } from '@/domain/game-engine/create-initial-game';
import { GameManager } from '../../server/game/game-manager';
import { ServerRoom } from '../../server/types/server-types';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('Authoritative Total Game Elapsed Timer (MM:SS) Feature', () => {
  describe('formatGameTimer formatting logic', () => {
    it('starts at 00:00 for 0 seconds', () => {
      expect(formatGameTimer(0)).toBe('00:00');
    });

    it('formats single-digit seconds with leading zero', () => {
      expect(formatGameTimer(5)).toBe('00:05');
      expect(formatGameTimer(9)).toBe('00:09');
    });

    it('formats multi-digit seconds correctly', () => {
      expect(formatGameTimer(45)).toBe('00:45');
      expect(formatGameTimer(59)).toBe('00:59');
    });

    it('formats minutes and seconds accurately across boundary', () => {
      expect(formatGameTimer(60)).toBe('01:00');
      expect(formatGameTimer(65)).toBe('01:05');
      expect(formatGameTimer(599)).toBe('09:59');
      expect(formatGameTimer(600)).toBe('10:00');
    });

    it('formats extended gameplay durations > 59 minutes gracefully', () => {
      expect(formatGameTimer(3599)).toBe('59:59');
      expect(formatGameTimer(3600)).toBe('60:00');
      expect(formatGameTimer(3665)).toBe('61:05');
      expect(formatGameTimer(7200)).toBe('120:00');
    });

    it('handles negative, non-finite, and floating point inputs cleanly', () => {
      expect(formatGameTimer(-10)).toBe('00:00');
      expect(formatGameTimer(NaN)).toBe('00:00');
      expect(formatGameTimer(Infinity)).toBe('00:00');
      expect(formatGameTimer(15.9)).toBe('00:15');
    });
  });

  describe('GamePage UI integration and timer rendering', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      useAuthStore.setState({
        player: { uid: 'user_human', displayName: 'Aarav', avatarColor: '#dc2626' },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const createMockState = (overrides?: Partial<GameState>): GameState => {
      const now = 1000000;
      const mockMembers: Record<string, RoomMember> = {
        user_human: {
          uid: 'user_human',
          displayName: 'Aarav',
          colorToken: '#dc2626',
          isReady: true,
          isCpu: false,
          playerType: 'HUMAN',
          photoURL: '',
          joinedAt: now,
        },
        user_cpu: {
          uid: 'user_cpu',
          displayName: 'CPU 1',
          colorToken: '#2563eb',
          isReady: true,
          isCpu: true,
          playerType: 'COMPUTER',
          photoURL: '',
          joinedAt: now,
        },
      };

      const base = createInitialGame('room_1', 'game_1', mockMembers, undefined, 'user_human');
      return {
        ...base,
        startedAt: now,
        totalGameTimeSeconds: 0,
        ...overrides,
      };
    };

    it('renders the game timer at the exact center of the top header bar with data-testid="game-timer"', () => {
      const state = createMockState();
      useGameStore.setState({
        gameState: state,
      });

      render(
        <MemoryRouter>
          <GamePage />
        </MemoryRouter>
      );

      const timerElement = screen.getByTestId('game-timer');
      expect(timerElement).toBeDefined();
      expect(timerElement.textContent).toBe('00:00');

      // Verify centered positioning classes
      expect(timerElement.className).toContain('absolute');
      expect(timerElement.className).toContain('left-1/2');
      expect(timerElement.className).toContain('-translate-x-1/2');
      expect(timerElement.className).toContain('font-mono');
    });

    it('smoothly increments actual seconds from 00:00 onward as time elapses', () => {
      const startTime = 1000000;
      vi.setSystemTime(startTime);

      const state = createMockState({ startedAt: startTime });
      useGameStore.setState({
        gameState: state,
      });

      render(
        <MemoryRouter>
          <GamePage />
        </MemoryRouter>
      );

      const timerElement = screen.getByTestId('game-timer');
      expect(timerElement.textContent).toBe('00:00');

      // Advance by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(timerElement.textContent).toBe('00:05');

      // Advance by another 60 seconds (1 minute 5 seconds total)
      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(timerElement.textContent).toBe('01:05');
    });

    it('synchronizes smoothly with server-provided totalGameTimeSeconds update in store', () => {
      const startTime = 1000000;
      vi.setSystemTime(startTime);

      const state = createMockState({ startedAt: startTime });
      useGameStore.setState({
        gameState: state,
      });

      render(
        <MemoryRouter>
          <GamePage />
        </MemoryRouter>
      );

      const timerElement = screen.getByTestId('game-timer');
      expect(timerElement.textContent).toBe('00:00');

      // Server broadcasts timer update with authoritative elapsed seconds = 125
      act(() => {
        useGameStore.setState({
          gameState: {
            ...useGameStore.getState().gameState!,
            totalGameTimeSeconds: 125,
          },
        });
      });

      expect(timerElement.textContent).toBe('02:05');
    });

    it('freezes timer at final completed duration when game status is COMPLETED', () => {
      const startTime = 1000000;
      const completedTime = startTime + 342000; // 342 seconds = 05:42
      vi.setSystemTime(completedTime + 50000); // Current wall-clock is well past game end

      const state = createMockState({
        startedAt: startTime,
        completedAt: completedTime,
        status: 'COMPLETED',
        winnerUid: 'user_human',
        totalGameTimeSeconds: 342,
      });

      useGameStore.setState({
        gameState: state,
      });

      render(
        <MemoryRouter>
          <GamePage />
        </MemoryRouter>
      );

      const timerElement = screen.getByTestId('game-timer');
      // Freezes at 342 seconds (05:42) despite system time advancing
      expect(timerElement.textContent).toBe('05:42');

      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(timerElement.textContent).toBe('05:42');
    });
  });

  describe('Server GameManager authoritative elapsedSeconds broadcasting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calculates and includes elapsedSeconds in game:timer broadcasts on interval ticks', () => {
      const gameManager = new GameManager();
      const broadcastEvents: Array<{ event: string; data: unknown }> = [];

      gameManager.setBroadcastCallback((_roomId, event, data) => {
        broadcastEvents.push({ event, data });
      });

      const mockMembers: Record<string, RoomMember> = {
        host_1: {
          uid: 'host_1',
          displayName: 'Host',
          colorToken: '#dc2626',
          isReady: true,
          isCpu: false,
          playerType: 'HUMAN',
          photoURL: '',
          joinedAt: 1000000,
        },
        cpu_1: {
          uid: 'cpu_1',
          displayName: 'CPU',
          colorToken: '#2563eb',
          isReady: true,
          isCpu: true,
          playerType: 'COMPUTER',
          photoURL: '',
          joinedAt: 1000000,
        },
      };

      const mockRoom: ServerRoom = {
        roomId: 'room_timer_test',
        hostUid: 'host_1',
        inviteCode: 'TEST01',
        inviteCodeHash: 'hash_test01',
        members: mockMembers,
        memberUids: Object.keys(mockMembers),
        customRules: DEFAULT_HOST_RULES,
        status: 'LOBBY',
        maxPlayers: 6,
        turnTimerSeconds: 30,
        gameMode: 'STANDARD',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const startResult = gameManager.startGame(mockRoom, 'host_1');
      expect(startResult.ok).toBe(true);
      expect(startResult.gameState).toBeDefined();
      expect(startResult.gameState?.totalGameTimeSeconds).toBe(0);

      // Advance by 1 second to trigger the turn timer tick
      vi.advanceTimersByTime(1000);

      // Find game:timer events broadcasted
      const timerEvents = broadcastEvents.filter((e) => e.event === 'game:timer');
      expect(timerEvents.length).toBeGreaterThan(0);

      const firstTimer = timerEvents[0].data as { elapsedSeconds?: number };
      expect(typeof firstTimer.elapsedSeconds).toBe('number');
      expect(firstTimer.elapsedSeconds).toBeGreaterThanOrEqual(1);

      // Verify that totalGameTimeSeconds is also assigned to state
      expect(typeof startResult.gameState?.totalGameTimeSeconds).toBe('number');

      // Cleanup game manager timers
      gameManager.stopTurnTimer(startResult.gameId!);
    });
  });
});
