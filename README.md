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
  [![Tests](https://img.shields.io/badge/Vitest-51%20Passing-brightgreen.svg)](https://vitest.dev/)

  **Zero-cloud, zero-Internet, 100% private Wi-Fi LAN multiplayer for phones, tablets, and laptops!**
</div>

---

> **About the Project:**  
> **Indian Monopoly** is a modern, high-performance, zero-scroll property trading board game built for local network Wi-Fi multiplayer and offline play. Designed with **React 19, TypeScript, Tailwind CSS, Node.js 22, Express, and Socket.IO**, the system operates with **zero Firebase, zero external cloud dependencies, and zero Internet connection required** during gameplay.
>
> A host player starts the lightweight Node.js server on their laptop, which automatically detects all private LAN IPv4 addresses, serves the production-built React frontend, and acts as the authoritative Socket.IO game server. Friends and family on the same Wi-Fi connect seamlessly from iPhones, Android devices, iPads, or laptops by scanning an on-screen QR code or entering a 6-character room code.

---

## 🎲 Core Game Rules & Invariants

- **Authoritative Random Starting Player**: Every new game session randomly selects one eligible player using cryptographically unbiased server-side RNG. The starting player and turn order are persisted and identical across all clients; page refreshes or reconnects never change the starting player.
- **Fair & Unbiased Cryptographic Dice Rolls**: Server-generated dice utilize rejection sampling on OS entropy, completely eliminating modulo bias. Mathematically verified via Pearson's Chi-Square Goodness-of-Fit test across 12,000+ rolls ($\chi^2 < 15.086$ at $\alpha = 0.01$).
- **Strict Single-Roll Invariant**: If a player rolls doubles outside jail, they do **not** receive another chance to roll. Only one roll is permitted per turn.
- **Jail & "Try Double" Mechanics**: An incarcerated player can attempt to roll doubles on each of their first three eligible turns. Rolling doubles releases them immediately and advances them by the roll sum without granting an extra turn. On the 4th eligible turn, automatic release is granted.
- **Viewport & Collision-Aware City Purchase Popup**: Dynamic calculation via `usePopupPosition` guarantees the purchase prompt never crosses browser boundaries or bottom margins, remaining completely visible on all viewports.
- **Strict Display Timing**: Purchase prompts appear **strictly after** the player token finishes walking to the destination grid, never mid-movement.
- **Deduplicated Bottom-Left Notifications**: Only 1 active notification at a time, strictly deduplicated across network events and state updates by `eventId`, accompanied by a subtle alert chime.
- **Landing Page Tycoon Identity Setup**: New players configure their name (2–20 characters) and token color directly on the landing page before creating or joining multiplayer rooms.

---

## 🏛️ Comprehensive Gameplay Logic & Financial Systems

### 1. Authoritative Random First Player Selection
- At match start, the backend executes `crypto.randomInt(0, memberCount)` to select the initial player.
- The player order array is rotated to start with the selected player, synchronizing turn order across all devices.
- State is immutable against reloads: reconnecting clients receive the active session state without re-randomizing.

### 2. Fair Cryptographic Dice Engine & 3D Rolling
- **Rejection Sampling**: Avoids modulo bias ($252/6 = 42$ uniform probability per face).
- **Statistical Goodness-of-Fit**: Chi-square test on 6-face uniformity and 36-pair independence.
- **Unique Roll IDs & Idempotency**: Each roll is stamped with a unique `rollId`, rejecting duplicate command requests.
- **Modern 3D Visuals**: Tactile ivory gradient cubes, deep rounded bevels, signature Terracotta Crimson 1-pip styling, dynamic 3D tumbling, and physical landing bounce settle (`animate-dice-settle`). Full accessibility support via `@media (prefers-reduced-motion: reduce)`.
- **Movement Gating**: Token stepping begins only after the roll finishes settling on the authoritative outcome.

### 3. Collision-Aware City Purchase Popup (`usePopupPosition`)
- **Viewport Clamping**: Measures board tile bounding rect and viewport space. For bottom-row tiles (spaces 0 to 10), the popup renders above the bottom grid into the lower board area, strictly clamped within `MIN_MARGIN = 12px`.
- **Display Sequence**:
  1. Player rolls dice.
  2. 3D dice tumble and settle on server result.
  3. Token walks step-by-step through the board.
  4. Token reaches destination grid.
  5. Landing resolves and purchase popup appears (if eligible unowned city).
- **Turn Duration Gating**: Stays open until the player acts or the turn timer runs out (auto-decline).

### 4. Single-Active Notification System & Sound Normalization
- **Strict 1-Notification Invariant**: At most 1 active notification box at any time (`toasts: [newToast]`).
- **Cross-Channel Deduplication**: Prevents duplicates between Socket.IO game events and local state triggers via `eventId` tracking.
- **Debounced Balance Warnings**: Uses `dedupKey` to prevent spamming insufficient balance warnings within 3.5 seconds.
- **Subtle Alert Chime**: Dedicated dual-tone sine wave chime (E5 $\to$ G#5) replacing harsh clangs and eliminating jail sound leaks.

### 5. Landing Page Tycoon Identity Setup
- When visiting `PlayPage.tsx`, missing usernames display an inline Tycoon Identity Card.
- Enforces 2 to 20 trimmed characters with permitted letters, numbers, spaces, hyphens, and underscores.
- Visual token color picker from the 6 canonical player colors.
- Room creation and joining are locked until identity is confirmed.
- Once configured, displays a sleek player badge with a quick-edit button.

### 6. Jail Mechanics & "Try Double" System
- **Three Double Attempts**: An incarcerated player may attempt to roll doubles on each of their first three eligible turns.
- **Immediate Escape with Movement**: Rolling doubles immediately releases the player and advances their token by the dice roll total.
- **Extra Turn Suppression**: Rolling doubles while escaping jail **never grants an additional turn**.
- **Incarcerated Stasis on Failure**: Non-double rolls keep the player in Central Jail with zero movement.
- **Automatic 4th Eligible Turn Release**: A player who fails all three attempts is automatically released at the beginning of their 4th eligible turn without needing to roll Try Double.

### 7. Distinct Airport Visiting Tariffs
- **Aviation Tariff Scaling**: Landing on an airport owned by another player costs:
  - **1 Airport Owned**: ₹1,000
  - **2 Airports Owned (Both)**: ₹2,500
- **Railways Comparison**: CST Mumbai (#5) and Howrah Railway (#15) scale at ₹250 and ₹500.
- **Immunity Conditions**: Rent is waived if the owner is in jail, the airport is mortgaged, or the owner is in the `BLOCKED` state.

### 8. Complete Mortgaging & Financial Resolution System
- **Development-Inclusive Valuation Formula**:
  $$\text{Mortgage Payout} = \min\left(P_{\text{base}}, \left\lfloor 0.5 \times P_{\text{base}} + 0.5 \sum_{i=1}^{B} C_{\text{build}}\right\rfloor\right)$$
- **Development Asset Preservation**: Physical developments are not demolished during mortgage; they remain attached to the deed.
- **Exact Payout Reacquisition**: The redemption cost strictly equals the exact mortgage payout originally received ($C_{\text{reacquire}} = V_{\text{payout\_received}}$).
- **Mandatory Financial Resolution Window**: When debt exceeds liquid cash, a resolution window opens to mortgage properties or surrender.
- **Surrender / Give Up & BLOCKED Property State**: Choosing "Give Up" transfers remaining cash to creditor, disqualifies the debtor, and transitions debtor properties to `BLOCKED` (permanent board feature, generates ₹0 rent, cannot be purchased or traded).

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
| `npm run lan:host` | **Production Host**: Builds the production bundle (`dist/`) and starts the authoritative LAN server on `0.0.0.0:4173`. |
| `npm run lan:dev` | **Concurrent Dev**: Runs the Node.js Socket.IO server (`tsx watch`) and Vite dev server (`5173`) with live hot-reloading. |
| `npm run build:lan` | Builds the React frontend with `/` base path explicitly targeted for LAN hosting. |
| `npm run build` | Builds the React frontend for production distribution. |
| `npm run server` | Starts the Node.js server directly using `tsx server/index.ts`. |
| `npm test` | Runs the full Vitest suite (51 passing tests covering game engine invariants, fairness, statistical tests, mortgages, and multi-client Socket.IO integration). |
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
