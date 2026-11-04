import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Default to repo name on GitHub Pages for production, or '/' locally in dev
  const basePath = mode === 'production'
    ? (env.VITE_APP_BASE_PATH && env.VITE_APP_BASE_PATH !== '/' ? env.VITE_APP_BASE_PATH : '/Monopoly-India-Game/')
    : '/';

  return {
    base: basePath,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
            'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge', 'zustand'],
          },
        },
      },
    },
  };
});

