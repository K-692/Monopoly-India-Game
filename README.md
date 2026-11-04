<div align="center">
  <img src="public/assets/game_logo.png" alt="Indian Monopoly Logo" width="180" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);" />
  
  # 🇮🇳 Indian Monopoly — Local Wi-Fi LAN Multiplayer Board Game

  [![CI](https://github.com/K-692/Monopoly-India-Game/actions/workflows/ci.yml/badge.svg)](https://github.com/K-692/Monopoly-India-Game/actions/workflows/ci.yml)
  [![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
  [![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8+-010101.svg)](https://socket.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4+-38b2ac.svg)](https://tailwindcss.com/)
  [![Vite](https://img.shields.io/badge/Vite-6.0+-646cff.svg)](https://vite.dev/)

  **Zero-cloud, zero-Internet, 100% private Wi-Fi LAN multiplayer for phones, tablets, and laptops!**
</div>

---

> **About the Project:**  
> **Indian Monopoly** is a modern, high-performance, zero-scroll property trading board game built for local network Wi-Fi multiplayer and offline play. Designed with **React 19, TypeScript, Tailwind CSS, Node.js 22, Express, and Socket.IO**, the system operates with **zero Firebase, zero external databases, and zero Internet connection required** during gameplay.
>
> A host player starts the lightweight Node.js server on their laptop, which automatically detects all private LAN IPv4 addresses, serves the production-built React frontend, and acts as the authoritative Socket.IO game server. Friends and family on the same Wi-Fi connect seamlessly from iPhones, Android devices, iPads, or laptops by scanning an on-screen QR code or entering a 6-character room code.

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
      │   │  - Cryptographic Dice (crypto.randomInt)                         │   │
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
1. **Host**: Open `http://localhost:4173` (or your LAN IP) in your browser. Click **Host Room**, customize your game rules, and click **Create Room**.
2. **Share Invite**:
   - Show the **on-screen QR Code** for mobile players to scan with their camera.
   - Or share the unique 6-character room code (e.g. `K9W2XP`).
   - Or click **Copy Invite Link** to share `http://192.168.1.8:4173/#/join/K9W2XP`.
3. **Guests**: Open the link or enter the 6-character code from any phone, tablet, or laptop on the Wi-Fi. Choose a display name, click **Ready**, and the host starts the match!

---

## 🎮 Game Features & Board Design

- **Authentic Indian Urban Economy**: 24 premier Indian metropolitan cities distributed strictly 6 per side with prices from ₹600 (Jaipur/Jodhpur) to ₹4,000 (Mumbai).
- **24-Step Green Shades Price Spectrum**: Grids are color-filled in an intuitive light mint to supreme midnight emerald spectrum with mathematically balanced luminance text for razor-sharp legibility.
- **12 Civic Fund & 12 Market Buzz Canonical Rules**: Fully indexed #1 to #12 in symmetrical center board panels with dynamic dice-roll highlights and zero scrolling.
- **3D Tumbling Dice Physics**: Web Audio sound synthesis with authentic rattling sounds, impact thuds, step-by-step 0.5s pawn traversal, and double-roll extra turns.
- **Authoritative Turn Timers**: Configurable 30s, 45s, 60s, or unlimited turn timer with automatic timeout actions (auto-roll, auto-decline, auto-end turn) so games never stall.
- **Pointed Comment Box**: Contextual in-board pointer dialogs for property acquisition, deed inspection, and mortgage management.
- **Central Jail & Zero-Rent Invariant**: Authentic red glowing barred jail space; incarcerated players collect ₹0 rent.
- **Universal Mortgages & Strict Tournament Bankruptcy**: Instant property liquidation to Reserve Bank upon complete insolvency; the last solvent tycoon wins!
- **Solo Offline Practice Mode**: Isolated sandbox mode for practicing strategies with zero network connections.

---

## 🛠️ CLI Commands & Development Scripts

| Command | Purpose |
|:---|:---|
| `npm run lan:host` | **Production Host**: Builds the production bundle (`dist/`) and starts the authoritative LAN server on `0.0.0.0:4173`. |
| `npm run lan:dev` | **Concurrent Dev**: Runs the Node.js Socket.IO server (`tsx watch`) and Vite dev server (`5173`) with live hot-reloading. |
| `npm run build:lan` | Builds the React frontend with `/` base path explicitly targeted for LAN hosting. |
| `npm run build` | Builds the React frontend with `/Monopoly-India-Game/` base path for GitHub Pages demo. |
| `npm run server` | Starts the Node.js server directly using `tsx server/index.ts`. |
| `npm test` | Runs the full Vitest suite (game engine invariants + real multi-client Socket.IO integration tests). |
| `npm run test:e2e` | Runs multi-browser Playwright E2E suite (including multi-client LAN room creation & gameplay). |
| `npm run typecheck` | Strict TypeScript validation across client, server, and tests (`tsc --noEmit`). |
| `npm run lint` | ESLint validation across all TypeScript and React files with zero warnings. |

---

## 📱 Cross-Device Compatibility & Network Setup

### Supported Devices & Browsers
- **Laptops / Desktops**: macOS (Safari, Chrome, Firefox, Edge, Brave), Windows 10/11 (Edge, Chrome, Firefox), Linux.
- **Smartphones**: Apple iOS 14+ (Mobile Safari, Chrome), Android 9+ (Chrome, Samsung Internet, Firefox).
- **Tablets**: iPadOS, Android tablets, Microsoft Surface.

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

## 🔧 Firewall & Wi-Fi Troubleshooting

### 1. Host Firewall Configuration
If guest devices cannot open `http://<HOST_IP>:4173`:
- **macOS**:
  1. Open **System Settings** ➔ **Network** ➔ **Firewall**.
  2. If Firewall is turned ON, click **Options...**.
  3. Ensure **node** or your terminal app is set to **"Allow incoming connections"**, or temporarily allow incoming connections for local port 4173.
- **Windows**:
  1. Open **Windows Defender Firewall** ➔ **Allow an app or feature through Windows Defender Firewall**.
  2. Click **Change settings**, find **Node.js JavaScript Runtime**, and check both **Private** and **Public** networks.
  3. Or run PowerShell as Administrator:
     ```powershell
     New-NetFirewallRule -DisplayName "Monopoly LAN Server" -Direction Inbound -LocalPort 4173 -Protocol TCP -Action Allow
     ```

### 2. Wi-Fi AP Isolation / Client Isolation
Some public, office, or university Wi-Fi networks enable **Client Isolation (AP Isolation)**, preventing connected devices from communicating with each other directly.
- **Fix / Best Alternative**: Turn on your laptop's **Mobile Hotspot** (or turn on Hotspot on your smartphone) and connect all playing devices to that hotspot.
- This creates an isolated local network with zero firewall blocks, ultra-low latency (<2ms), and **does not consume any mobile cellular data** during gameplay!

### 3. Server Lifecycle & In-Memory State
- Rooms, sessions, and active games are managed authoritatively in the Node.js server's memory.
- If the host laptop restarts or terminates the server process (`Ctrl+C`), active in-memory rooms are safely cleared.
- Refreshing a browser tab does **not** kick a player: each client receives a cryptographically secure reconnection token stored in `localStorage`, enabling instant session resumption upon reload.

---

## 🏛️ Authoritative Server Architecture Details

### REST API Endpoints
- `GET /api/health` ➔ Returns `{ status: "ok", uptime: number, activeRooms: number, activeGames: number, timestamp: string }`.
- `GET /api/lan-info` ➔ Returns detected host IPv4 addresses, port, primary LAN URL, and shareable hostnames.

### Typed Socket.IO Event Protocol
```typescript
// Client-to-Server Events
'player:register'  // Register or generate unique player session
'player:resume'    // Resume session via cryptographic reconnectToken
'room:create'      // Host creates room with custom rules (maxPlayers, turnTimer, startingCash)
'room:join'        // Guest joins room with 6-character invite code
'room:leave'       // Leave current lobby
'room:set-ready'   // Toggle player ready state
'room:start'       // Host initiates game once all players ready
'game:command'     // Submit turn action (ROLL_DICE, BUY_PROPERTY, END_TURN, etc.)
'reaction:send'    // Broadcast live emoji reactions
'ping'             // Heartbeat check

// Server-to-Client Broadcasts
'player:registered' // Session receipt with playerUid and reconnectToken
'room:state'        // Authoritative lobby roster, members, and readiness
'game:started'      // Match initialization notice and gameId
'game:state'        // Monotonically versioned authoritative game state
'game:event'        // Animation triggers (DICE_ROLLED, PAWN_MOVED, PROPERTY_BOUGHT)
'game:timer'        // Synchronized turn countdown seconds
'server:error'      // Structured error notification
'pong'              // Heartbeat reply
```

### Concurrency & Anti-Cheat Guarantees
1. **Server-Generated Cryptographic Dice**: Dice are rolled exclusively on the server using `crypto.randomInt(1, 7)`. Client tampering with dice rolls is mathematically impossible.
2. **Sequential Action Queue**: Every active match maintains a strict FIFO promise queue. Rapid or simultaneous incoming commands are processed sequentially, eliminating race conditions.
3. **Idempotent Command Deduplication**: Each client action includes a unique `commandId`. Retransmitted actions are cached and return the cached outcome without duplicate state mutations.
4. **Authoritative Turn Countdown**: The server runs an authoritative 1-second interval timer. When a player's timer expires, the server automatically takes a deterministic action (auto-roll if awaiting roll, auto-decline if buying, auto-end turn if managing), keeping matches fast and uninterrupted.

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
   npm run test:e2e
   npm run build:lan
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
