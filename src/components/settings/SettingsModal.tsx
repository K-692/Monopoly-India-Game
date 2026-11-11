import React, { useState, useEffect } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Sparkles,
  User,
  Check,
  Music,
} from 'lucide-react';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { useAuthStore, PLAYER_COLORS } from '@/features/auth/use-auth-store';
import { sound } from '@/lib/audio/sound-engine';
import { Button } from '@/components/ui/Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    soundMuted,
    soundVolume,
    toggleSound,
    setVolume,
    theme,
    toggleTheme,
    reducedMotion,
    toggleReducedMotion,
  } = useSettingsStore();

  const { player, setPlayerName } = useAuthStore();

  const [editName, setEditName] = useState(player?.displayName || '');
  const [selectedColor, setSelectedColor] = useState(player?.avatarColor || PLAYER_COLORS[0]);
  const [savedMsg, setSavedMsg] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Sync state whenever player or modal opens
  useEffect(() => {
    if (isOpen && player) {
      setEditName(player.displayName || '');
      setSelectedColor(player.avatarColor || PLAYER_COLORS[0]);
      setNameError(null);
    }
  }, [isOpen, player]);

  // Support Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTestSound = () => {
    sound.play('DICE_ROLL');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed) {
      setNameError('Name cannot be empty.');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      setNameError('Name must be between 2 and 20 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
      setNameError('Only letters, numbers, spaces, hyphens, and underscores allowed.');
      return;
    }

    setNameError(null);
    await setPlayerName(trimmed, selectedColor);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2200);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      data-testid="settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-indian-parchment-100 dark:bg-indian-navy-900 border border-indian-parchment-300 dark:border-indian-navy-700 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-indian-terracotta-600 via-amber-700 to-stone-900 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="settings-modal-title" className="font-serif font-black text-base sm:text-lg text-white leading-tight truncate">
                Game Settings & Preferences
              </h2>
              <p className="text-[11px] text-amber-200/90 hidden sm:block truncate">
                Configure audio, theme appearance, and player identity without interrupting ongoing matches.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            data-testid="close-settings-modal-button"
            className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/40 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4 text-xs">
          {/* Section 1: Player Profile & Identity */}
          <div className="p-4 rounded-xl bg-white dark:bg-indian-navy-800/80 border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                <User className="w-3.5 h-3.5 text-indian-terracotta-500" />
                <span>Player Profile & Token</span>
              </h3>
              {savedMsg && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-fade-in">
                  <Check className="w-3.5 h-3.5" /> Saved!
                </span>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    placeholder="Enter display name"
                    maxLength={20}
                    className="flex-1 bg-indian-parchment-100 dark:bg-indian-navy-900 border border-indian-parchment-300 dark:border-indian-navy-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-indian-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indian-terracotta-500"
                  />
                  <Button type="submit" size="sm" variant="primary" className="text-xs font-bold px-3">
                    Save
                  </Button>
                </div>
                {nameError && (
                  <p className="text-[10px] text-red-500 font-bold mt-1">{nameError}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Token Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PLAYER_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSelectedColor(col)}
                      style={{ backgroundColor: col }}
                      className="w-6 h-6 rounded-full border-2 border-white shadow-xs flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                      title={col}
                    >
                      {selectedColor === col && (
                        <Check className="w-3.5 h-3.5 text-white drop-shadow-md stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>

          {/* Section 2: Audio & Sound Effects */}
          <div className="p-4 rounded-xl bg-white dark:bg-indian-navy-800/80 border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-3">
            <h3 className="font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Volume2 className="w-3.5 h-3.5 text-indian-terracotta-500" />
              <span>Audio & Sound Effects</span>
            </h3>

            <div className="flex items-center justify-between py-1.5 border-b border-indian-parchment-200 dark:border-indian-navy-700">
              <div>
                <span className="font-semibold text-indian-navy-900 dark:text-indian-parchment-100 block">
                  Procedural Sound Effects
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Web Audio chimes for dice, turns, purchases, and debt alerts
                </span>
              </div>

              <Button
                size="sm"
                variant={soundMuted ? 'outline' : 'primary'}
                onClick={toggleSound}
                className="text-xs font-bold px-3 shrink-0"
              >
                {soundMuted ? (
                  <VolumeX className="w-3.5 h-3.5 mr-1 text-red-500" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 mr-1" />
                )}
                {soundMuted ? 'Unmute' : 'Mute'}
              </Button>
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Master Volume</span>
                <span className="font-mono font-bold">{Math.round(soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundVolume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                disabled={soundMuted}
                className="w-full accent-indian-terracotta-500 cursor-pointer disabled:opacity-40"
              />
              <div className="mt-2 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleTestSound}
                  disabled={soundMuted}
                  className="text-xs text-indian-terracotta-600 hover:text-indian-terracotta-700 dark:text-indian-terracotta-400"
                >
                  <Music className="w-3 h-3 mr-1" /> Test Audio Chime
                </Button>
              </div>
            </div>
          </div>

          {/* Section 3: Interface Appearance */}
          <div className="p-4 rounded-xl bg-white dark:bg-indian-navy-800/80 border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-3">
            <h3 className="font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-indian-navy-600 dark:text-amber-400" />
              <span>Interface & Accessibility</span>
            </h3>

            <div className="flex items-center justify-between py-1.5 border-b border-indian-parchment-200 dark:border-indian-navy-700">
              <div>
                <span className="font-semibold text-indian-navy-900 dark:text-indian-parchment-100 block">
                  Color Theme
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Switch between warm linen parchment and deep obsidian night theme
                </span>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={toggleTheme}
                className="text-xs font-bold px-3 shrink-0"
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 mr-1 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 mr-1" />
                )}
                {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
              </Button>
            </div>

            <div className="flex items-center justify-between pt-1.5">
              <div>
                <span className="font-semibold text-indian-navy-900 dark:text-indian-parchment-100 block">
                  Reduced Motion
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Minimize tumbling dice rolls and wave background animations
                </span>
              </div>

              <Button
                size="sm"
                variant={reducedMotion ? 'primary' : 'outline'}
                onClick={toggleReducedMotion}
                className="text-xs font-bold px-3 shrink-0"
              >
                {reducedMotion ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-indian-parchment-200 dark:bg-indian-navy-950 border-t border-indian-parchment-300 dark:border-indian-navy-800 flex justify-end shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs font-bold px-4"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
