/**
 * Indian Monopoly - Full-Stack LAN Development Runner
 * Launches both the authoritative Node.js LAN server (port 4173)
 * and the Vite frontend development server (port 5173) concurrently.
 */

import { spawn } from 'child_process';

const serverProc = spawn('npx', ['tsx', 'watch', 'server/index.ts'], {
  stdio: 'inherit',
});

const viteProc = spawn('npx', ['vite'], {
  stdio: 'inherit',
});

const cleanup = () => {
  try {
    serverProc.kill('SIGTERM');
    viteProc.kill('SIGTERM');
  } catch {
    // Ignore cleanup errors
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
