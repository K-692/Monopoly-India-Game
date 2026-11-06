<div align="center">
  <img src="public/assets/game_logo.png" alt="Indian Monopoly Logo" width="180" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);" />
  
  # 🇮🇳 Indian Monopoly — Standalone Desktop & Local Wi-Fi LAN Multiplayer Board Game

  [![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
  [![Platform: macOS & Windows](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Web-blue.svg)](#-desktop-apps--download)
  [![Release: v1.1.0](https://img.shields.io/badge/Release-v1.1.0-orange.svg)](https://github.com/K-692/Monopoly-India-Game/releases/tag/v1.1.0)
  [![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
  [![Electron](https://img.shields.io/badge/Electron-45+-47848F.svg)](https://www.electronjs.org/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8+-010101.svg)](https://socket.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4+-38b2ac.svg)](https://tailwindcss.com/)
  [![Vite](https://img.shields.io/badge/Vite-6.0+-646cff.svg)](https://vite.dev/)
  [![Tests](https://img.shields.io/badge/Vitest-101%20Passing-brightgreen.svg)](https://vitest.dev/)

  **Standalone macOS (.dmg) & Windows (.exe) desktop applications and browser play over local Wi-Fi with zero configuration!**
</div>

---

> **About the Project:**  
> **Indian Monopoly** is a modern, server-authoritative, zero-scroll property trading board game built for cross-platform local network Wi-Fi multiplayer and standalone desktop play on **macOS and Windows**. Engineered with **React 19, TypeScript, Tailwind CSS, Node.js, Express, Socket.IO, and Electron**, the application delivers an authoritative real-time multiplayer experience without requiring external cloud accounts or third-party game services during gameplay.
>
> In addition to browser play, Indian Monopoly packages as installable native desktop binaries for **macOS (`.dmg`)** and **Windows (`.exe`)**. The desktop binary self-hosts the authoritative LAN engine inside a sandboxed Electron shell, allowing any host to launch a game server with one double-click and invite friends on phones, tablets, or other computers to connect instantly over local Wi-Fi!

---

## 💻 Desktop Apps & Download

Native installable applications bundle the complete game frontend, embedded Node.js backend, and authoritative Socket.IO server into a single standalone executable. No manual Node.js, npm, or terminal commands are required for players.

<div align="center" style="margin: 24px 0;">
  <a href="https://github.com/K-692/Monopoly-India-Game/releases/tag/v1.1.0">
    <img src="https://img.shields.io/badge/Download_for-macOS_(.dmg)-007AFF?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS" height="42" />
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://github.com/K-692/Monopoly-India-Game/releases/tag/v1.1.0">
    <img src="https://img.shields.io/badge/Download_for-Windows_(.exe)-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Download for Windows" height="42" />
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://github.com/K-692/Monopoly-India-Game/releases/tag/v1.1.0">
    <img src="https://img.shields.io/badge/GitHub-Release_v1.1.0-24292e?style=for-the-badge&logo=github&logoColor=white" alt="Release v1.1.0" height="42" />
  </a>
</div>

### 📦 Official Installer Packages (v1.1.0)

| Platform | Target Architecture | Package Type | Direct Download Link | Format |
|:---|:---|:---|:---|:---|
| **macOS** | Apple Silicon (M1/M2/M3/M4) | Native DMG Installer | [📥 **Indian-Monopoly-1.1.0-arm64.dmg**](https://github.com/K-692/Monopoly-India-Game/releases/download/v1.1.0/Indian-Monopoly-1.1.0-arm64.dmg) | `.dmg` |
| **macOS** | Intel x64 | Native DMG Installer | [📥 **Indian-Monopoly-1.1.0-x64.dmg**](https://github.com/K-692/Monopoly-India-Game/releases/download/v1.1.0/Indian-Monopoly-1.1.0-x64.dmg) | `.dmg` |
| **Windows** | 64-bit (x64) | NSIS Executable Installer | [📥 **Indian-Monopoly-Setup-1.1.0.exe**](https://github.com/K-692/Monopoly-India-Game/releases/download/v1.1.0/Indian-Monopoly-Setup-1.1.0.exe) | `.exe` |
| **All Platforms** | Universal | Releases & Changelogs | [📦 **Browse All Release Assets**](https://github.com/K-692/Monopoly-India-Game/releases/tag/v1.1.0) | GitHub |

### 🚀 Quick Installation Guide

#### macOS Installation:
1. Download the `.dmg` file for your Mac architecture ([Apple Silicon ARM64](https://github.com/K-692/Monopoly-India-Game/releases/download/v1.1.0/Indian-Monopoly-1.1.0-arm64.dmg) or [Intel x64](https://github.com/K-692/Monopoly-India-Game/releases/download/v1.1.0/Indian-Monopoly-1.1.0-x64.dmg)).
2. Double-click the downloaded `.dmg` file to open the installer volume.
3. Drag **Indian Monopoly** into your `Applications` directory.
4. Launch the application from Spotlight or Launchpad.
   > *Note for first launch: If macOS Gatekeeper displays an unverified developer prompt, right-click `Indian Monopoly.app`, click **Open**, and confirm, or allow it under System Settings > Privacy & Security.*

#### Windows Installation:
1. Download [**Indian-Monopoly-Setup-1.1.0.exe**](https://github.com/K-692/Monopoly-India-Game/releases/download/v1.1.0/Indian-Monopoly-Setup-1.1.0.exe).
2. Double-click the `.exe` setup file to start the installation wizard.
3. Select your installation folder and choose whether to create desktop and Start Menu shortcuts.
4. Click **Install**, then click **Finish** to immediately launch the game.

#### Mobile & Browser (Zero Install Required):
1. The host player opens the desktop application (or runs the local LAN server on their computer).
2. Other players connect from their phone (iPhone/Android), tablet (iPad), or laptop on the same local Wi-Fi by scanning the host's on-screen QR Code or typing the LAN IP address (e.g. `http://192.168.1.8:4173`).

---

### How Local LAN Desktop Multiplayer Works:
1. **Host Launches Native App**: Double-click `Indian Monopoly.app` or `Indian Monopoly.exe`.
2. **Server Self-Initializes**: The application starts its embedded authoritative Express + Socket.IO server on an auto-discovered port (starting at `4173`).
3. **Wi-Fi Discovery**: The host sees their LAN IP and an on-screen QR code (e.g. `http://192.168.1.50:4173`).
4. **Friends Connect**: Friends connect from phones (iPhone / Android), tablets (iPad), or laptops on the same Wi-Fi network without installing anything extra.
5. **Cross-Platform Play**: Real-time state synchronizes authoritatively across all connected clients.

---

```
                                  INDIAN MONOPOLY LAN ARCHITECTURE
                                 
      +──────────────────────────────────────────────────────────────────────────+
      │                         HOST LAPTOP (Node.js 22+)                        │
      │                                                                          │
      │   +──────────────────────────+        +──────────────────────────────+   │
      │   │   Express HTTP Server    │        │      Socket.IO Engine        │   │
      │   │     Port: 0.0.0.0:4173   │        │     Port: 0.0.0.0:4173       │   │
      │   │  Serves: dist/ (SPA app) │        │  Channel: ws://<LAN_IP>:4173 │   │
      │   +────────────┬─────────────+        +──────────────┬───────────────+   │
      │                │                                     │                   │
      │   +────────────▼─────────────────────────────────────▼───────────────+   │
      │   │             Authoritative In-Memory Game Manager                 │   │
      │   │  - Unbiased Random First Player Selection                        │   │
      │   │  - Cryptographic Fair Dice (Rejection Sampling, Zero Modulo Bias)│   │
      │   │  - Serialized Action Queue (Zero Race Conditions)                │   │
      │   │  - 30s Server Turn Timer & Auto-Timeouts                         │   │
      │   │  - Monotonic State Versioning (State Sync)                       │   │
      │   │  - In-Memory Rooms & Cryptographic Reconnect Tokens              │   │
      │   +──────────────────────────────────────────────────────────────────+   │
      +─────────────────────────▲──────────────────────────────▲─────────────────+
                                │                              │
                Wi-Fi HTTP & WS │              Wi-Fi HTTP & WS │
                (No Internet!)  │              (No Internet!)  │
                                │                              │
     +──────────────────────────┴────+     +───────────────────┴──────────────+
     │       GUEST A (Phone)         │     │         GUEST B (Laptop)         │
     │  Safari / Chrome on Android   │     │        Chrome / Edge / Firefox   │
     │  http://192.168.1.8:4173      │     │        http://192.168.1.8:4173   │
     │  Joined via QR Code / Link    │     │        Joined via 6-char Code    │
     +───────────────────────────────+     +──────────────────────────────────+
```

---

## 🎲 Standardized Rules & Gameplay Mechanics (v1.1.0 Updates)

Indian Monopoly v1.1.0 establishes authoritative, competitive rules across all client platforms:

- **Fixed Room Creation Defaults**:
  - **Starting Cash**: Exactly **₹20,000**.
  - **Pass Start Reward**: Exactly **₹3,000** (awarded immediately as the player token crosses Start space 0, with actor-specific private notification).
  - **Center Jail Bail**: Exactly **₹500**.
  - *All values are locked and authoritatively enforced by the host server, preventing client-side overrides.*
- **120-Second Financial Resolution Timer**:
  - Debtors receive a full **120 seconds** to resolve mandatory liabilities.
  - Server-stamped `expiresAt` deadline prevents reset on refresh or reconnection.
  - Non-destructive **"Check Board"** inspection mode allows full board view without pausing or resetting the debt countdown.
- **Sell-to-Bank Mechanism (Replaces Mortgage)**:
  - Players sell cities or infrastructure to the bank for an immediate 50% cash payout (50% base property price + 50% development value).
  - Title ownership is instantly cleared (`UNOWNED`).
  - **Houses are preserved**: Existing buildings remain physically on the grid and are not demolished.
  - **Acquisition by Subsequent Players**: Any player subsequently landing on the sold property can acquire it for the **exact recorded bank sale payout**, instantly inheriting all existing developments.
  - All player-facing terminology updated: *Sell to Bank*, *Sale Payout*, *Acquire from Bank*, *Available for Acquisition*.
- **Central Jail Key Redemption**:
  - Incarcerated players with a **Bail Key** can select **Use Key** to exit jail instantly and proceed directly to roll the dice.
  - Standard options (*Pay ₹500 Bail* or *Roll for Doubles*) remain available.
- **Standardized Checkpost Fees**:
  - **GST Checkpost (Space #8)**: Fixed at **₹500**.
  - **Infrastructure Wealth Levy (Space #37)**: Fixed at **₹500**.
- **Minimalist Board Grid Aesthetic**:
  - Monetary price strings are removed from the board tiles to eliminate visual clutter. Single-line city names and clean status tags (`IN BANK`, `BLOCKED`) enhance visibility. Prices remain fully accessible via deeds and purchase popups.
- **Instant Match Conclusion on Surrender / Disqualification**:
  - When any active player surrenders or exceeds the 120-second resolution timer, the match terminates immediately.
  - The remaining player with the **highest cash balance** is declared the winner (net worth acts as tie-breaker).
  - All clients receive the final Victory Scoreboard modal detailing player ranks, final cash, and net worth.

---

## ⚡ Quick Start: Host & Play on Wi-Fi

### 1. Prerequisites
- **Node.js**: v22.0.0 or higher
- **npm**: v10.0.0 or higher
- All devices connected to the **same Wi-Fi router or mobile hotspot**

### 2. Installation
```bash
# Clone repository
git clone https://github.com/K-692/Monopoly-India-Game.git
cd Monopoly-India-Game

# Install dependencies
npm install
```

### 3. Run the Production LAN Host Server
```bash
npm run lan:host
```

The server automatically builds the optimized frontend bundle for LAN (`/` base path) and prints your local access URLs and shareable LAN addresses:

```text
========================================
       INDIAN MONOPOLY LAN SERVER
========================================

Server Status: RUNNING

Local Access:
http://localhost:4173

LAN Access (Share with other players on your Wi-Fi):
http://192.168.1.8:4173

Multiplayer Backend: READY
Transport: Socket.IO
Authoritative Game Engine: ACTIVE

Waiting for players...
========================================
```

### 4. Join & Play!
1. **Host**: Open `http://localhost:4173` (or your LAN IP) in your browser. Set your tycoon name, click **Customize Rules & Host**, and click **Create Room**.
2. **Share Invite**:
   - Show the **on-screen QR Code** for mobile players to scan with their camera.
   - Or share the unique 6-character room code (e.g. `K9W2XP`).
   - Or click **Copy Invite Link** to share `http://192.168.1.8:4173/#/join/K9W2XP`.
3. **Guests**: Open the link or enter the 6-character code from any phone, tablet, or laptop on the Wi-Fi. Choose a player name, click **Ready**, and the host starts the match!

---

## 🛠️ CLI Commands & Development Scripts

| Command | Purpose |
|:---|:---|
| `npm run desktop` | **Native Desktop Launcher**: Builds production assets and runs the native Electron desktop application with embedded local server. |
| `npm run package:installers` | **Automated Installer Packager**: Interactive Node.js script verifying icons, compiling client/server bundles, and invoking electron-builder. |
| `npm run dist:mac` | **Package macOS DMG**: Compiles and packages the installable universal `.dmg` installer for Apple Silicon and Intel Macs. |
| `npm run dist:win` | **Package Windows EXE**: Compiles and packages the installable NSIS `.exe` installer for 64-bit Windows. |
| `npm run dist:all` | **Package Both Platforms**: Packages both macOS DMG and Windows EXE distribution binaries. |
| `npm run build:desktop` | Builds both the React LAN frontend (`dist/`) and the standalone server bundle (`dist-server/index.cjs`). |
| `npm run lan:host` | **Production Host**: Builds the production bundle (`dist/`) and starts the authoritative LAN server on `0.0.0.0:4173`. |
| `npm run lan:dev` | **Concurrent Dev**: Runs the Node.js Socket.IO server (`tsx watch`) and Vite dev server (`5173`) with live hot-reloading. |
| `npm run build:lan` | Builds the React frontend with `/` base path explicitly targeted for LAN hosting. |
| `npm run build` | Builds the React frontend for production distribution. |
| `npm run server` | Starts the Node.js server directly using `tsx server/index.ts`. |
| `npm test` | Runs the full Vitest suite (101 passing tests covering engine invariants, dice fairness, Sell-to-Bank mechanics, 120s timer, Start privacy, and immediate match termination). |
| `npm run typecheck` | Strict TypeScript validation across client, server, and tests (`tsc -b --noEmit`). |
| `npm run lint` | ESLint validation across all TypeScript and React files with zero warnings. |

---

## 📱 Cross-Device Compatibility & Network Setup

### Supported Devices & Viewports
- **Mobile Phones**: iPhone SE (320×568), iPhone 8 (375×667), iPhone 13/14 (390×844), iPhone 14/15 Pro Max (430×932), Android devices.
- **Tablets**: iPad Portrait (768×1024), iPad Landscape (1024×768), Surface tablets.
- **Laptops & Desktops**: 1366×768, 1440×900, 1920×1080 (Full HD), 2K, 4K displays.

### How to Find Your Host IP Address Manually
If you need to verify your host computer's IPv4 address manually:
- **macOS**:
  ```bash
  ipconfig getifaddr en0    # Wi-Fi
  # or
  ipconfig getifaddr en1    # Ethernet / Alternate
  ```
- **Windows**:
  ```powershell
  ipconfig
  # Look for "IPv4 Address" under your Wireless LAN adapter (e.g. 192.168.1.X)
  ```
- **Linux**:
  ```bash
  ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1'
  ```

---

## 🤝 How to Contribute

We warmly welcome contributions from developers, game designers, and open-source enthusiasts!

1. **Fork the Repository**: Click the **Fork** button at the top right of this page.
2. **Clone your fork**:
   ```bash
   git clone https://github.com/<your-username>/Monopoly-India-Game.git
   cd Monopoly-India-Game
   ```
3. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Make Your Changes**:
   - Write clean, type-safe TypeScript code.
   - Maintain zero-scroll responsive design and strict server-authoritative invariants.
   - Add comments for maintainability and clear referencing.
5. **Verify the Test Suite**:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
   Ensure all tests pass cleanly with zero warnings or errors.
6. **Commit & Push**:
   ```bash
   git commit -m "feat: add amazing feature"
   git push origin feature/amazing-feature
   ```
7. **Submit a Pull Request**: Open a PR with a clear summary of your enhancements, architecture rationale, and screenshots.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for complete details.
