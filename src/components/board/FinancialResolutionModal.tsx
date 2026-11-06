import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GameActionType, PendingFinancialObligation, PlayerState, PropertyState } from '@/domain/game-types';
import { BOARD_SPACES } from '@/domain/board-config';
import { calculateMortgageValue } from '@/domain/ruleset';
import { Landmark, Building2, Home, CheckCircle2, ShieldAlert, ArrowRight, Clock, AlertTriangle, CheckSquare, Square, Eye } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface FinancialResolutionModalProps {
  obligation: PendingFinancialObligation;
  players: PlayerState[];
  properties: Record<number, PropertyState>;
  currentUserUid: string;
  turnTimeRemaining?: number;
  onDispatch?: (type: GameActionType, payload?: Record<string, unknown>) => void;
}

export const FinancialResolutionModal: React.FC<FinancialResolutionModalProps> = ({
  obligation,
  players,
  properties,
  currentUserUid,
  turnTimeRemaining,
  onDispatch,
}) => {
  const [showConfirmSurrender, setShowConfirmSurrender] = useState(false);
  const [isAdjustingPayouts, setIsAdjustingPayouts] = useState(false);
  const [isCheckingBoard, setIsCheckingBoard] = useState(false);
  const [selectedSpaceIndices, setSelectedSpaceIndices] = useState<number[]>([]);

  const debtor = players.find((p) => p.uid === obligation.debtorUid);
  const creditor = players.find((p) => p.uid === obligation.creditorUid);

  const isDebtor = currentUserUid === obligation.debtorUid;
  const currentCash = debtor?.cash ?? 0;
  const amountDue = obligation.amountDue;
  const remainingNeeded = Math.max(0, amountDue - currentCash);
  const canPayDebt = currentCash >= amountDue;

  // Authoritative 120-second synchronized countdown derived from obligation.expiresAt
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (obligation.expiresAt) {
      return Math.max(0, Math.ceil((obligation.expiresAt - Date.now()) / 1000));
    }
    return turnTimeRemaining ?? 120;
  });

  useEffect(() => {
    if (!obligation.expiresAt) {
      if (turnTimeRemaining !== undefined) setTimeLeft(turnTimeRemaining);
      return;
    }
    const updateCountdown = () => {
      const left = Math.max(0, Math.ceil((obligation.expiresAt - Date.now()) / 1000));
      setTimeLeft(left);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 500);
    return () => clearInterval(interval);
  }, [obligation.expiresAt, turnTimeRemaining]);

  // Eligible properties owned by debtor that are not already mortgaged or blocked
  const eligibleProperties = Object.entries(properties)
    .filter(([_, prop]) => prop.ownerUid === obligation.debtorUid && !prop.isMortgaged && prop.ownershipState !== 'BLOCKED')
    .map(([idx, prop]) => {
      const spaceIndex = Number(idx);
      const space = BOARD_SPACES[spaceIndex];
      const mortgageVal = calculateMortgageValue(spaceIndex, prop);
      return {
        spaceIndex,
        space,
        prop,
        mortgageVal,
      };
    });

  // Calculate dynamic totals for selected properties in Adjust Payouts mode
  const totalSelectedPayout = selectedSpaceIndices.reduce((sum, idx) => {
    const item = eligibleProperties.find((p) => p.spaceIndex === idx);
    return sum + (item?.mortgageVal || 0);
  }, 0);

  const projectedCash = currentCash + totalSelectedPayout;
  const remainingAfterMortgage = Math.max(0, amountDue - projectedCash);
  const willCoverDebt = projectedCash >= amountDue;

  const togglePropertySelection = (spaceIndex: number) => {
    setSelectedSpaceIndices((prev) =>
      prev.includes(spaceIndex) ? prev.filter((i) => i !== spaceIndex) : [...prev, spaceIndex]
    );
  };

  const selectAllEligible = () => {
    setSelectedSpaceIndices(eligibleProperties.map((p) => p.spaceIndex));
  };

  const deselectAll = () => {
    setSelectedSpaceIndices([]);
  };

  const handleConfirmMortgages = () => {
    if (selectedSpaceIndices.length === 0) return;
    onDispatch?.('MORTGAGE', { spaceIndices: selectedSpaceIndices });
    setSelectedSpaceIndices([]);
    setIsAdjustingPayouts(false);
  };

  // =========================================================================
  // SPECTATOR VIEW (Non-Debtor Players): Compact floating card at bottom-left
  // =========================================================================
  if (!isDebtor) {
    if (typeof document === 'undefined') return null;
    return createPortal(
      <div className="fixed bottom-4 left-4 z-[120] max-w-sm w-[92vw] sm:w-96 select-none animate-slide-up pointer-events-auto">
        <div className="rounded-2xl bg-[#090D1A]/95 border-2 border-amber-500/70 shadow-[0_12px_36px_rgba(0,0,0,0.85)] text-white overflow-hidden backdrop-blur-md">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-gradient-to-r from-amber-950 via-[#180A0A] to-[#1F1010] border-b border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Landmark className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="font-serif font-black text-xs tracking-wide text-amber-300 uppercase">
                  Low-Balance Resolution
                </h4>
                <span className="text-[10px] text-gray-300 block">
                  Debt resolution in progress (Sell to Bank)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-gray-400 block uppercase font-bold">Debt Due</span>
              <span className="font-mono font-black text-xs text-red-400">
                ₹{amountDue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="p-3 space-y-2 text-xs">
            <p className="text-gray-300 text-[11px] leading-snug">
              <strong className="text-amber-300">{debtor?.displayName || 'Player'}</strong> is resolving a debt of <strong className="text-red-400">₹{amountDue.toLocaleString('en-IN')}</strong> to {creditor?.displayName || 'Bank'}.
            </p>

            <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono">
              <span className="text-gray-400">Debtor Liquid Cash:</span>
              <span className="font-bold text-emerald-400">
                ₹{currentCash.toLocaleString('en-IN')} / ₹{amountDue.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((currentCash / Math.max(1, amountDue)) * 100))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5">
              <span className="flex items-center gap-1 text-amber-300">
                <Clock className="w-3 h-3" />
                <span>60s Window</span>
              </span>
              <span className={cn(
                'font-mono font-bold',
                timeLeft <= 15 ? 'text-red-400 animate-pulse' : 'text-amber-300'
              )}>
                {timeLeft}s remaining
              </span>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // =========================================================================
  // ACTIVE DEBTOR VIEW: Center Interactive Low-Balance Mortgage Resolution Modal
  // =========================================================================
  if (typeof document === 'undefined') return null;

  // Requirement 2: Read-Only Board Inspection Mode
  if (isCheckingBoard) {
    return createPortal(
      <>
        {/* Full-screen click-capture layer: intercepts any click on the board to return to modal & blocks interaction */}
        <div
          onClick={() => setIsCheckingBoard(false)}
          className="fixed inset-0 z-[110] bg-black/25 backdrop-blur-[1px] cursor-pointer select-none"
          title="Click anywhere to return to mortgage resolution"
        />

        {/* Top Floating Inspection Banner */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[115] w-[94vw] max-w-md select-none animate-slide-down pointer-events-auto"
        >
          <div className="rounded-2xl bg-[#090D1A]/95 border-2 border-blue-500/80 shadow-[0_12px_36px_rgba(0,0,0,0.9)] p-3 text-white backdrop-blur-md space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Eye className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-serif font-black text-xs tracking-wide text-blue-300 uppercase">
                    Board Inspection Mode
                  </h4>
                  <span className="text-[10px] text-gray-400 block">Read-only view</span>
                </div>
              </div>
              <div className={cn(
                'flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded border',
                timeLeft <= 15
                  ? 'bg-red-950/90 text-red-300 border-red-500 animate-pulse'
                  : 'bg-amber-950/80 text-amber-300 border-amber-600/50'
              )}>
                <Clock className="w-3 h-3" />
                <span>{timeLeft}s remaining</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-300 leading-snug">
              Inspect the board and token positions. Click anywhere on the board or click the button below to resume your decisions.
            </p>

            <button
              type="button"
              onClick={() => setIsCheckingBoard(false)}
              className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-indian-navy-950 shadow-md flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] active:scale-95 transition-all"
            >
              <span>Return to Debt Resolution</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-fade-in">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-[#090D1A] border-2 border-red-500/80 shadow-[0_16px_48px_rgba(0,0,0,0.95)] text-white overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
      >
        {/* Urgent Header */}
        <div className="p-4 bg-gradient-to-r from-red-950 via-[#180A0A] to-[#1F1010] border-b border-red-500/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-600/30 border border-red-500/60 flex items-center justify-center text-red-400 shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif font-black text-sm sm:text-base tracking-wide text-red-300 uppercase truncate">
                Low-Balance Financial Resolution
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] text-gray-300 truncate">
                  {obligation.reason || 'Outstanding debt payment'}
                </span>
                <span className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border',
                  timeLeft <= 15
                    ? 'bg-red-950/90 text-red-300 border-red-500 animate-pulse'
                    : 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                )}>
                  <Clock className="w-3 h-3" />
                  <span>{timeLeft}s countdown</span>
                </span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">Owed</span>
            <span className="font-mono font-black text-base sm:text-lg text-red-400">
              ₹{amountDue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar text-xs">
          {/* Section 1 & 2: Financial Situation Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-gray-400 block font-medium">Amount Owed</span>
              <span className="font-mono font-black text-sm sm:text-base text-red-400">
                ₹{amountDue.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-gray-400 block font-medium">Current Balance</span>
              <span className="font-mono font-black text-sm sm:text-base text-emerald-400">
                ₹{currentCash.toLocaleString('en-IN')}
              </span>
            </div>
            <div className={cn(
              'p-2.5 rounded-xl border',
              canPayDebt
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
            )}>
              <span className="text-[10px] block font-medium">
                {canPayDebt ? 'Status' : 'Remaining Required'}
              </span>
              <span className="font-mono font-black text-sm sm:text-base">
                {canPayDebt ? 'SUFFICIENT' : `₹${remainingNeeded.toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-200 text-[11px] leading-relaxed">
            {canPayDebt ? (
              <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                You now have sufficient funds! Settling debt will resume normal gameplay immediately.
              </span>
            ) : (
              <span>
                You have insufficient available balance. You have an additional <strong>120-second window</strong> to <strong>Adjust Payouts</strong> by selling eligible properties to the bank or <strong>Surrender</strong>. At 0 seconds, unresolved debt triggers automatic disqualification and immediate game end.
              </span>
            )}
          </div>

          {/* Sell Properties to Bank Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="font-bold text-[11px] uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-amber-400" />
                Sell Properties to Bank ({eligibleProperties.length})
              </span>
              <span className="text-[10px] text-gray-400">
                50% Base + Development Value
              </span>
            </div>

            {eligibleProperties.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/5 border border-dashed border-white/10 text-center text-gray-400 text-xs space-y-1">
                <p className="font-bold text-gray-300">No properties eligible to sell to bank.</p>
                <p className="text-[11px]">You may choose Surrender below, or wait for the 120-second countdown to expire.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {eligibleProperties.map(({ spaceIndex, space, prop, mortgageVal }) => {
                  const isSelected = selectedSpaceIndices.includes(spaceIndex);
                  return (
                    <div
                      key={spaceIndex}
                      onClick={() => isAdjustingPayouts && togglePropertySelection(spaceIndex)}
                      className={cn(
                        'p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5',
                        isAdjustingPayouts
                          ? 'cursor-pointer hover:bg-white/10'
                          : 'bg-white/5 border-white/10',
                        isSelected
                          ? 'bg-amber-950/40 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                          : 'border-white/10'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isAdjustingPayouts && (
                          <div className="text-amber-400 shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                        )}
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                          <Landmark className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs block truncate text-white">
                            {space.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                            {prop.buildings === 5 ? (
                              <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                                <Building2 className="w-3 h-3" /> Tower
                              </span>
                            ) : prop.buildings > 0 ? (
                              <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                                <Home className="w-3 h-3" /> {prop.buildings} House{prop.buildings > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span>Undeveloped</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[9px] text-gray-400 block">Sale Payout</span>
                        <span className="font-mono font-bold text-xs text-amber-300">
                          +₹{mortgageVal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2 & 3: Adjust Payouts Selection Controls & Dynamic Calculations */}
          {isAdjustingPayouts && eligibleProperties.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-amber-300">
                  Selected: {selectedSpaceIndices.length} / {eligibleProperties.length} Properties
                </span>
                <div className="flex items-center gap-2 text-[10.5px]">
                  <button
                    type="button"
                    onClick={selectAllEligible}
                    className="text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-gray-500">|</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-gray-400 hover:text-gray-300 underline font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Dynamic Projection Bar */}
              <div className="grid grid-cols-2 gap-2 text-center p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono">
                <div>
                  <span className="text-gray-400 text-[10px] block">Total to be Raised</span>
                  <span className="font-bold text-amber-300 text-xs">
                    +₹{totalSelectedPayout.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block">Remaining After Sale</span>
                  <span className={cn(
                    'font-bold text-xs',
                    willCoverDebt ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {willCoverDebt ? '₹0 (RESOLVED)' : `₹${remainingAfterMortgage.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>

              {willCoverDebt ? (
                <div className="text-[10.5px] text-emerald-300 flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Sufficient funds reached! Original payment will automatically complete upon confirmation.</span>
                </div>
              ) : (
                <div className="text-[10.5px] text-amber-300/90 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Remaining funds will still be required before the 120s timer expires.</span>
                </div>
              )}

              {/* Confirm Selected Sales Button */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustingPayouts(false);
                    setSelectedSpaceIndices([]);
                  }}
                  className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCheckingBoard(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-700 text-xs font-bold transition-colors cursor-pointer min-h-[44px] flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Check Board</span>
                </button>
                <button
                  type="button"
                  disabled={selectedSpaceIndices.length === 0}
                  onClick={handleConfirmMortgages}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer shadow-md',
                    selectedSpaceIndices.length > 0
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-indian-navy-950 active:scale-95'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  )}
                >
                  <span>Confirm Selected Sales ({selectedSpaceIndices.length}) (+₹{totalSelectedPayout.toLocaleString('en-IN')})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Surrender Confirmation Dialog Box */}
          {showConfirmSurrender && (
            <div className="p-3.5 rounded-xl bg-red-950/90 border-2 border-red-500 text-white space-y-2.5 animate-scale-in">
              <div className="flex items-center gap-2 text-red-300 font-bold text-xs sm:text-sm">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Confirm Voluntary Surrender / Disqualification</span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-200 leading-snug">
                Surrendering will disqualify you and immediately end the match. The player with the highest balance will win. All your properties will be marked as <strong>BLOCKED</strong>.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmSurrender(false)}
                  className="px-3.5 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onDispatch?.('GIVE_UP')}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer min-h-[44px]"
                >
                  Confirm Surrender
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Three Primary Action Buttons (Surrender, Adjust Payouts, and Check Board) */}
        {!showConfirmSurrender && !isAdjustingPayouts && (
          <div className="p-3.5 bg-black/40 border-t border-white/10 flex items-center justify-between gap-2.5">
            {/* Button 1: Surrender */}
            <button
              type="button"
              onClick={() => setShowConfirmSurrender(true)}
              className="flex-1 py-2.5 px-2.5 rounded-xl font-bold text-xs bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Surrender</span>
            </button>

            {/* Button 2: Adjust Payouts */}
            <button
              type="button"
              disabled={eligibleProperties.length === 0}
              onClick={() => setIsAdjustingPayouts(true)}
              className={cn(
                'flex-1 py-2.5 px-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 min-h-[44px] shadow-lg',
                eligibleProperties.length > 0
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-indian-navy-950 active:scale-95 cursor-pointer'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
              )}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Adjust Payouts</span>
            </button>

            {/* Button 3: Check Board */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCheckingBoard(true);
              }}
              className="flex-1 py-2.5 px-2.5 rounded-xl font-bold text-xs bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-700 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Check Board</span>
            </button>
          </div>
        )}

        {/* If user somehow already has sufficient funds, provide instant settle option */}
        {canPayDebt && !showConfirmSurrender && !isAdjustingPayouts && (
          <div className="px-3.5 pb-3">
            <button
              type="button"
              onClick={() => onDispatch?.('RESOLVE_OBLIGATION')}
              className="w-full py-2.5 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <span>Complete Payment (₹{amountDue.toLocaleString('en-IN')})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
