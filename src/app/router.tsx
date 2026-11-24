import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App } from './App';
import { PlayPage } from '@/features/play/PlayPage';
import { LobbyPage } from '@/features/rooms/LobbyPage';
import { JoinPage } from '@/features/rooms/JoinPage';
import { GamePage } from '@/features/game/GamePage';
import { RulesPage } from '@/features/rules/RulesPage';

/** Clean path URLs (no '#'), served under the deployment base path, e.g. /Monopoly-India-Game/join/ABC123. */
const ROUTER_BASENAME = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
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

          {/* Settings Tab redirected to home (Settings is now a global modal) */}
          <Route path="settings" element={<Navigate to="/" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
