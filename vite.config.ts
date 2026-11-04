import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Respect explicitly configured VITE_APP_BASE_PATH (such as '/' for LAN mode),
  // otherwise default to GitHub Pages repository base in production, or '/' in dev
  const basePath = env.VITE_APP_BASE_PATH !== undefined
    ? env.VITE_APP_BASE_PATH
    : (mode === 'production' ? '/Monopoly-India-Game/' : '/');

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
            'vendor-network': ['socket.io-client', 'qrcode'],
            'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge', 'zustand'],
          },
        },
      },
    },
  };
});

