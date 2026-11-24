import React, { useState } from 'react';
import {
  HostCustomRules,
  DEFAULT_HOST_RULES,
  STARTING_CASH_MIN,
  STARTING_CASH_MAX,
  STARTING_CASH_STEP,
  STARTING_CASH_DEFAULT,
  PASS_START_REWARD_OPTIONS,
} from '@/domain/ruleset';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { X, Sliders, IndianRupee, ShieldCheck } from 'lucide-react';

interface CreateRoomRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (rules: HostCustomRules) => void;
  isLoading?: boolean;
}

export const CreateRoomRulesModal: React.FC<CreateRoomRulesModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading,
}) => {
  // Maximum room capacity is fixed at 6 slots (Requirement 1)
  const [rules, setRules] = useState<HostCustomRules>({
    ...DEFAULT_HOST_RULES,
    maxPlayers: 6,
    startingCash: STARTING_CASH_DEFAULT,
    passStartReward: 3000,
    jailBail: 500,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      ...rules,
      maxPlayers: 6,
      startingCash: rules.startingCash,
      passStartReward: rules.passStartReward,
      jailBail: 500,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <Card className="max-w-lg w-full p-6 border-2 border-indian-terracotta-500 shadow-2xl bg-white dark:bg-indian-navy-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-indian-parchment-300 dark:border-indian-navy-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indian-terracotta-100 text-indian-terracotta-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-black text-lg text-indian-navy-900 dark:text-white leading-tight">
                Create Room Settings
              </h3>
              <p className="text-[11px] text-gray-500">
                Configure starting cash, salary, and turn timers for your 6-player room
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-lg cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Starting Cash Slider */}
          <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-xl border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="starting-cash-slider"
                className="font-bold text-indian-navy-900 dark:text-indian-parchment-100 uppercase tracking-wider text-xs flex items-center gap-1.5"
              >
                <IndianRupee className="w-3.5 h-3.5 text-indian-terracotta-500" />
                <span>Starting Cash</span>
              </label>
              <span className="font-mono font-black text-base text-indian-terracotta-600 dark:text-indian-terracotta-400">
                ₹{rules.startingCash.toLocaleString('en-IN')}
              </span>
            </div>

            <input
              id="starting-cash-slider"
              type="range"
              min={STARTING_CASH_MIN}
              max={STARTING_CASH_MAX}
              step={STARTING_CASH_STEP}
              value={rules.startingCash}
              onChange={(e) => setRules({ ...rules, startingCash: Number(e.target.value) })}
              className="w-full h-2 bg-indian-parchment-300 dark:bg-indian-navy-700 rounded-lg appearance-none cursor-pointer accent-indian-terracotta-500 transition-all focus:outline-hidden"
              aria-label="Starting Cash Slider"
            />

            <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1.5 font-mono">
              <span>₹{STARTING_CASH_MIN.toLocaleString('en-IN')} (Min)</span>
              <span className="text-indian-terracotta-600 font-bold">Step: ₹{STARTING_CASH_STEP.toLocaleString('en-IN')}</span>
              <span>₹{STARTING_CASH_MAX.toLocaleString('en-IN')} (Max)</span>
            </div>
          </div>

          {/* Start Crossing Money (Pass START Reward) */}
          <div className="p-3 bg-indian-parchment-100/60 dark:bg-indian-navy-800/60 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-indian-navy-900 dark:text-indian-parchment-100 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Start Crossing Money</span>
              </label>
              <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                ₹{rules.passStartReward.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PASS_START_REWARD_OPTIONS.map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setRules((prev) => ({ ...prev, passStartReward: amt }))}
                  className={`py-2 rounded-lg font-bold border transition-all cursor-pointer text-center ${
                    rules.passStartReward === amt
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-white dark:bg-indian-navy-900 text-indian-navy-900 dark:text-gray-300 border-indian-parchment-300 dark:border-indian-navy-700 hover:bg-indian-parchment-200 dark:hover:bg-indian-navy-800'
                  }`}
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
              Salary credited to a player each time they complete a board circuit or land on START.
            </p>
          </div>

          {/* Turn Timer Limit */}
          <div>
            <label className="block font-bold text-indian-navy-900 dark:text-indian-parchment-100 mb-1.5 uppercase tracking-wider">
              Turn Timer Limit
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[3, 15, 30, 45, 60].map((sec) => (
                <button
                  type="button"
                  key={sec}
                  onClick={() => setRules({ ...rules, turnTimerSeconds: sec })}
                  className={`py-2 rounded-lg font-bold border transition-all cursor-pointer ${
                    rules.turnTimerSeconds === sec
                      ? 'bg-indian-terracotta-500 text-white border-indian-terracotta-600 shadow-xs'
                      : 'bg-indian-parchment-100 dark:bg-indian-navy-800 text-indian-navy-900 dark:text-gray-300 border-indian-parchment-300 hover:bg-indian-parchment-200'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Standard Statutory Fixed Game Settings */}
          <div className="p-3 bg-indian-parchment-100/70 dark:bg-indian-navy-800/80 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 space-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Standard Fixed Statutory Rules</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-600 dark:text-gray-300 text-[10px]">
              <div>Central Jail Bail: <strong className="text-indian-navy-900 dark:text-white font-mono">₹500</strong></div>
              <div>GST Checkpost: <strong className="text-indian-navy-900 dark:text-white font-mono">₹500</strong></div>
              <div>Wealth Levy: <strong className="text-indian-navy-900 dark:text-white font-mono">₹500</strong></div>
              <div>Debt Timer: <strong className="text-indian-navy-900 dark:text-white font-mono">120s</strong></div>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="flex-1 font-bold shadow-md cursor-pointer"
            >
              Create Room
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
