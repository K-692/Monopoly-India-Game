/**
 * Board-centre dice area: the dice are the roll control, the active player's name sits above the ping,
 * and Sell to Bank is available for the whole turn (before and after rolling).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameState, RoomMember } from '../domain/game-types';
import { createInitialGame } from '../domain/game-engine/create-initial-game';
import { GameBoard } from '../components/board/GameBoard';

const members: Record<string, RoomMember> = {
  user_1: { uid: 'user_1', displayName: 'Player 1', photoURL: null, isReady: true, colorToken: '#EF4444', joinedAt: 1 },
  user_2: { uid: 'user_2', displayName: 'Player 2', photoURL: null, isReady: true, colorToken: '#3B82F6', joinedAt: 2 },
};

function stateWithOwnedCity(phase: GameState['phase']): GameState {
  const state = createInitialGame('room_1', 'game_1', members, undefined, 'user_1', { forcedPlayerOrder: ['user_1', 'user_2'] });
  state.phase = phase;
  state.properties[1] = { ...state.properties[1], ownerUid: 'user_1', ownershipState: 'OWNED' };
  return state;
}

function renderBoard(state: GameState, onRollDice = vi.fn()) {
  render(
    <GameBoard
      gameState={state}
      selectedSpaceIndex={null}
      onSelectSpace={vi.fn()}
      isRolling={false}
      onRollDice={onRollDice}
      onDispatch={vi.fn()}
      isMyTurn={state.currentPlayerUid === 'user_1'}
      userUid="user_1"
    />
  );
  return onRollDice;
}

describe('Dice area controls', () => {
  it('has no ROLL DICE button or status texts, and clicking the dice rolls', () => {
    const onRoll = renderBoard(stateWithOwnedCity('AWAIT_ROLL'));
    expect(screen.queryByText('ROLL DICE')).toBeNull();
    expect(screen.queryByText(/Rolled:/)).toBeNull();
    expect(screen.queryByText('Your Turn')).toBeNull();
    fireEvent.click(screen.getByTestId('board-dice-container'));
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('shows whose turn it is above the ping', () => {
    renderBoard(stateWithOwnedCity('AWAIT_ROLL'));
    expect(screen.getByTestId('board-turn-label')).toHaveTextContent('Turn: Player 1');
  });

  it.each(['AWAIT_ROLL', 'JAIL_DECISION', 'MANAGEMENT', 'TURN_END'] as const)(
    'offers Sell to Bank during %s',
    (phase) => {
      renderBoard(stateWithOwnedCity(phase));
      expect(screen.getByTestId('sell-to-bank-btn')).toBeInTheDocument();
    }
  );

  it('hides Sell to Bank on another player’s turn', () => {
    const state = stateWithOwnedCity('AWAIT_ROLL');
    state.currentPlayerUid = 'user_2';
    renderBoard(state);
    expect(screen.queryByTestId('sell-to-bank-btn')).toBeNull();
    expect(screen.getByTestId('board-turn-label')).toHaveTextContent('Turn: Player 2');
  });

  it('keeps a fixed-height controls row in every phase and never shows the stepping text', () => {
    for (const phase of ['AWAIT_ROLL', 'JAIL_DECISION', 'MANAGEMENT', 'TURN_END', 'PROPERTY_DECISION'] as const) {
      const state = stateWithOwnedCity(phase);
      state.movement = { playerId: 'user_1', startPos: 0, targetPos: 5, steps: 5, startedAt: Date.now(), endsAt: Date.now() + 5000, durationMs: 5000, isComplete: phase === 'AWAIT_ROLL' };
      const { unmount } = render(
        <GameBoard
          gameState={state}
          selectedSpaceIndex={null}
          onSelectSpace={vi.fn()}
          isRolling={false}
          onDispatch={vi.fn()}
          isMyTurn
          userUid="user_1"
        />
      );
      const row = screen.getByTestId('board-controls-row');
      expect(row.className).toContain('h-[84px]');
      expect(row.className).toContain('shrink-0');
      expect(screen.queryByText(/Stepping along lane/)).toBeNull();
      unmount();
    }
  });
});
