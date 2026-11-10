<div align="center">
  <img src="public/assets/game_logo.png" alt="Indian Monopoly Logo" width="180" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);" />

  # 🇮🇳 Indian Monopoly (Monopoly-India-Game)

  **A modern, server-authoritative, full-stack multiplayer property trading board game featuring Indian economic mechanics, autonomous computer players (CPUs), configurable starting capital, offline LAN hosting, and cross-platform desktop runtime.**

  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101.svg?logo=socketdotio&logoColor=white)](https://socket.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Vitest](https://img.shields.io/badge/Vitest-3.2-FCC72B.svg?logo=vitest&logoColor=black)](https://vitest.dev/)
  [![Electron](https://img.shields.io/badge/Electron-45-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 🌟 Highlights & Key Features

- 🤖 **Autonomous Computer Players (CPUs)**:
  - Add between **0 and 3 intelligent computer opponents** directly from room creation.
  - Custom, editable names with automatic duplicate and collision validation.
  - **Strict Multi-Agent Parity**: CPUs run through the exact same authoritative game engine, rules, dice mechanisms, landing popups, and financial pipelines as human players—no cheating, no hidden rules, and no separate game modes.
  - **Sequential Turn Integrity & 2-Second CPU Gap**: Guaranteed 2-second pacing handoff between consecutive CPU turns and when transitioning between human and CPU players. No overlapping CPU execution; actions are fully resolved before handoff.
  - **Automatic Turn Completion Without Timer Dependency**: As soon as a CPU completes its actions and has no further decisions to make, it automatically finishes its turn via authoritative `END_TURN` without waiting for the normal turn timer to expire.
  - **Phase-Aware Timer Synchronization**: Player timers automatically pause during token walking animations across all connected devices and reset fresh upon entering genuinely new actionable steps (e.g. `PROPERTY_DECISION`).
  - Deterministic strategic decision-making: smart property acquisition, visiting-city house construction, bank-sold property reacquisition (inheriting existing houses), jail bail key management, and tiered Sell-to-Bank debt resolution.
- 💰 **Configurable Starting Cash Slider**:
  - Room hosts can dynamically tune economic velocity using an intuitive range slider from **₹5,000 to ₹50,000** in steps of **₹5,000** (default: **₹20,000**).
  - Statutory fiscal policies remain fixed: **₹3,000** START pass reward, **₹500** Central Jail bail, **₹500** GST / Wealth Levy, and 120-second emergency debt countdown.
- 🇮🇳 **Authentic Indian Economic Flavor**:
  - Prominent Indian cities: Mumbai, Delhi, Bengaluru, Kolkata, Chennai, Hyderabad, Ahmedabad, Jaipur, Pune, and more.
  - Reserve Bank of India (RBI) conventions, GST Checkposts, Civic Funds, Market Buzz events, and Infrastructure Wealth Levies.
- 🌐 **Authoritative Zero-Trust Multiplayer Architecture**:
  - Cryptographically fair dice rolling via rejection sampling (zero modulo bias).
  - Serialized action execution queue preventing race conditions and double-spending.
  - Works online, over zero-internet local Wi-Fi / mobile hotspots (LAN), or packaged as an Electron desktop app on macOS and Windows.
- 📱 **Zero-Scroll Responsive Design**:
  - Fluidly scales across mobile smartphones (scan QR code to join), tablets, and high-DPI desktop displays.

---

## ⚡ Quick Start: Host & Play on Local Wi-Fi (LAN)

### 1. Prerequisites
- **Node.js**: v20.0.0 or higher (v22+ recommended)
- **npm**: v10.0.0 or higher
- All players connected to the **same local Wi-Fi network or mobile hotspot**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/K-692/Monopoly-India-Game.git
cd Monopoly-India-Game

# Install dependencies
npm install
```

### 3. Run the Production LAN Host Server
```bash
npm run lan:host
```

The server compiles the optimized frontend bundle and prints your local access URL and shareable LAN IP:
```text
========================================
       INDIAN MONOPOLY LAN SERVER
========================================

Server Status: RUNNING

Local Access:
http://localhost:4173

LAN Access (Share with players on your Wi-Fi):
http://192.168.1.8:4173

Multiplayer Backend: READY
Transport: Socket.IO
Authoritative Game Engine: ACTIVE

Waiting for players...
========================================
```

### 4. Join & Play!
1. **Host**:
   - Open `http://localhost:4173` (or your printed LAN IP).
   - Enter your name and click **Customize Rules & Host**.
   - Adjust the **Starting Cash Slider** (₹5,000 to ₹50,000).
   - Add **0 to 3 Computer Players** (e.g. CPU1, Sherlock, Trader) and configure turn timer / player limits.
   - Click **Create Room**.
2. **Share Invite**:
   - Other players scan the on-screen **QR Code** directly with their smartphone cameras, or navigate to the displayed invite link / 6-character room code.
3. **Start Game**:
   - Supports 1 human host + computer players, or mixed human and computer lobbies! When ready, the host starts the match.

---

## 🏗️ Architecture & Multi-Agent Flow

```
                                  INDIAN MONOPOLY SYSTEM ARCHITECTURE
                               
      +──────────────────────────────────────────────────────────────────────────+
      │                         HOST SYSTEM (Node.js 20+)                        │
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
      │   │  - 120s Debt Resolution Timer & Monotonic State Sync             │   │
      │   +────────────┬─────────────────────────────────────────────────────+   │
      │                │                                                         │
      │   +────────────▼───────────────────────────────────+                     │
      │   │         Autonomous CPU Controller Layer        │                     │
      │   │  - Event-driven state machine lifecycle        │                     │
      │   │  - Token walking animation delay pacing        │                     │
      │   │  - Pure deterministic heuristics               │                     │
      │   │    * In-jail bailout & key utilization         │                     │
      │   │    * Smart property acquisition & inheritance  │                     │
      │   │    * Visiting-city house construction          │                     │
      │   │    * Tiered Sell-to-Bank debt liquidation      │                     │
      │   +────────────┬───────────────────────────────────+                     │
      │                │                                                         │
      │   +────────────▼─────────────────────────────────────────────────────+   │
      │   │                 Core Game Engine (applyGameCommand)              │   │
      │   │  - Validates human & CPU actions through identical pipeline      │   │
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

For complete mathematical definitions, state machine proofs, and research citation details, see [`flow.md`](flow.md).

---

## 💻 Tech Stack

| Layer | Technologies & Libraries | Architectural Role |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19**, **TypeScript 5.7** | Declarative component hierarchy, strict type safety, zero-scroll responsive UI. |
| **Styling & Design** | **Tailwind CSS 3.4**, **Lucide React** | Indian-heritage aesthetic palette (Terracotta, Parchment, Royal Navy, Gold), icon system. |
| **State Management** | **Zustand 5**, **TanStack Query 5** | Lightweight client state, decoupled toast store, room and game state synchronizers. |
| **Client UI Primitives**| **Radix UI**, **Canvas Confetti** | Accessible dialogs, range sliders, tooltips, tabs, and celebratory victory animations. |
| **Backend & Server** | **Node.js 20+**, **Express 5**, **tsx** | High-performance HTTP server serving static client assets and LAN discovery APIs. |
| **Real-Time Transport** | **Socket.IO 4.8** | Authoritative bidirectional WebSocket transport with room multiplexing and reconnect handling. |
| **Autonomous AI** | Pure Modular TypeScript Engine | Deterministic heuristic multi-agent decision models with natural animation synchronization. |
| **Desktop Runtime** | **Electron 45** | Native desktop wrapper with integrated background Node.js server for macOS and Windows. |
| **Testing & Quality** | **Vitest 3**, **Playwright**, **ESLint 9** | Unit, acceptance, integration, multi-agent pacing, and end-to-end verification. |

---

## 🛠️ CLI Commands & Development Scripts

| Command | Description |
| :--- | :--- |
| `npm run lan:host` | **Production LAN Host**: Builds client bundle (`dist/`) and launches authoritative server on `0.0.0.0:4173`. |
| `npm run lan:dev` | **Concurrent Dev**: Runs Node.js Socket.IO server (`tsx watch`) and Vite dev server (`5173`) with live hot-reloading. |
| `npm run dev` | Starts the Vite development server locally on port 5173. |
| `npm run server` | Starts the Node.js backend server directly using `tsx server/index.ts`. |
| `npm run build` | Compiles TypeScript and builds the production React application. |
| `npm run build:lan` | Builds the React frontend with `/` base path explicitly optimized for LAN hosting. |
| `npm run build:server` | Bundles the standalone server into `dist-server/index.cjs` using `esbuild`. |
| `npm run build:desktop` | Builds both the React LAN frontend (`dist/`) and the server bundle (`dist-server/index.cjs`). |
| `npm run desktop` | Builds desktop assets and launches the application inside native Electron. |
| `npm test` | Runs the full Vitest test suite (149 tests across 13 files). |
| `npm run test:watch` | Runs Vitest in interactive watch mode for test-driven development. |
| `npm run test:coverage`| Generates detailed test code coverage reports. |
| `npm run typecheck` | Strict TypeScript compiler validation across client, server, and tests (`tsc -b --noEmit`). |
| `npm run lint` | ESLint static analysis across all TypeScript and React files with zero errors. |
| `npm run preview` | Previews the production build locally via Vite. |

---

## 🎲 Game Rules & Economy Summary

| Feature | Mechanics & Rule Specification |
| :--- | :--- |
| **Starting Balance** | **Configurable via Slider**: ₹5,000 to ₹50,000 (step ₹5,000, default ₹20,000). Applied uniformly to all human & CPU players. |
| **Crossing START** | **Fixed Statutory Reward**: ₹3,000 credited automatically each time a player completes a circuit. |
| **Central Jail & Bail** | Players enter jail via "Go to Jail" square or card events. Release methods: **Bail Key Card**, **₹500 Statutory Bail**, or rolling doubles within 3 attempts. |
| **House Construction** | Monopoly holders can build houses on a city **only when actively visiting that city** on a subsequent turn. Uniform building distribution enforced across the color group. |
| **Sell to Bank** | Players can liquidate properties to the bank for 50% value to satisfy obligations. Reacquired bank properties preserve previously built houses. |
| **120s Debt Timer** | If cash balance drops into deficit after fees/rent, a 120-second countdown begins. The player must liquidate assets or declare bankruptcy. |
| **Turn Sync & Timers** | Timers pause during token movement animations across all connected clients. Resets to full duration upon entering new actionable phases (e.g. `PROPERTY_DECISION`). Mandatory 2-second pacing handoff delay before CPU turns. |

---

## 🤝 How to Contribute

We warmly welcome contributions from developers, game designers, and AI/game theory researchers!

1. **Fork the Repository**:
   Click **Fork** on [GitHub](https://github.com/K-692/Monopoly-India-Game) to create a copy in your account.
2. **Clone your fork**:
   ```bash
   git clone https://github.com/<your-username>/Monopoly-India-Game.git
   cd Monopoly-India-Game
   ```
3. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Development Guidelines**:
   - Write clean, modular, and type-safe TypeScript code.
   - Maintain zero-scroll responsive design and strict server-authoritative invariants.
   - Add descriptive comments to all new functions and state transitions.
   - Ensure computer players and human players always use the identical `applyGameCommand` interface.
5. **Verify Quality & Tests**:
   Ensure all checks pass cleanly before committing:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   npm run build:server
   ```
6. **Commit & Push**:
   ```bash
   git commit -m "feat: add support for custom trade negotiations"
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**:
   Submit a PR detailing your changes, architectural rationale, and test results.

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).
