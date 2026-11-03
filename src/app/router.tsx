import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App } from './App';
import { LandingPage } from '@/features/landing/LandingPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LobbyPage } from '@/features/rooms/LobbyPage';
import { GamePage } from '@/features/game/GamePage';
import { FriendsPage } from '@/features/friends/FriendsPage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export const AppRouter: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<LandingPage />} />
          <Route path="home" element={<DashboardPage />} />
          <Route path="room/:roomId" element={<LobbyPage />} />
          <Route path="game/:gameId" element={<GamePage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
