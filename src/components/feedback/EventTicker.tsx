import React from 'react';
import { GameEvent } from '@/domain/game-types';
import { Bell } from 'lucide-react';

interface EventTickerProps {
  events: GameEvent[];
}

export const EventTicker: React.FC<EventTickerProps> = ({ events }) => {
  const latestEvent = events[0];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-indian-parchment-200/90 dark:bg-indian-navy-800/90 border border-indian-parchment-300 dark:border-indian-navy-700 rounded-lg text-xs w-full overflow-hidden">
      <Bell className="w-3.5 h-3.5 text-indian-terracotta-500 shrink-0" />
      <div className="truncate font-medium text-indian-navy-900 dark:text-indian-parchment-200">
        {latestEvent ? (
          <span>{latestEvent.summary}</span>
        ) : (
          <span className="text-gray-400">Game started. Waiting for actions...</span>
        )}
      </div>
    </div>
  );
};
