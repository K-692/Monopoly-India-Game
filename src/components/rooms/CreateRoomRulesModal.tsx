import React, { useState } from 'react';
import {
  HostCustomRules,
  DEFAULT_HOST_RULES,
  STARTING_CASH_MIN,
  STARTING_CASH_MAX,
  STARTING_CASH_STEP,
  STARTING_CASH_DEFAULT,
} from '@/domain/ruleset';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { X, Sliders, Bot, Plus, Trash2, AlertCircle, IndianRupee, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/features/auth/use-auth-store';

export interface CpuPlayerFormItem {
  id: string;
  name: string;
}

interface CreateRoomRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (rules: HostCustomRules, cpuPlayers?: Array<{ name: string }>) => void;
  isLoading?: boolean;
}

export const CreateRoomRulesModal: React.FC<CreateRoomRulesModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading,
}) => {
  const { player } = useAuthStore();
  const hostName = (player?.displayName || 'Host').trim();

  const [rules, setRules] = useState<HostCustomRules>({
    ...DEFAULT_HOST_RULES,
    startingCash: STARTING_CASH_DEFAULT,
    passStartReward: 3000,
    jailBail: 500,
  });

  const [cpuPlayers, setCpuPlayers] = useState<CpuPlayerFormItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Maximum computer players allowed per room is 3, bounded by (maxPlayers - 1)
  const maxAllowedCpus = Math.min(3, Math.max(0, rules.maxPlayers - 1));
  const canAddMoreCpu = cpuPlayers.length < maxAllowedCpus;

  const handleMaxPlayersChange = (num: number) => {
    const allowed = Math.min(3, Math.max(0, num - 1));
    setRules((prev) => ({ ...prev, maxPlayers: num }));
    if (cpuPlayers.length > allowed) {
      setCpuPlayers((prev) => prev.slice(0, allowed));
    }
  };

  const handleAddCpu = () => {
    if (!canAddMoreCpu) return;
    setFormError(null);

    // Pick next available default name from CPU1, CPU2, CPU3
    const existingNames = new Set(cpuPlayers.map((c) => c.name.trim().toLowerCase()));
    let nextDefault = 'CPU1';
    for (const candidate of ['CPU1', 'CPU2', 'CPU3']) {
      if (!existingNames.has(candidate.toLowerCase())) {
        nextDefault = candidate;
        break;
      }
    }

    setCpuPlayers((prev) => [
      ...prev,
      { id: 'cpu_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), name: nextDefault },
    ]);
  };

  const handleRemoveCpu = (id: string) => {
    setFormError(null);
    setCpuPlayers((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCpuNameChange = (id: string, newName: string) => {
    setFormError(null);
    setCpuPlayers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: newName } : c))
    );
  };

  const validateCpuPlayers = (): string | null => {
    const hostLower = hostName.toLowerCase();
    const seen = new Set<string>([hostLower]);

    for (let i = 0; i < cpuPlayers.length; i++) {
      const trimmed = cpuPlayers[i].name.trim();
      if (!trimmed) {
        return `Computer player #${i + 1} name cannot be empty.`;
      }
      if (trimmed.length < 2) {
        return `Computer player "${trimmed}" must be at least 2 characters.`;
      }
      if (trimmed.length > 20) {
        return `Computer player "${trimmed}" cannot exceed 20 characters.`;
      }
      if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
        return `Computer player "${trimmed}" can only contain letters, numbers, spaces, underscores, or hyphens.`;
      }

      const lower = trimmed.toLowerCase();
      if (lower === hostLower) {
        return `Computer player "${trimmed}" cannot have the same name as the room host.`;
      }
      if (seen.has(lower)) {
        return `Duplicate player name "${trimmed}". All players in a room must have unique names.`;
      }
      seen.add(lower);
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const err = validateCpuPlayers();
    if (err) {
      setFormError(err);
      return;
    }

    setFormError(null);
    onCreate(
      {
        ...rules,
        startingCash: rules.startingCash,
        passStartReward: 3000,
        jailBail: 500,
      },
      cpuPlayers.map((c) => ({ name: c.name.trim() }))
    );
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
                Configure starting cash and opponents for your multiplayer match
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Starting Cash Slider (Section 10) */}
          <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-xl border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="starting-cash-slider" className="font-bold text-indian-navy-900 dark:text-indian-parchment-100 uppercase tracking-wider text-xs flex items-center gap-1.5">
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

          {/* Computer Players Section (Section 2) */}
          <div className="p-3.5 bg-indian-parchment-100/60 dark:bg-indian-navy-800/60 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-indian-navy-900 dark:text-indian-parchment-100 uppercase tracking-wider text-xs">
                  Computer Players ({cpuPlayers.length} / 3)
                </span>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddCpu}
                disabled={!canAddMoreCpu}
                className="text-[11px] h-7 px-2.5 flex items-center gap-1 border-blue-400 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" />
                <span>Add CPU</span>
              </Button>
            </div>

            {cpuPlayers.length === 0 ? (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 italic py-1">
                No computer players added. Game will be played only with human players joining with invite code.
              </p>
            ) : (
              <div className="space-y-2 mt-2">
                {cpuPlayers.map((cpu, idx) => (
                  <div
                    key={cpu.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-indian-navy-900 border border-indian-parchment-300 dark:border-indian-navy-700 animate-scale-in"
                  >
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shrink-0">
                      CPU {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={cpu.name}
                      maxLength={20}
                      onChange={(e) => handleCpuNameChange(cpu.id, e.target.value)}
                      placeholder={`CPU${idx + 1}`}
                      className="flex-1 px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-indian-navy-950 text-indian-navy-900 dark:text-white focus:outline-hidden focus:border-indian-terracotta-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCpu(cpu.id)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer shrink-0"
                      title="Remove Computer Player"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!canAddMoreCpu && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
                {cpuPlayers.length >= 3
                  ? 'Maximum 3 computer players reached.'
                  : `Room capacity reached (${rules.maxPlayers} max players including host). Increase Maximum Players to add more.`}
              </p>
            )}
          </div>

          {/* Maximum Players */}
          <div>
            <label className="block font-bold text-indian-navy-900 dark:text-indian-parchment-100 mb-1.5 uppercase tracking-wider">
              Maximum Players (Seats)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => handleMaxPlayersChange(num)}
                  className={`py-2 rounded-lg font-bold border transition-all cursor-pointer ${
                    rules.maxPlayers === num
                      ? 'bg-indian-navy-700 text-white border-indian-navy-800 shadow-xs'
                      : 'bg-indian-parchment-100 dark:bg-indian-navy-800 text-indian-navy-900 dark:text-gray-300 border-indian-parchment-300 hover:bg-indian-parchment-200'
                  }`}
                >
                  {num} Players
                </button>
              ))}
            </div>
          </div>

          {/* Turn Timer Limit */}
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
                  className={`py-2 rounded-lg font-bold border transition-all cursor-pointer ${
                    rules.turnTimerSeconds === sec
                      ? 'bg-indian-terracotta-500 text-white border-indian-terracotta-600 shadow-xs'
                      : 'bg-indian-parchment-100 dark:bg-indian-navy-800 text-indian-navy-900 dark:text-gray-300 border-indian-parchment-300 hover:bg-indian-parchment-200'
                  }`}
                >
                  {sec} seconds
                </button>
              ))}
            </div>
          </div>

          {/* Standard Statutory Fixed Game Settings (Section 10.2) */}
          <div className="p-3 bg-indian-parchment-100/70 dark:bg-indian-navy-800/80 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 space-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Standard Fixed Statutory Rules</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-gray-600 dark:text-gray-300 text-[10px]">
              <div>Pass START: <strong className="text-indian-navy-900 dark:text-white font-mono">₹3,000</strong></div>
              <div>Center Jail Bail: <strong className="text-indian-navy-900 dark:text-white font-mono">₹500</strong></div>
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
