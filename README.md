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
   - Adjust the **Starting Cash Slider** (₹5,000 to ₹50,000), start crossing reward, and turn timer.
   - Click **Create Room** (fixed 6-player capacity, creates you as the human host).
2. **Waiting Lobby & Multi-Agent Seating**:
   - Invite friends using the on-screen **QR Code** or 6-character room code (up to 6 total slots).
   - Use the host-only **Add CPU** button to seat autonomous computer players in open slots.
   - Rename or remove CPUs on the fly directly from the lobby seats grid.
3. **Ready Up & Start**:
   - All human players (including the host) click **Ready Up**. CPUs are automatically ready!
   - When at least 2 total players are present and all human players are ready, the host clicks **Start Game**.

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
      │   │  - Intelligent Turn & Jail Timeout Auto-Resolution & Liquidation   │   │
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
| `npm test` | Runs the full Vitest test suite (294 tests across 23 test files). |
| `npm run test:watch` | Runs Vitest in interactive watch mode for test-driven development. |
| `npm run test:coverage`| Generates detailed test code coverage reports. |
| `npm run typecheck` | Strict TypeScript compiler validation across client, server, and tests (`tsc -b --noEmit`). |
| `npm run lint` | ESLint static analysis across all TypeScript and React files with zero errors. |
| `npm run preview` | Previews the production build locally via Vite. |

---

## 🎲 Game Rules & Economy Summary

