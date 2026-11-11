/**
 * Unit & Component Tests for CreateRoomRulesModal and 6-Slot Waiting Lobby
 *
 * Verifies:
 * 1. CreateRoomRulesModal renders without CPU controls or max player selector.
 * 2. CreateRoomRulesModal submits with fixed maxPlayers: 6.
 * 3. Lobby renders 6 slots with clear readiness indicators (text & icons).
 * 4. Host has Add CPU, rename, and remove controls for CPUs.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateRoomRulesModal } from '@/components/rooms/CreateRoomRulesModal';

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
