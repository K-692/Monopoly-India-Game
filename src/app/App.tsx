import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '@/lib/socket/socket-client';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { Header } from '@/components/ui/Header';
import { NamePromptModal } from '@/components/ui/NamePromptModal';
import { ToastContainer } from '@/components/feedback/ToastContainer';
import { PingIndicator } from '@/components/feedback/PingIndicator';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { useAuthStore } from '@/features/auth/use-auth-store';

export const App: React.FC = () => {
  const { theme } = useSettingsStore();
  const { initializeAuth } = useAuthStore();
  // On the game screen the ping badge and notifications live inside the board centre instead.
  const onGameScreen = useLocation().pathname.startsWith('/game/');
  const navigate = useNavigate();
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);

  // Host removed this player from the waiting lobby: leave the room, go home and tell them why
  useEffect(() => {
    const socket = getSocket();
    const onKicked = (data: { message?: string }) => {
      useRoomStore.setState({ currentRoom: null, activeRoomId: null });
      navigate('/', { replace: true });
      setKickedMessage(data?.message || 'You have been kicked out from the room.');
    };
    socket.on('room:kicked', onKicked);
    return () => {
      socket.off('room:kicked', onKicked);
    };
  }, [navigate]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="h-screen flex flex-col bg-indian-parchment-100 dark:bg-indian-navy-900 text-indian-navy-900 dark:text-indian-parchment-100 transition-colors">
      <Header />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Outlet />
      </main>
      <NamePromptModal />
      {/* Outside a game: bottom-left toasts and bottom-right live latency badge */}
      {!onGameScreen && <ToastContainer />}
      {!onGameScreen && <PingIndicator />}
      {kickedMessage && (
        <div
          role="alertdialog"
          aria-modal="true"
          data-testid="kicked-alert"
          className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4"
        >
          <div className="max-w-sm w-full rounded-2xl bg-white dark:bg-indian-navy-900 border-2 border-red-500 shadow-2xl p-5 text-center space-y-3">
            <div className="text-3xl">🚪</div>
            <p className="font-bold text-indian-navy-900 dark:text-white">{kickedMessage}</p>
            <button
              type="button"
              autoFocus
              onClick={() => setKickedMessage(null)}
              className="w-full py-2 rounded-xl bg-indian-terracotta-500 hover:bg-indian-terracotta-600 text-white font-bold cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
