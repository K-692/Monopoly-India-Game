import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App } from './App';
import { PlayPage } from '@/features/play/PlayPage';
import { LobbyPage } from '@/features/rooms/LobbyPage';
import { JoinPage } from '@/features/rooms/JoinPage';
import { GamePage } from '@/features/game/GamePage';
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

          {/* Multiplayer Room Routes */}
          <Route path="room/:roomId" element={<LobbyPage />} />
          <Route path="join/:inviteCode" element={<JoinPage />} />
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
