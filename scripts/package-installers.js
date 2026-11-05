/**
 * Indian Monopoly - Desktop Installer Packager Script
 *
 * Automates pre-flight verification, frontend build, server compilation,
 * and Electron Builder packaging for macOS (.dmg) and Windows (.exe).
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetArg = process.argv[2] || 'current'; // 'mac', 'win', 'all', or 'current'

console.log('====================================================');
console.log('       INDIAN MONOPOLY — DESKTOP PACKAGER           ');
console.log('====================================================');
console.log(`Target Platform: ${targetArg}`);
console.log(`Working Directory: ${rootDir}`);

// Step 1: Verify environment
console.log('\n[1/4] Running pre-flight checks...');
const iconPath = path.join(rootDir, 'build/icon.png');
if (!fs.existsSync(iconPath)) {
  console.error('Error: build/icon.png not found. Copying game logo fallback...');
  fs.mkdirSync(path.join(rootDir, 'build'), { recursive: true });
  fs.copyFileSync(path.join(rootDir, 'public/assets/game_logo.png'), iconPath);
}
console.log('✓ Icon verified at build/icon.png');

// Step 2: Build desktop production bundle
console.log('\n[2/4] Building production React client & Node.js LAN server bundle...');
try {
  execSync('npm run build:desktop', { cwd: rootDir, stdio: 'inherit' });
  console.log('✓ Desktop bundles built successfully');
} catch (err) {
  console.error('Failed to build desktop bundles:', err);
  process.exit(1);
}

// Step 3: Determine builder command
let builderCmd = 'npx electron-builder';
if (targetArg === 'mac') {
  builderCmd += ' --mac dmg';
} else if (targetArg === 'win') {
  builderCmd += ' --win nsis';
} else if (targetArg === 'all') {
  builderCmd += ' -mw';
} else {
  // Current platform default
  if (process.platform === 'darwin') {
    builderCmd += ' --mac dmg';
  } else if (process.platform === 'win32') {
    builderCmd += ' --win nsis';
  } else {
    builderCmd += ' --dir';
  }
}

// Step 4: Package with Electron Builder
console.log(`\n[3/4] Packaging installers with command: ${builderCmd}...`);
try {
  execSync(builderCmd, { cwd: rootDir, stdio: 'inherit' });
  console.log('✓ Packaging completed successfully');
} catch (err) {
  console.error('Packaging failed:', err);
  process.exit(1);
}

// Step 5: Summary of generated release files
console.log('\n[4/4] Release Directory Contents:');
const releaseDir = path.join(rootDir, 'release');
if (fs.existsSync(releaseDir)) {
  const files = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.dmg') || f.endsWith('.exe'));
  if (files.length > 0) {
    files.forEach((f) => {
      const stats = fs.statSync(path.join(releaseDir, f));
      const mb = (stats.size / (1024 * 1024)).toFixed(1);
      console.log(` - ${f} (${mb} MB)`);
    });
  } else {
    console.log(' (No .dmg or .exe files found directly in release/)');
  }
}

console.log('\n====================================================');
console.log('Package complete! Installers ready in release/ directory.');
console.log('====================================================\n');
