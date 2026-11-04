import { create } from 'zustand';
import { sound } from '@/lib/audio/sound-engine';

interface SettingsState {
  soundMuted: boolean;
  soundVolume: number;
  theme: 'light' | 'dark';
  reducedMotion: boolean;
  toggleSound: () => void;
  setVolume: (vol: number) => void;
  toggleTheme: () => void;
  toggleReducedMotion: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  soundMuted: sound.getMuted(),
  soundVolume: sound.getVolume(),
  theme: 'light',
  reducedMotion: false,

  toggleSound: () => {
    const next = !get().soundMuted;
    sound.setMuted(next);
    set({ soundMuted: next });
    if (!next) {
      sound.play('BUTTON_CLICK');
    }
  },

  setVolume: (vol: number) => {
    sound.setVolume(vol);
    set({ soundVolume: vol });
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: next });
    if (typeof document !== 'undefined') {
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  },

  toggleReducedMotion: () => {
    set({ reducedMotion: !get().reducedMotion });
  },
}));

