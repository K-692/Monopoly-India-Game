import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Volume2, VolumeX, Moon, Sun, Dices, Settings as SettingsIcon, Edit3 } from 'lucide-react';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useSettingsStore } from '@/features/settings/use-settings-store';

export const Header: React.FC = () => {
  const { player, openNamePrompt } = useAuthStore();
  const { soundMuted, toggleSound, theme, toggleTheme } = useSettingsStore();
  const location = useLocation();

  const isCurrent = (path: string) => {
    if (path === '/play') return location.pathname === '/' || location.pathname === '/play' || location.pathname.startsWith('/game') || location.pathname.startsWith('/room');
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-indian-navy-900/95 backdrop-blur-md border-b border-indian-parchment-300 dark:border-indian-navy-700 px-3 sm:px-6 py-2 transition-colors select-none shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-indian-terracotta-500 flex items-center justify-center text-white shadow-sm overflow-hidden p-0.5 border border-indian-terracotta-600">
            <img
              src="./assets/game_logo.png"
              alt="Logo"
              className="w-full h-full object-cover rounded-md"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <span className="font-serif font-black text-base sm:text-lg text-indian-terracotta-600 dark:text-indian-terracotta-400 tracking-wide block leading-none">
              INDIAN MONOPOLY
            </span>
            <span className="text-[9px] text-indian-navy-600 dark:text-indian-parchment-400 font-semibold tracking-wider">
              भारत व्यापार
            </span>
          </div>
        </Link>

        {/* ONLY TWO TABS: Play and Settings */}
        <nav className="flex items-center gap-1 bg-indian-parchment-200/80 dark:bg-indian-navy-800/80 p-1 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700">
          <Link
            to="/"
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isCurrent('/play')
                ? 'bg-white dark:bg-indian-navy-700 text-indian-terracotta-600 shadow-sm'
                : 'text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600'
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Play</span>
          </Link>

          <Link
            to="/settings"
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              isCurrent('/settings')
                ? 'bg-white dark:bg-indian-navy-700 text-indian-terracotta-600 shadow-sm'
                : 'text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </Link>
        </nav>

        {/* Player Name & Controls */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-label={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 transition-colors"
          >
            {soundMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-indian-emerald-500" />}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indian-navy-600" />}
          </button>

          {/* Player Name Badge (Click to Edit Name) */}
          <button
            onClick={() => openNamePrompt()}
            title="Click to change your display name"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-800 hover:border-indian-terracotta-400 transition-all text-left"
          >
            <div
              style={{ backgroundColor: player?.avatarColor || '#C85A32' }}
              className="w-6 h-6 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow-xs"
            >
              {(player?.displayName || 'P').charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100 max-w-[85px] sm:max-w-[120px] truncate">
              {player?.displayName || 'Set Name'}
            </span>
            <Edit3 className="w-3 h-3 text-gray-400 ml-0.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