| Feature | Mechanics & Rule Specification |
| :--- | :--- |
| **6-Slot Waiting Lobby** | **Fixed 6-Player Capacity**: Open slots can be filled by any mix of humans and CPUs (e.g. 1 human + 1 CPU, 2 humans + 4 CPUs, etc.). Never allows exceeding 6 players. |
| **Host CPU Management** | **Lobby-Centric Controls**: Host can add autonomous CPUs to open slots, rename CPUs with unique custom names, or remove CPUs to free slots with real-time Socket.IO synchronization. |
| **Human Readiness** | **Universal Ready Requirement**: All human players (including the host) must explicitly mark themselves ready before the game can start. CPUs are automatically ready. |
| **Game Start Conditions** | Requires at least **2 total players** and **100% human readiness** before the host can start. Explanatory feedback dynamically explains unready blockers. |
| **Starting Balance** | **Configurable via Slider**: ₹5,000 to ₹50,000 (step ₹5,000, default ₹20,000). Applied uniformly to all human & CPU players. |
| **Crossing START** | **Host-Configurable Salary**: Selectable options of ₹1,000, ₹2,000, or ₹3,000 (default ₹2,000) credited each circuit or via Festival Travel card. |
| **Winner & Net Worth** | Match champion is determined strictly by **highest Net Worth** (Cash + Total Owned Assets - Outstanding Liabilities), tie-broken by remaining Cash Balance, then Player UID. |
| **Dynamic Net Worth Rankings** | Player cards in the left panel feature live authoritative rank badges (**#1**, **#2**, **#3**, **#4**, **#5**, **#6**) based on Net Worth. Ties are broken strictly by original room-joining order (the earlier joined player receives the better rank), guaranteeing unique, sequential rank badges for all players across both human and CPU participants. |
| **Player Cards & Net Worth** | Left information panel displays prominent liquid Cash Balance (largest) and separate gold NET WORTH amount (medium font, gold badge). The running turn timer is integrated directly inside the active player's card, moving dynamically on handoff. |
| **Structured Rules Navigation** | Centralized in-game Rules Modal structured into **9 distinct categories** (Overview, Setup & Players, Turns & Actions, Properties & Rent, Buildings, Cards & Special Tiles, Finance & Debt, Winning & Rankings, Keyboard Shortcuts) with desktop sidebar navigation, mobile scrollable pills, instant search, and Return-to-Overview navigation. |
| **Card Financial Clarity** | Civic Fund and Market Buzz cards highlight monetary impact with clear color polarity: **+ ₹...** in emerald green for reward earnings, **- ₹...** in coral red for payments/losses, and clean neutral formatting for movement/utility cards. Nonexistent auction references removed. |
| **Turn Continuity Safeguards** | Zero-stall guarantee: Authoritative CPU decision controller provides phase-aware deterministic fallbacks across all phases, and the server turn manager executes stuck-turn recovery if CPU retries are ever exhausted. |
| **Central Jail & Bail** | Players enter jail via "Go to Jail" square or card events. Release methods: **Bail Key Card**, **₹500 Statutory Bail**, or rolling doubles within 3 attempts. Automatic release on 4th turn. On turn timeout in `JAIL_DECISION`, the server checks authoritative bail: if the player has sufficient cash, it automatically pays bail and releases them; otherwise, it attempts doubles. |
| **House Construction & Timeout Auto-Build** | Monopoly holders can build houses on a city **only when actively visiting that city** on a subsequent turn. Uniform building distribution enforced across the color group. Pressing Enter builds directly when prompt is active. If a human player times out in `MANAGEMENT` while standing on an eligible developable city and having sufficient funds, the server automatically constructs one house or commercial tower and restarts the normal turn timer rather than skipping construction. |
| **Sell to Bank & Reacquisition** | Players can liquidate properties to the bank for 50% purchase + 50% development value to satisfy obligations. Landing on one's own mortgaged property prompts contextual reacquisition: **Reacquire City** for cities and **Reacquire Property** for transit and utility tiles, preserving developments and resuming rent collection. If a human player times out, affordable unmortgage decisions execute automatically. |
| **120s Debt Timer & Centered Board Inspection** | If cash balance drops into deficit after fees/rent, the authoritative 120-second countdown begins (labeled `120s Window` across all views). The player can Sell to Bank or enter Board Inspection Mode via an accessible floating modal positioned precisely at the midpoint between the two dice in the board center (`z-[130]`), completely and symmetrically covering both dice without transform-animation collision while leaving all 40 perimeter tiles unblurred, clickable, and uncovered. On debt timeout, the server executes step-by-step liquidation of least-tariff properties before surrendering. |
| **Turn Sync & Intelligent Timeouts** | Timers pause during token movement animations across all connected clients. Resets to full duration upon entering new actionable phases (e.g. `PROPERTY_DECISION`). Mandatory 2-second pacing handoff delay before CPU turns. Unresponsive human players are auto-resolved gracefully without stalling matches: property purchases are bought if affordable, jail bail is paid if funds permit, and houses/towers are constructed when standing on eligible cities. |
| **Audio Feedback** | Client-side procedural Web Audio chimes: personalized turn notification sound, pleasant rising chime (G5→C6) for purchase prompts, and subtle descending tone (F4→Db4) on decline actions. |
| **Global Settings Modal** | Accessible from any view (landing page, waiting lobby, ongoing match) via the header navigation. Non-blocking overlay ensures live games continue uninterrupted without pausing timers, unmounting game boards, or stalling CPU turns. Configures player display names, token avatar colors, master volume, mute toggles with audio chime preview, dark/light theme, and reduced-motion accessibility. |
| **Landing Rules Access** | Direct `?` Rules button provided on the landing page header and action strip, opening the comprehensive 12-section rulebook and category navigator prior to entering matches. |
| **Default CPU Compact Format** | Standardized default computer player naming to `CPU1`, `CPU2`, `CPU3` (without space) across lobby seating and server room management, while fully preserving host custom naming capabilities. |
| **Board Visual Enhancements & Clean Dice Arena** | Clean, distraction-free central board arena focusing attention on the dice and dynamic prompts. Harmonized corner space backgrounds (`REST` and `GO TO JAIL` share the `bg-indian-parchment-100` styling of `START`). Ambient subtle glow and directional arrow glide animation on the `START` tile. |
| **Shortcut Reference Spacing** | Polished bottom margin and padding (`mb-2 sm:mb-2.5 pb-0.5`) on the permanent left-side keyboard shortcut reference to ensure clean clearance above the viewport edge across all screen resolutions. |

---

## ⌨️ Desktop Keyboard Shortcuts

For laptop and desktop players, context-sensitive keyboard shortcuts streamline gameplay:

| Key | Action | Context / Details |
| :--- | :--- | :--- |
| <kbd>Spacebar</kbd> | **Roll Dice / Try Double / End Turn** | Context-sensitive: rolls dice in `AWAIT_ROLL`, attempts doubles in `JAIL_DECISION`, or ends turn when eligible during `MANAGEMENT` and `TURN_END` |
| <kbd>Enter</kbd> | **Accept / Bail / Build House/Tower** | Context-sensitive: constructs development when visiting owned monopoly city, accepts property purchase, reacquires mortgaged city from Bank, or pays bail/uses card in Central Jail |
| <kbd>S</kbd> | **Sell to Bank** | Opens / activates the Sell-to-Bank mortgage interface to liquidate assets for cash |
| <kbd>N</kbd> | **Decline / Done** | Declines property purchase, declines reacquisition, or skips construction (identical to the **Done** button) to finish turn |

> **Permanent Visual Reference:** A compact, non-intrusive keycap guide (`SPACE — Roll Dice / Try Double / End Turn`, `ENTER — Accept / Bail / Build House/Tower`, `S — Sell to Bank`, `N — Decline / Done`) is permanently anchored at the bottom of the left player information panel for instant reference during matches. Complete rules and mechanics are fully documented in **Section 12: Keyboard Shortcuts** and the **Buildings** category of the in-game Rules Guide.  
> **Safety Safeguards:** Keyboard shortcuts are automatically suppressed while typing in text inputs or textareas, during modals/rules dialogs, during debt board preview, on computer player turns, and against key-repeat spam.

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
