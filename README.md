<div align="center">
  <img src="public/assets/game_logo.png" alt="Indian Monopoly Logo" width="180" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);" />

---

## ⚡ Quick Start: Host & Play on Wi-Fi

### 1. Prerequisites

- **Node.js**: v20.0.0 or higher (v22+ recommended)
- **npm**: v10.0.0 or higher
- Devices connected to the **same local Wi-Fi network or mobile hotspot**

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/K-692/Monopoly-India-Game.git
cd Monopoly-India-Game

# Install project dependencies
npm install
```

### 3. Run the Production LAN Host Server

```bash
npm run lan:host
```

The server automatically compiles the optimized frontend bundle for LAN and outputs your local access URL and shareable Wi-Fi network IP:

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

1. **Host**: Open `http://localhost:4173` (or your printed LAN IP) in your browser. Enter your player name, click **Customize Rules & Host**, configure your preferred rules, and click **Create Room**.
   - **Dynamic Starting Balance**: Choose between **₹5,000**, **₹10,000**, or **₹20,000** starting capital.
   - **Dynamic Start Pass Money**: Choose between **₹1,000**, **₹2,000**, or **₹3,000** salary upon crossing START.
   - **Turn Timer Limit**: Select 15s, 30s, 45s, or 60s per turn.
   - **Player Count**: 2 to 6 players.
2. **Share Invite**:
   - Have mobile players scan the **on-screen QR Code** directly with their device camera.
   - Or share the unique 6-character room code (e.g. `K9W2XP`).
   - Or copy the direct invite link (e.g. `http://192.168.1.8:4173/#/join/K9W2XP`).
3. **Guests**: Open the URL from any smartphone, tablet, or computer on the same Wi-Fi network. Choose a name, tap **Ready**, and the host starts the match!

---

```
                                  INDIAN MONOPOLY LAN ARCHITECTURE
                               
      +──────────────────────────────────────────────────────────────────────────+
      │                         HOST LAPTOP (Node.js 20+)                        │
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
      │   │  - Dynamic Starting Balance & Pass Money Engine Rules            │   │
      │   │  - 120s Debt Resolution Timer & Monotonic State Sync             │   │
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

## 💻 Tech Stacks used

| Layer                          | Technologies & Libraries                                     | Purpose & Architectural Role                                                                              |
| :----------------------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Frontend Framework**   | **React 19**, **TypeScript 5.7**                 | Declarative component hierarchy, strict type safety, zero-scroll responsive UI.                           |
| **Styling & Design**     | **Tailwind CSS 3.4**, **Lucide React**           | Indian-heritage aesthetic palette (Terracotta, Parchment, Royal Navy, Gold), icon system.                 |
| **State Management**     | **Zustand 5**, **TanStack Query 5**              | Lightweight reactive client state, decoupled toast store, room and game state synchronizers.              |
| **Client UI Primitives** | **Radix UI Primitives**, **Canvas Confetti**     | Accessible dialogs, tooltips, tabs, and celebratory victory animations.                                   |
| **Backend & Server**     | **Node.js 20+**, **Express 5**, **tsx**    | High-performance HTTP server serving static client assets and LAN discovery APIs.                         |
| **Real-Time Networking** | **Socket.IO 4.8**                                      | Authoritative bidirectional WebSocket transport with room multiplexing and reconnect handling.            |
| **Domain Logic & Math**  | Pure TypeScript Game Engine                                  | Cryptographic fair dice via rejection sampling, serialized action queue, authoritative state transitions. |
| **Desktop Runtime**      | **Electron 45**                                        | Native desktop integration with embedded background LAN server runner.                                    |
| **Testing & Quality**    | **Vitest 3**, **Playwright**, **ESLint 9** | Unit, acceptance, integration, responsive layout, and headless browser end-to-end verification.           |

---

## 🛠️ CLI Commands & Development Scripts

| Command                   | Purpose                                                                                                                             |
| :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lan:host`      | **Production Host**: Builds the production bundle (`dist/`) and starts the authoritative LAN server on `0.0.0.0:4173`.    |
| `npm run lan:dev`       | **Concurrent Dev**: Runs the Node.js Socket.IO server (`tsx watch`) and Vite dev server (`5173`) with live hot-reloading. |
| `npm run dev`           | Starts the Vite development server locally on port 5173.                                                                            |
| `npm run server`        | Starts the Node.js backend server directly using `tsx server/index.ts`.                                                           |
| `npm run build`         | Compiles TypeScript and builds the production React application.                                                                    |
| `npm run build:lan`     | Builds the React frontend with `/` base path explicitly optimized for LAN hosting.                                                |
| `npm run build:server`  | Bundles the standalone server into `dist-server/index.cjs` using `esbuild`.                                                     |
| `npm run build:desktop` | Builds both the React LAN frontend (`dist/`) and the server bundle (`dist-server/index.cjs`).                                   |
| `npm run desktop`       | Builds desktop assets and launches the application inside native Electron.                                                          |
| `npm test`              | Runs the Vitest test suite covering engine invariants, rulesets, and multiplayer mechanics.                                         |
| `npm run test:watch`    | Runs Vitest in interactive watch mode for test-driven development.                                                                  |
| `npm run test:coverage` | Generates detailed unit test code coverage reports.                                                                                 |
| `npm run typecheck`     | Strict TypeScript compiler validation across client, server, and tests (`tsc -b --noEmit`).                                       |
| `npm run lint`          | ESLint static analysis across all TypeScript and React files with zero warnings.                                                    |
| `npm run preview`       | Previews the production build locally via Vite.                                                                                     |

---

## 🤝 How to Contribute

We warmly welcome contributions from developers, game designers, and open-source enthusiasts!

1. **Fork the Repository**:
   Click the **Fork** button on the GitHub repository page to create a copy in your account.
2. **Clone your fork**:

   ```bash
   git clone https://github.com/<your-username>/Monopoly-India-Game.git
   cd Monopoly-India-Game
   ```
3. **Create a Feature Branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Follow Development Guidelines**:

   - Write clean, modular, and type-safe TypeScript code.
   - Maintain zero-scroll responsive design and strict server-authoritative invariants.
   - Add comments so functions and complex state transitions are easy to understand and reference.
   - Ensure game rules and UI remain consistent across both mobile and desktop viewports.
5. **Verify Quality & Tests**:
   Before submitting changes, make sure all validations and test suites pass cleanly:

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
6. **Commit Your Changes**:

   ```bash
   git commit -m "feat: add dynamic room settings and rule validations"
   ```
7. **Push to Your Fork & Open a Pull Request**:

   ```bash
   git push origin feature/your-feature-name
   ```

   Open a Pull Request describing your changes, architectural rationale, and verification steps.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for complete details.
