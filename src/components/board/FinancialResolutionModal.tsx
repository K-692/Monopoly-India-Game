import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GameActionType, PendingFinancialObligation, PlayerState, PropertyState } from '@/domain/game-types';
import { BOARD_SPACES } from '@/domain/board-config';
import { calculateMortgageValue } from '@/domain/ruleset';
import { AlertCircle, Landmark, Building2, Home, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface FinancialResolutionModalProps {
  obligation: PendingFinancialObligation;
  players: PlayerState[];
  properties: Record<number, PropertyState>;
  currentUserUid: string;
  onDispatch?: (type: GameActionType, payload?: Record<string, unknown>) => void;
}

export const FinancialResolutionModal: React.FC<FinancialResolutionModalProps> = ({
  obligation,
  players,
  properties,
  currentUserUid,
  onDispatch,
}) => {
  const [showConfirmSurrender, setShowConfirmSurrender] = useState(false);

  const debtor = players.find((p) => p.uid === obligation.debtorUid);
  const creditor = players.find((p) => p.uid === obligation.creditorUid);

  const isDebtor = currentUserUid === obligation.debtorUid;
  const currentCash = debtor?.cash ?? 0;
  const amountDue = obligation.amountDue;
  const remainingNeeded = Math.max(0, amountDue - currentCash);
  const canPayDebt = currentCash >= amountDue;

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

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-fade-in">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-[#090D1A] border-2 border-red-500/80 shadow-[0_16px_48px_rgba(0,0,0,0.95)] text-white overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
      >
        {/* Urgent Header */}
        <div className="p-4 bg-gradient-to-r from-red-950 via-[#180A0A] to-[#1F1010] border-b border-red-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/30 border border-red-500/60 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-black text-sm sm:text-base tracking-wide text-red-300 uppercase">
                Financial Resolution Required
              </h3>
              <span className="text-[11px] text-gray-300">
                Insufficient liquid balance to fulfill financial obligation
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">Amount Due</span>
            <span className="font-mono font-black text-base sm:text-lg text-red-400">
              ₹{amountDue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Spectator View (Non-debtor players) */}
        {!isDebtor && (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-base text-gray-100">
                {debtor?.displayName || 'Debtor'} is resolving debts
              </h4>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {debtor?.displayName || 'Player'} owes <strong className="text-red-400">₹{amountDue.toLocaleString('en-IN')}</strong> to {creditor?.displayName || 'Bank/Creditor'}. The match is paused while properties are mortgaged or surrender is chosen.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 inline-block font-mono">
              Debtor Liquid Cash: ₹{currentCash.toLocaleString('en-IN')} / ₹{amountDue.toLocaleString('en-IN')}
            </div>
          </div>
        )}

        {/* Active Debtor View */}
        {isDebtor && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar text-xs">
            {/* Financial Balance Summary Card */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-gray-400 block font-medium">Debt Obligation</span>
                <span className="font-mono font-black text-sm sm:text-base text-red-400">
                  ₹{amountDue.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-gray-400 block font-medium">Current Liquid Cash</span>
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
                  {canPayDebt ? 'Payment Status' : 'Remaining Needed'}
                </span>
                <span className="font-mono font-black text-sm sm:text-base">
                  {canPayDebt ? 'READY TO SETTLE' : `₹${remainingNeeded.toLocaleString('en-IN')}`}
                </span>
              </div>
            </div>

            {/* Instruction Notice */}
            <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-200 text-[11px] leading-relaxed">
              {canPayDebt ? (
                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  You now have sufficient funds! Click &quot;Pay Outstanding Debt&quot; below to complete payment.
                </span>
              ) : (
                <span>
                  Mortgage your eligible properties below to raise liquid cash. Once your balance reaches <strong>₹{amountDue.toLocaleString('en-IN')}</strong>, you can settle your debt.
                </span>
              )}
            </div>

            {/* Eligible Properties List */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="font-bold text-[11px] uppercase tracking-wider text-gray-400">
                  Mortgageable Properties ({eligibleProperties.length})
                </span>
                <span className="text-[10px] text-gray-500">
                  50% Base + Development Investment
                </span>
              </div>

              {eligibleProperties.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/5 border border-dashed border-white/10 text-center text-gray-400 text-xs">
                  No further properties available to mortgage. If you cannot settle the debt, you must surrender.
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {eligibleProperties.map(({ spaceIndex, space, prop, mortgageVal }) => (
                    <div
                      key={spaceIndex}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/40 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                          <Landmark className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs block truncate text-white">
                            {space.name}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
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

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[9px] text-gray-400 block">Payout</span>
                          <span className="font-mono font-bold text-xs text-amber-300">
                            +₹{mortgageVal.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDispatch?.('MORTGAGE', { spaceIndex })}
                          className="px-3 py-1.5 rounded-lg font-bold text-[11px] bg-amber-500 hover:bg-amber-400 text-indian-navy-950 active:scale-95 transition-all shadow-md cursor-pointer"
                        >
                          Mortgage
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Surrender Confirmation Box */}
            {showConfirmSurrender && (
              <div className="p-3 rounded-xl bg-red-950/80 border-2 border-red-500 text-white space-y-2 animate-scale-in">
                <div className="flex items-center gap-1.5 text-red-300 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Confirm Surrender / Give Up?</span>
                </div>
                <p className="text-[11px] text-gray-200 leading-snug">
                  All your remaining cash (<strong>₹{currentCash.toLocaleString('en-IN')}</strong>) will be transferred to <strong>{creditor?.displayName || 'the creditor'}</strong>. You will be disqualified and your properties will be marked as BLOCKED.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowConfirmSurrender(false)}
                    className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => onDispatch?.('GIVE_UP')}
                    className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-md cursor-pointer"
                  >
                    Confirm Surrender
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Action Bar (Only for Debtor) */}
        {isDebtor && !showConfirmSurrender && (
          <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowConfirmSurrender(true)}
              className="px-3 py-2 rounded-xl font-bold text-xs bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 transition-colors cursor-pointer"
            >
              Give Up / Surrender
            </button>

            <button
              type="button"
              disabled={!canPayDebt}
              onClick={() => onDispatch?.('RESOLVE_OBLIGATION')}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg',
                canPayDebt
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white active:scale-95 cursor-pointer ring-2 ring-emerald-400/50'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
              )}
            >
              <span>{canPayDebt ? 'Pay Outstanding Debt' : `Need ₹${remainingNeeded.toLocaleString('en-IN')} More`}</span>
              {canPayDebt && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
