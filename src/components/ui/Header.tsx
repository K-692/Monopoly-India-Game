import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Volume2, VolumeX, Dices, Settings as SettingsIcon, Edit3, HelpCircle } from 'lucide-react';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { RulesModal } from '@/components/rules/RulesModal';

export const Header: React.FC = () => {
  const { player, openNamePrompt } = useAuthStore();
  const { soundMuted, toggleSound } = useSettingsStore();
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const location = useLocation();

  const isCurrent = (path: string) => {
    if (path === '/play') return location.pathname === '/' || location.pathname === '/play' || location.pathname.startsWith('/game') || location.pathname.startsWith('/room');
    return location.pathname === path;
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-indian-navy-900/95 backdrop-blur-md border-b border-indian-parchment-300 dark:border-indian-navy-700 px-2 sm:px-6 py-2 transition-colors select-none shrink-0">
        <div className="max-w-7xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Zone 1 (Left): Brand Game Logo on extreme left */}
          <div className="flex items-center justify-start min-w-0">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2 group shrink-0 ml-1">
              <div className="w-8 h-8 rounded-lg bg-indian-terracotta-500 flex items-center justify-center text-white shadow-sm overflow-hidden p-0.5 border border-indian-terracotta-600 shrink-0">
                <img
                  src={`${import.meta.env.BASE_URL}assets/game_logo.png`}
                  alt="Logo"
                  className="w-full h-full object-cover rounded-md"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="hidden sm:block min-w-0">
                <span className="font-serif font-black text-sm sm:text-base md:text-lg text-indian-terracotta-600 dark:text-indian-terracotta-400 tracking-wide block leading-none truncate">
                  INDIAN MONOPOLY
                </span>
              </div>
            </Link>
          </div>

          {/* Zone 2 (Center): Play & Settings tabs symmetrically centered relative to entire header */}
          <div className="flex items-center justify-center shrink-0">
            <nav className="flex items-center gap-1 bg-indian-parchment-200/80 dark:bg-indian-navy-800/80 p-0.5 sm:p-1 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shrink-0">
              <Link
                to="/"
                className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors min-h-[36px] ${
                  isCurrent('/play')
                    ? 'bg-white dark:bg-indian-navy-700 text-indian-terracotta-600 shadow-sm'
                    : 'text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600'
                }`}
              >
                <Dices className="w-3.5 h-3.5 shrink-0" />
                <span>Play</span>
              </Link>

              <Link
                to="/settings"
                className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors min-h-[36px] ${
                  isCurrent('/settings')
                    ? 'bg-white dark:bg-indian-navy-700 text-indian-terracotta-600 shadow-sm'
                    : 'text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600'
                }`}
              >
                <SettingsIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Settings</span>
              </Link>
            </nav>
          </div>

          {/* Zone 3 (Right): Rules Button (?) | Speaker/Audio Toggle | Player Name Box */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 min-w-0 shrink-0">
            {/* 1. Rules Question Mark Popup Button */}
            <button
              onClick={() => setIsRulesModalOpen(true)}
              aria-label="View Game Rules"
              title="Official Game Rules & Guide"
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 transition-colors cursor-pointer shrink-0"
            >
              <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </button>

            {/* 2. Speaker / Audio Toggle Button */}
            <button
              onClick={toggleSound}
              aria-label={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 transition-colors cursor-pointer shrink-0"
            >
              {soundMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-indian-emerald-500" />}
            </button>

            {/* 3. Player Name Box (Click to Edit Name) */}
            <button
              onClick={() => openNamePrompt()}
              title="Click to change your display name"
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-800 hover:border-indian-terracotta-400 transition-all text-left shrink-0 min-w-0"
            >
              <div
                style={{ backgroundColor: player?.avatarColor || '#C85A32' }}
                className="w-6 h-6 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow-xs shrink-0"
              >
                {(player?.displayName || 'P').charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100 max-w-[65px] sm:max-w-[120px] truncate">
                {player?.displayName || 'Set Name'}
              </span>
              <Edit3 className="w-3 h-3 text-gray-400 ml-0.5 shrink-0 hidden sm:block" />
            </button>
          </div>
        </div>
      </header>

    {/* Rules Pop Up Window Modal */}
    <RulesModal isOpen={isRulesModalOpen} onClose={() => setIsRulesModalOpen(false)} />
  </>
  );
};
