import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/components/ui/Header';
import { NamePromptModal } from '@/components/ui/NamePromptModal';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { useAuthStore } from '@/features/auth/use-auth-store';

export const App: React.FC = () => {
  const { theme } = useSettingsStore();
  const { initializeAuth } = useAuthStore();

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
    </div>
  );
};
