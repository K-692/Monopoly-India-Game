import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Volume2, VolumeX, Moon, Sun, Users, Clock, Home, LogIn, LogOut } from 'lucide-react';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { Button } from './Button';

export const Header: React.FC = () => {
  const { user, loginWithGoogle, signOutUser } = useAuthStore();
  const { soundMuted, toggleSound, theme, toggleTheme } = useSettingsStore();
  const location = useLocation();

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-indian-navy-900/95 backdrop-blur-md border-b border-indian-parchment-300 dark:border-indian-navy-700 px-3 sm:px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-indian-terracotta-500 flex items-center justify-center text-white shadow-sm overflow-hidden p-0.5 border border-indian-terracotta-600">
            <img
              src="./assets/game_logo.png"
              alt="Logo"
              className="w-full h-full object-cover rounded-md"
              onError={(e) => {
                // Fallback SVG if image not found
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <span className="font-serif font-bold text-lg text-indian-terracotta-600 dark:text-indian-terracotta-400 tracking-wide block leading-none">
              INDIAN MONOPOLY
            </span>
            <span className="text-[10px] text-indian-navy-600 dark:text-indian-parchment-400 font-medium tracking-wider">
              भारत व्यापार
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-indian-parchment-200/60 dark:bg-indian-navy-800/60 p-1 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700">
          <Link
            to="/home"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isCurrent('/home')
                ? 'bg-white dark:bg-indian-navy-700 text-indian-terracotta-600 shadow-sm'
                : 'text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600'
            }`}
          >
            <Home className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <Link
            to="/friends"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isCurrent('/friends')
                ? 'bg-white dark:bg-indian-navy-700 text-indian-terracotta-600 shadow-sm'
                : 'text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Friends
          </Link>
          <Link
            to="/history"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isCurrent('/history')
                ? 'bg-white dark:bg-indian-navy-700 text-indian-terracotta-600 shadow-sm'
                : 'text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Archives
          </Link>
        </nav>

        {/* Controls & Profile */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-label={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 transition-colors"
          >
            {soundMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-indian-emerald-500" />}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 bg-white dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indian-navy-600" />}
          </button>

          {/* User Sign In / Profile */}
          {user ? (
            <div className="flex items-center gap-2 pl-1 border-l border-indian-parchment-300 dark:border-indian-navy-700">
              <div className="w-8 h-8 rounded-full bg-indian-terracotta-500 text-white font-bold text-xs flex items-center justify-center border border-indian-terracotta-600 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                ) : (
                  user.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="hidden sm:inline text-xs font-medium text-indian-navy-900 dark:text-indian-parchment-100 max-w-[100px] truncate">
                {user.displayName}
              </span>
              <button
                onClick={signOutUser}
                aria-label="Sign out"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-indian-navy-600 dark:text-indian-parchment-300 hover:text-red-600"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={loginWithGoogle}
              className="text-xs flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-indian-terracotta-500" />
              <span>Sign In</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
