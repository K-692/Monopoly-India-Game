/**
 * Indian Monopoly - Build Desktop Distribution Bundles
 *
 * Compiles the React application with LAN base path ('/')
 * and bundles the server code into dist-server/index.cjs via esbuild.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('Building Indian Monopoly desktop bundles...');

try {
  // Step 1: Build client with Vite
  console.log('[1/2] Compiling React client (LAN production mode)...');
  execSync('npm run build:lan', { cwd: rootDir, stdio: 'inherit' });

  // Step 2: Bundle Node.js server with esbuild
  console.log('[2/2] Bundling authoritative server into dist-server/index.cjs...');
  execSync('npm run build:server', { cwd: rootDir, stdio: 'inherit' });

  console.log('✓ All desktop build targets successfully generated.');
} catch (error) {
  console.error('Desktop build failed:', error);
  process.exit(1);
}

