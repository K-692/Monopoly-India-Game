import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App } from './App';
import { PlayPage } from '@/features/play/PlayPage';
import { LobbyPage } from '@/features/rooms/LobbyPage';
import { GamePage } from '@/features/game/GamePage';
import { PracticeMatchPage } from '@/features/practice/PracticeMatchPage';
import { RulesPage } from '@/features/rules/RulesPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export const AppRouter: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          {/* Main Play Hub */}
          <Route index element={<PlayPage />} />
          <Route path="play" element={<PlayPage />} />

          {/* Official Game Rules */}
          <Route path="rules" element={<RulesPage />} />

          {/* Practice Match Sandbox (modular, easy to remove later) */}
          <Route path="practice" element={<PracticeMatchPage />} />

          {/* Multiplayer Room Routes */}
          <Route path="room/:roomId" element={<LobbyPage />} />
          <Route path="game/:gameId" element={<GamePage />} />

          {/* Settings Tab */}
          <Route path="settings" element={<SettingsPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
