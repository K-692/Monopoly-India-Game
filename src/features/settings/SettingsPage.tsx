import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from './use-settings-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Volume2, VolumeX, Moon, Sun, ArrowLeft, Sparkles, User, Check } from 'lucide-react';
import { sound } from '@/lib/audio/sound-engine';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { soundMuted, soundVolume, toggleSound, setVolume, theme, toggleTheme, reducedMotion, toggleReducedMotion } =
    useSettingsStore();
  const { player, setPlayerName } = useAuthStore();

  const [editName, setEditName] = useState(player?.displayName || '');
  const [savedMsg, setSavedMsg] = useState(false);

  const handleTestSound = () => {
    sound.play('DICE_ROLL');
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setPlayerName(editName.trim());
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-indian-parchment-300 dark:border-indian-navy-700">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-semibold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Play
        </button>

        <h1 className="font-serif font-bold text-lg text-indian-navy-900 dark:text-indian-parchment-100">
          Game Settings
        </h1>
      </div>

      <div className="space-y-4">
        {/* Player Profile & Name */}
        <Card className="p-4 border-indian-parchment-300">
          <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <User className="w-4 h-4 text-indian-terracotta-500" /> Player Profile
          </h3>

          <form onSubmit={handleSaveName} className="flex gap-2 items-center">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="flex-1 bg-indian-parchment-100 dark:bg-indian-navy-800 border border-indian-parchment-400 dark:border-indian-navy-700 rounded-lg px-3 py-2 text-xs font-semibold text-indian-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indian-terracotta-500"
            />
            <Button type="submit" size="sm" variant="primary" className="text-xs font-bold px-4">
              {savedMsg ? <Check className="w-3.5 h-3.5 mr-1" /> : null}
              {savedMsg ? 'Saved!' : 'Save Name'}
            </Button>
          </form>
        </Card>

        {/* Audio Settings */}
        <Card className="p-4 border-indian-parchment-300">
          <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-indian-terracotta-500" /> Audio & Sound Effects
          </h3>

          <div className="flex items-center justify-between py-2 border-b border-indian-parchment-200 dark:border-indian-navy-700">
            <div>
              <span className="text-xs font-semibold text-indian-navy-900 dark:text-indian-parchment-100 block">
                Procedural Sound Effects
              </span>
              <span className="text-[10px] text-gray-500">
                Web Audio procedural dice rolls, pawn steps, coin chimes & jail locks
              </span>
            </div>

            <Button
              size="sm"
              variant={soundMuted ? 'outline' : 'primary'}
              onClick={toggleSound}
              className="text-xs font-bold px-3"
            >
              {soundMuted ? <VolumeX className="w-4 h-4 mr-1 text-red-500" /> : <Volume2 className="w-4 h-4 mr-1" />}
              {soundMuted ? 'Unmute' : 'Mute'}
            </Button>
          </div>

          <div className="pt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">Master Volume</span>
              <span className="font-bold">{Math.round(soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundVolume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              disabled={soundMuted}
              className="w-full accent-indian-terracotta-500 cursor-pointer"
            />
            <div className="mt-2 text-right">
              <Button size="sm" variant="ghost" onClick={handleTestSound} className="text-xs text-indian-terracotta-600">
                Test Sound
              </Button>
            </div>
          </div>
        </Card>

        {/* Visual & Theme */}
        <Card className="p-4 border-indian-parchment-300">
          <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indian-navy-600" /> Interface Appearance
          </h3>

          <div className="flex items-center justify-between py-2 border-b border-indian-parchment-200 dark:border-indian-navy-700">
            <div>
              <span className="text-xs font-semibold text-indian-navy-900 dark:text-indian-parchment-100 block">
                Theme Appearance
              </span>
              <span className="text-[10px] text-gray-500">
                Toggle warm linen parchment or deep midnight theme
              </span>
            </div>

            <Button size="sm" variant="outline" onClick={toggleTheme} className="text-xs font-bold px-3">
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 mr-1 text-amber-400" /> : <Moon className="w-3.5 h-3.5 mr-1" />}
              {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
            </Button>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <span className="text-xs font-semibold text-indian-navy-900 dark:text-indian-parchment-100 block">
                Reduced Motion
              </span>
              <span className="text-[10px] text-gray-500">
                Disable tumbling dice and spinning pawn animations
              </span>
            </div>

            <Button
              size="sm"
              variant={reducedMotion ? 'primary' : 'outline'}
              onClick={toggleReducedMotion}
              className="text-xs font-bold px-3"
            >
              {reducedMotion ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
