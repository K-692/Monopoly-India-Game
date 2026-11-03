import React, { useState } from 'react';
import { EmoteReaction } from '@/domain/game-types';
import { GAME_CONSTANTS } from '@/domain/ruleset';

interface ReactionTrayProps {
  onSendEmote: (emote: string) => void;
  activeEmotes: EmoteReaction[];
}

const CURATED_EMOTES = ['👏', '😂', '😮', '😭', '🔥', '❤️', '🤝', '🎉'];

export const ReactionTray: React.FC<ReactionTrayProps> = ({ onSendEmote, activeEmotes }) => {
  const [lastSentTimes, setLastSentTimes] = useState<number[]>([]);

  const handleSend = (emote: string) => {
    const now = Date.now();
    const recent = lastSentTimes.filter(
      (t) => now - t < GAME_CONSTANTS.EMOTE_RATE_LIMIT_WINDOW_MS
    );

    if (recent.length >= GAME_CONSTANTS.EMOTE_RATE_LIMIT_COUNT) {
      return; // Rate limited
    }

    setLastSentTimes([...recent, now]);
    onSendEmote(emote);
  };

  return (
    <div className="relative">
      {/* Floating Active Emote Bubbles */}
      <div className="fixed bottom-16 right-4 sm:right-8 z-50 flex flex-col items-end gap-2 pointer-events-none">
        {activeEmotes.slice(-4).map((reaction) => (
          <div
            key={reaction.id}
            className="flex items-center gap-2 bg-white/95 dark:bg-indian-navy-800/95 border border-indian-parchment-300 dark:border-indian-navy-700 px-3 py-1.5 rounded-full shadow-lg animate-slide-up text-sm font-semibold"
          >
            <span className="text-xl">{reaction.emote}</span>
            <span className="text-xs text-indian-navy-800 dark:text-indian-parchment-200">
              {reaction.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Emote Selector Buttons Bar */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 p-1.5 bg-white/90 dark:bg-indian-navy-800/90 border border-indian-parchment-300 dark:border-indian-navy-700 rounded-xl shadow-xs">
        {CURATED_EMOTES.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSend(emoji)}
            title={`React with ${emoji}`}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-lg sm:text-xl rounded-lg hover:bg-indian-parchment-200 dark:hover:bg-indian-navy-700 active:scale-90 transition-transform select-none"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
