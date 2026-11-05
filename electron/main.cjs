/**
 * Indian Monopoly - Standalone Desktop Application
 * Electron Main Process
 *
 * Integrates the authoritative local Node.js + Express + Socket.IO server directly
 * inside the native desktop application for macOS and Windows.
 * Bundles all dependencies with zero external prerequisites.
 */

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let lanServerInstance = null;
let activePort = 4173;

// Resolve production dist path
function getDistPath() {
  const candidates = [
    path.join(__dirname, '../dist'),
    path.join(process.resourcesPath, 'dist'),
    path.join(process.resourcesPath, 'app.asar/dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
      return p;
    }
  }
  return path.join(__dirname, '../dist');
}

// Find an available local port starting from 4173
function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(startPort, '0.0.0.0', () => {
      server.close(() => resolve(startPort));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

async function startEmbeddedServer() {
  try {
    const distPath = getDistPath();
    activePort = await findAvailablePort(4173);

    // Import compiled server bundle
    let createLanServer;
    const compiledServerPath = path.join(__dirname, '../dist-server/index.cjs');
    if (fs.existsSync(compiledServerPath)) {
      ({ createLanServer } = require(compiledServerPath));
    } else {
      // Fallback for direct node/ts execution
      ({ createLanServer } = require('../dist-server/index.cjs'));
    }

    lanServerInstance = createLanServer({
      port: activePort,
      distPath,
    });

    await new Promise((resolve, reject) => {
      lanServerInstance.httpServer.listen(activePort, '0.0.0.0', () => {
        console.log(`[Desktop Server] Listening on 0.0.0.0:${activePort}`);
        resolve();
      });
      lanServerInstance.httpServer.on('error', reject);
    });

    return activePort;
  } catch (err) {
    console.error('[Desktop Server] Failed to start embedded LAN server:', err);
    return activePort;
  }
}

function createWindow(port) {
  const iconPath = path.join(__dirname, '../public/assets/game_logo.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Indian Monopoly — LAN Multiplayer',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#070A13',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const appUrl = `http://localhost:${port}`;
  mainWindow.loadURL(appUrl).catch((err) => {
    console.error('[Desktop Window] Failed to load application URL:', err);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  const port = await startEmbeddedServer();
  createWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(activePort);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (lanServerInstance && lanServerInstance.httpServer) {
    try {
      if (lanServerInstance.cleanupInterval) {
        clearInterval(lanServerInstance.cleanupInterval);
      }
      lanServerInstance.httpServer.close();
    } catch {
      // Ignore on exit
    }
  }
});
