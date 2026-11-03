import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/components/ui/Header';
import { initAnalytics } from '@/lib/firebase/firebase-analytics';
import { useSettingsStore } from '@/features/settings/use-settings-store';

export const App: React.FC = () => {
  const { theme } = useSettingsStore();

  useEffect(() => {
    initAnalytics().catch(() => {});
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col bg-indian-parchment-100 dark:bg-indian-navy-900 text-indian-navy-900 dark:text-indian-parchment-100 transition-colors">
      <Header />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <footer className="py-3 px-4 border-t border-indian-parchment-300 dark:border-indian-navy-800 text-center text-[10px] text-gray-500">
        Indian Monopoly • Server-Authoritative Multi-Device Architecture • Open Source
      </footer>
    </div>
  );
};
