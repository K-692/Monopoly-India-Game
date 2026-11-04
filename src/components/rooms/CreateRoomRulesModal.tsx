import React, { useState } from 'react';
import { HostCustomRules, DEFAULT_HOST_RULES } from '@/domain/ruleset';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { X, Sliders, Check } from 'lucide-react';

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
  const [rules, setRules] = useState<HostCustomRules>(DEFAULT_HOST_RULES);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(rules);
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
                Host Game Rules & Settings
              </h3>
              <p className="text-[11px] text-gray-500">
                Customize rules for all players in your room
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Starting Cash */}
          <div>
            <label className="block font-bold text-indian-navy-900 dark:text-indian-parchment-100 mb-1.5 uppercase tracking-wider">
              Starting Cash (₹)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[10000, 15000, 20000, 25000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setRules({ ...rules, startingCash: amt })}
                  className={`py-2 rounded-lg font-bold border transition-all ${
                    rules.startingCash === amt
                      ? 'bg-indian-terracotta-500 text-white border-indian-terracotta-600 shadow-xs'
                      : 'bg-indian-parchment-100 dark:bg-indian-navy-800 text-indian-navy-900 dark:text-gray-300 border-indian-parchment-300'
                  }`}
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Turn Timer */}
          <div>
            <label className="block font-bold text-indian-navy-900 dark:text-indian-parchment-100 mb-1.5 uppercase tracking-wider">
              Turn Timer Limit
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((sec) => (
                <button
                  type="button"
                  key={sec}
                  onClick={() => setRules({ ...rules, turnTimerSeconds: sec })}
                  className={`py-2 rounded-lg font-bold border transition-all ${
                    rules.turnTimerSeconds === sec
                      ? 'bg-indian-terracotta-500 text-white border-indian-terracotta-600 shadow-xs'
                      : 'bg-indian-parchment-100 dark:bg-indian-navy-800 text-indian-navy-900 dark:text-gray-300 border-indian-parchment-300'
                  }`}
                >
                  {sec} seconds
                </button>
              ))}
            </div>
          </div>

          {/* Max Players */}
          <div>
            <label className="block font-bold text-indian-navy-900 dark:text-indian-parchment-100 mb-1.5 uppercase tracking-wider">
              Maximum Players
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setRules({ ...rules, maxPlayers: num })}
                  className={`py-2 rounded-lg font-bold border transition-all ${
                    rules.maxPlayers === num
                      ? 'bg-indian-navy-700 text-white border-indian-navy-800 shadow-xs'
                      : 'bg-indian-parchment-100 dark:bg-indian-navy-800 text-indian-navy-900 dark:text-gray-300 border-indian-parchment-300'
                  }`}
                >
                  {num} Players
                </button>
              ))}
            </div>
          </div>

          {/* Pass START Reward */}
          <div>
            <label className="block font-bold text-indian-navy-900 dark:text-indian-parchment-100 mb-1.5 uppercase tracking-wider">
              Pass START Reward (₹)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1000, 2000, 3000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setRules({ ...rules, passStartReward: amt })}
                  className={`py-2 rounded-lg font-bold border transition-all ${
                    rules.passStartReward === amt
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-indian-parchment-100 dark:bg-indian-navy-800 text-indian-navy-900 dark:text-gray-300 border-indian-parchment-300'
                  }`}
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Jail Bail */}
          <div>
            <label className="block font-bold text-indian-navy-900 dark:text-indian-parchment-100 mb-1.5 uppercase tracking-wider">
              Central Jail Bail (₹)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[500, 1000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setRules({ ...rules, jailBail: amt })}
                  className={`py-2 rounded-lg font-bold border transition-all ${
                    rules.jailBail === amt
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-indian-parchment-100 dark:bg-indian-navy-800 text-indian-navy-900 dark:text-gray-300 border-indian-parchment-300'
                  }`}
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Double Rent Monopoly Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-indian-parchment-100 dark:bg-indian-navy-800 border border-indian-parchment-300">
            <div>
              <span className="font-bold text-indian-navy-900 dark:text-white block">
                Double Rent for Monopolies
              </span>
              <span className="text-[10px] text-gray-500">
                2x base rent on undeveloped properties when whole color set is owned
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRules({ ...rules, doubleRentMonopoly: !rules.doubleRentMonopoly })}
              className={`w-6 h-6 rounded flex items-center justify-center border ${
                rules.doubleRentMonopoly
                  ? 'bg-indian-terracotta-500 text-white border-indian-terracotta-600'
                  : 'bg-white border-gray-400'
              }`}
            >
              {rules.doubleRentMonopoly && <Check className="w-4 h-4" />}
            </button>
          </div>

          <div className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="flex-1 font-bold shadow-md"
            >
              Create Room with Rules
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

