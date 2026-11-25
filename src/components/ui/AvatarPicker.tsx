import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { listPickerEmojis, sanitizeAvatarEmoji } from '@/domain/avatar';

let cachedEmojis: string[] | null = null;
const getEmojis = () => (cachedEmojis ||= listPickerEmojis());

interface AvatarPickerProps {
  value: string | null;
  onChange: (emoji: string | null) => void;
  /** Letter shown when no emoji is chosen. */
  fallbackLetter: string;
  color?: string;
}

/**
 * Emoji avatar chooser: a scrollable grid of every standard emoji, plus a box to paste or type any
 * other emoji (flags, skin tones, combined emojis). "None" keeps the name's first letter.
 */
export const AvatarPicker: React.FC<AvatarPickerProps> = ({ value, onChange, fallbackLetter, color }) => {
  const emojis = useMemo(getEmojis, []);
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  return (
    <div data-testid="avatar-picker" className="space-y-2">
      <div className="flex items-center gap-3">
        <div
          data-testid="avatar-preview"
          style={{ backgroundColor: color || '#C85A32' }}
          className="w-12 h-12 rounded-full border-2 border-white shadow-md flex items-center justify-center text-2xl text-white font-black shrink-0"
        >
          {value || fallbackLetter}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <input
            type="text"
            value={custom}
            placeholder="Paste or type any emoji"
            aria-label="Custom emoji avatar"
            onChange={(e) => {
              setCustom(e.target.value);
              const emoji = sanitizeAvatarEmoji(e.target.value);
              setCustomError(e.target.value.trim() && !emoji ? 'That is not an emoji' : null);
              if (emoji) onChange(emoji);
            }}
            className="w-full min-w-0 bg-indian-parchment-100 dark:bg-indian-navy-800 border border-indian-parchment-400 dark:border-indian-navy-700 rounded-lg px-2.5 py-1.5 text-sm text-indian-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indian-terracotta-500"
          />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setCustom('');
              setCustomError(null);
            }}
            className={cn(
              'shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer',
              value === null
                ? 'bg-indian-terracotta-500 text-white border-indian-terracotta-600'
                : 'bg-white dark:bg-indian-navy-800 text-gray-600 dark:text-gray-300 border-indian-parchment-400 dark:border-indian-navy-700'
            )}
            title="Use the first letter of your name"
          >
            None
          </button>
        </div>
      </div>
      {customError && <p className="text-[10px] text-red-600 font-semibold">{customError}</p>}
      <div
        role="listbox"
        aria-label="Emoji avatars"
        className="h-36 overflow-y-auto rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 bg-white/70 dark:bg-indian-navy-950/60 p-1 grid grid-cols-8 sm:grid-cols-10 gap-0.5"
      >
        {emojis.map((e) => (
          <button
            key={e}
            type="button"
            role="option"
            aria-selected={value === e}
            onClick={() => {
              onChange(e);
              setCustom('');
              setCustomError(null);
            }}
            className={cn(
              'aspect-square rounded-md text-xl leading-none flex items-center justify-center cursor-pointer hover:bg-indian-parchment-200 dark:hover:bg-indian-navy-800',
              value === e && 'bg-indian-terracotta-100 ring-2 ring-indian-terracotta-500'
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
};
