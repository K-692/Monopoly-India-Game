<div align="center">
  <img src="public/assets/game_logo.png" alt="Indian Monopoly Logo" width="180" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);" />

  # 🇮🇳 Indian Monopoly (Monopoly-India-Game)

  **A modern, server-authoritative, full-stack multiplayer property trading board game featuring Indian economic mechanics, autonomous computer players (CPUs), configurable starting capital, worldwide multiplayer on Render, and offline local Wi-Fi LAN hosting.**

  <p align="center">
    <a href="https://monopoly-india-game.onrender.com/">
      <img src="https://img.shields.io/badge/🎮_Play_Live_Game-Online_Now-brightgreen?style=for-the-badge&logo=render&logoColor=white" alt="Play Live Game" />
    </a>
  </p>

  ### 🌐 Official Live Deployment
  **Play Online:** [https://monopoly-india-game.onrender.com/](https://monopoly-india-game.onrender.com/)

  [![Play Live](https://img.shields.io/badge/Live_Game-https%3A%2F%2Fmonopoly--india--game.onrender.com%2F-success?logo=render&logoColor=white)](https://monopoly-india-game.onrender.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101.svg?logo=socketdotio&logoColor=white)](https://socket.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Vitest](https://img.shields.io/badge/Vitest-3.2-FCC72B.svg?logo=vitest&logoColor=black)](https://vitest.dev/)
  [![Supabase PostgreSQL](https://img.shields.io/badge/Supabase_PostgreSQL-17-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com/)
  [![Render](https://img.shields.io/badge/Render-Live%20Deployment-46E3B7.svg?logo=render&logoColor=black)](https://monopoly-india-game.onrender.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 🎮 Play Online (Official Live Game)

Play Indian Monopoly right now directly in your web browser:

👉 **[https://monopoly-india-game.onrender.com/](https://monopoly-india-game.onrender.com/)**

- **Instant Worldwide Access:** Works on desktop, laptop, tablet, and smartphone browsers.
- **Real-Time Multiplayer:** Host a private room with custom rules, invite friends via code/link, or seat autonomous AI opponents.
- **Zero Installation:** No downloads or terminal commands required to play online.

---

## 🌐 Choose Your Multiplayer Mode

Indian Monopoly supports two production-ready, non-interfering multiplayer execution architectures:

| Operational Mode | Environment | Best For | Documentation & Guide |
|---|---|---|---|
| **🌐 Worldwide Public Multiplayer** | **Render Web Service** | Playing with friends anywhere across the globe over the internet | [Public Hosting Setup Guide](docs/PUBLIC-HOSTING-SETUP.md) |
| **🏠 Offline Wi-Fi (LAN) Mode** | **Local Node.js Host** | Zero-latency local play on home Wi-Fi or mobile hotspot | [LAN Quick Start](#-quick-start-host--play-on-local-wi-fi-lan) |

---

## ⚡ Quick Start: Worldwide Multiplayer (Render)

Play immediately in your browser without local server installation:

1. **Open the Deployed App:** Navigate to **[https://monopoly-india-game.onrender.com/](https://monopoly-india-game.onrender.com/)**.
2. **Cold Start Notice:** On first visit after server inactivity, the free Render service takes ~50–70 seconds to spin up. An on-screen status banner keeps you informed with a one-click Retry button.
3. **Host or Join:** Create a private room, configure starting cash and custom rules, and share your 6-character room code or link with friends across any network.
4. **Deploy Your Own:** Follow the comprehensive [Public Hosting Setup Guide](docs/PUBLIC-HOSTING-SETUP.md) to launch your own free Render backend with 1-click `render.yaml` Blueprint deployment.

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
                                  INDIAN MONOPOLY PRODUCTION ARCHITECTURE
                               
      +──────────────────────────────────────────────────────────────────────────+
      │                         HOST SYSTEM (Node.js 20+)                        │
      │                                                                          │
      │   +──────────────────────────+        +──────────────────────────────+   │
      │   │   Express HTTP Server    │        │      Socket.IO Engine        │   │
      │   │     Port: 0.0.0.0:4173   │        │     Port: 0.0.0.0:4173       │   │
      │   │  Serves: dist/ (SPA app) │        │  Handshake Auth & Fencing    │   │
      │   +────────────┬─────────────+        +──────────────┬───────────────+   │
      │                │                                     │                   │
      │                │                      Channels:      │                   │
      │                │                      - room:<roomId> (Lobby & Presence) │
      │                │                      - game:<gameId> (Authoritative)    │
      │                │                                     │                   │
      │   +────────────▼─────────────────────────────────────▼───────────────+   │
      │   │             Authoritative GameManager & Pipeline                 │   │
      │   │  - Atomic Game Creation (One Active Match Per Room Invariant)    │   │
      │   │  - Durable Command Deduplication (game_id, command_id)           │   │
      │   │  - Monotonic Versioning & Pre-Broadcast ACID Persistence Commit  │   │
      │   │  - Cryptographic Fair Dice (Rejection Sampling, Zero Modulo Bias)│   │
      │   │  - Disconnection Grace Timers & Automatic Human-to-Bot Takeover  │   │
      │   +────────────┬─────────────────────────────────────────────────────+   │
      │                │                                                         │
      │   +────────────▼───────────────────────+  +──────────────────────────+   │
      │   │   Autonomous CPU Controller Layer  │  │    Persistence Engine    │   │
      │   │  - Active & Disconnected Human Bots│  │  - PostgreSQL (Render)   │   │
      │   │  - Pacing & Movement Gates         │  │  - MemoryStore (LAN)     │   │
      │   │  - Pure Deterministic Heuristics   │  │  - Auto-Schema Migrations│   │
      │   +────────────┬───────────────────────+  +──────────────────────────+   │
      │                │                                                         │
      │   +────────────▼─────────────────────────────────────────────────────+   │
      │   │                 Core Game Engine (applyGameCommand)              │   │
      │   │  - Validates human & CPU actions through identical pipeline      │   │
      │   +──────────────────────────────────────────────────────────────────+   │
      +─────────────────────────▲──────────────────────────────▲─────────────────+
                                │                              │
                Wi-Fi HTTP & WS │              Internet HTTPS  │
                (Offline LAN)   │              & Secure WSS    │
                                │                              │
     +──────────────────────────┴────+     +───────────────────┴──────────────+
     │       LAN GUEST (Phone)       │     │     WORLDWIDE GUEST (Browser)    │
     │  Safari / Chrome on Android   │     │        Render Web Client         │
     │  http://192.168.1.8:4173      │     │  https://monopoly-india-game...  │
     │  Joined via QR Code / Link    │     │  Connected to Render Starter DB  │
     +───────────────────────────────+     +──────────────────────────────────+
```

For complete deployment specifications, setup procedures, and troubleshooting, see [`docs/PUBLIC-HOSTING-SETUP.md`](docs/PUBLIC-HOSTING-SETUP.md).
For formal mathematical definitions, state machine proofs, and research citation details, see [`flow.md`](flow.md).

---

## 🛡️ Production-Grade Multiplayer Synchronization & Resilience

Indian Monopoly includes an enterprise-grade multiplayer synchronization engine engineered specifically to withstand distributed cloud hosting, transient mobile packet drops, browser refreshes, and host container restarts:

1. **Strict Room and Game Isolation & Authoritative Persistence:**
   - Database partial unique index (`idx_one_active_game_per_room`) guarantees a room cannot spawn multiple active games under concurrent requests or double-clicks.
   - **Authoritative Async Lifecycle:** Room creation (`createRoom`) and match startup (`startGame`) strictly await and verify database commit in `game.rooms` and `game.games` before returning success or emitting socket events to clients.
   - **Parent Session Verification & Atomic CTE Commit:** Command processing (`commitCommandExecution`) uses a single atomic Common Table Expression (CTE) query to row-lock the parent `game.games` record, check idempotency in `game.processed_commands` with `ON CONFLICT DO NOTHING`, insert into `game.game_events`, and update `game.games` in one database round-trip. This eliminates 7–8 serial round-trips and prevents foreign key constraint violations (`processed_commands_game_id_fkey`).
   - **Explicit Schema Isolation:** All PostgreSQL statements are explicitly schema-qualified (`game.rooms`, `game.games`, `game.processed_commands`, etc.), eliminating reliance on connection pooler `search_path` states.
   - Channel decoupling separates room membership (`room:<roomId>`) from active gameplay events (`game:<gameId>`), preventing cross-match state leakage.

2. **Durable Command Deduplication & Versioning:**
   - Every gameplay command is tagged with a unique `commandId` and validated against `(game_id, command_id)` uniqueness.
   - Retransmitted commands return original results without re-executing transactions.
   - Monotonically increasing state versions reject stale commands and keep all connected clients synchronized.

3. **High-Performance Multi-Region Database & Broadcast Optimization:**
   - **Single-Round-Trip CTE Persistence:** Replaced serial transaction queries with a consolidated atomic CTE (`lock_game` -> `insert_cmd` -> `insert_event` -> `update_game`), reducing command persistence latency between Render (Oregon) and Supabase (Mumbai) from ~1,500ms down to ~67ms (~22x speedup).
   - **Deduplicated Socket.IO Multicasting:** Emits state updates via array channels `io.to([gameChannel, roomChannel, ...])`, leveraging Socket.IO's internal Set to guarantee exactly one packet per client and eliminating duplicate wire traffic.
   - **Pre-Queue Memory Deduplication:** In-memory command ID caching bypasses redundant remote database lookups before entering the command processing queue.

4. **Instant Client Responsiveness & Render Isolation:**
   - **Immediate Click Feedback & Lock:** Action buttons (`ROLL DICE`, `END TURN`, `BUY`, `BUILD`, `PAY BAIL`, etc.) instantly show an active spinner (`Rolling...`, `Ending...`) and disable further clicks, with a 6-second auto-clearing safety watchdog.
   - **Render-Decoupled Game Timer:** Extracted match duration (`elapsedSeconds`) into an isolated `GameElapsedTimer` component, preventing 1-second interval updates from cascading full re-renders across `GameBoard` (1,500+ lines) and all 40 `BoardSpaceTile` components.
   - **Component Memoization:** `GameBoard`, `BoardSpaceTile`, and `PlayerStrip` are wrapped with custom `React.memo` equality checks to isolate re-renders to only spaces or players whose properties, positions, or balances actually change.

5. **Calibrated Turn Pacing & Self-Healing Guards:**
   - **Optimized Pacing:** Tuned post-turn handoff delay from 2,000ms down to 600ms, and token walking animations to 350ms tumble + 200ms/step + 180ms settle, cutting turn turnaround time by over 50% while preserving visual clarity.
   - **Self-Healing Movement & Queue Guards:** Expired movement blocks and turn handoffs auto-clear upon timestamp expiry, and server command queue timeouts (8s) plus client state-recovery timeouts (5s) prevent frozen matches if network packets are lost or delayed.

6. **Handshake Reconnection & Single-Active-Socket Fencing:**
   - Persistent reconnect tokens are authenticated during the Socket.IO handshake (`auth.token`), completely eliminating query-param or URL token leakage.
   - Sessions maintain a monotonically incrementing generation number: when a player connects a new socket (e.g. tab refresh), older sockets receive a `SESSION_REPLACED` event and are fenced off immediately.

7. **Automatic Human-to-CPU Takeover & Seamless Recovery:**
   - If a human player disconnects during their turn, the server starts an authoritative 10-second grace timer (`BOT_TAKEOVER_GRACE_MS=10000`).
   - Upon timer expiry, the autonomous `CpuController` takes over the player slot without forfeiting their seat, assets, or balance.
   - When the human returns, the server cancels pending bot actions, returns control to the player (`isBotControlled = false`), broadcasts `player:controller_changed`, and delivers the latest authoritative state snapshot.

8. **Durable Persistence & Server Restart Recovery (Supabase PostgreSQL 17):**
   - Cloud production utilizes **Supabase PostgreSQL 17** (hosted in `ap-south-1`) with connection pooling (`pg.Pool`, conservative `max: 10` clients) and versioned SQL migrations.
   - All critical tables reside in a backend-only `game` schema (`REVOKE ALL ON SCHEMA game FROM anon, authenticated`) to prevent unauthorized client PostgREST access.
   - Offline local Wi-Fi LAN mode runs on a zero-dependency in-memory store (`MemoryStore`).
   - On server restart, active matches and pending turn timers are recovered dynamically from Supabase PostgreSQL, preventing match loss across Render cold-start spin-downs and redeployments.

---

## 🗄️ Supabase PostgreSQL Integration & Configuration

Indian Monopoly uses **Supabase PostgreSQL 17** for persistent ACID multiplayer storage while retaining high-performance **Socket.IO** for real-time WebSocket state streaming:

### Database Schema Overview (Schema: `game`)
- **`game.player_sessions`**: Persistent reconnect identities, token hashes (`token_hash`), generation fencing, and connection presence.
- **`game.rooms`**: Private rooms, invite codes, host ownership, and custom rulesets.
- **`game.room_members`**: Player slots, display names, readiness, token colors, and controller assignments (`HUMAN` vs `BOT`).
- **`game.games`**: Authoritative game session snapshots (`JSONB`), versions, turn timers, and status. Enforced with partial unique index `idx_one_active_game_per_room`.
- **`game.game_events`**: Sequenced, ordered event log for action auditing and state recovery.
- **`game.processed_commands`**: Idempotency records `(game_id, command_id)` preventing duplicate dice rolls or financial transactions.
- **`game.game_archives`**: Historical match archives, final rankings, and statistics.
- **`game.schema_migrations`**: Version-controlled migration ledger.

### How to Configure `DATABASE_URL`
- **Render Production**:
  1. Open your Render Web Service -> **Environment**.
  2. Set `DATABASE_URL` to your Supabase connection string.
     - **Session Pooler (Recommended - Port 5432):**
       `postgresql://postgres.omelbzqsmqsjazaliqvo:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require`
     - **Direct Connection (Port 5432):**
       `postgresql://postgres:[YOUR-PASSWORD]@db.omelbzqsmqsjazaliqvo.supabase.co:5432/postgres?sslmode=require`
     - *> **Tip**: If your database password contains special characters (such as `@`, `#`, or `/`), URL-encode them in the connection string (for example, replace `@` with `%40`) so PostgreSQL connection string parsers parse the username and host accurately.*
- **Local Development / Testing**:
  Add `DATABASE_URL` to your local `.env` file or leave it unset to use the zero-dependency in-memory fallback (`MemoryStore`).

### Health & Connectivity Verification
Check database connectivity anytime via the backend health probe:
```bash
curl https://<your-render-service>.onrender.com/api/health
```
Response when database is connected:
```json
{
  "status": "ok",
  "ready": true,
  "uptime": 124.5,
  "timestamp": 1794593000000,
  "database": "connected",
  "connectedClients": 2
}
```

### Running PostgreSQL Integration Tests
To execute the genuine PostgreSQL integration test suite against a disposable local or CI test database:
```bash
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/monopoly_test" npm run test
```
*(Automated safety guards prevent `TEST_DATABASE_URL` from connecting to the production Supabase database).*

---

## 💻 Tech Stack

| Layer | Technologies & Libraries | Architectural Role |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19**, **TypeScript 5.7** | Declarative component hierarchy, strict type safety, zero-scroll responsive UI. |
| **Styling & Design** | **Tailwind CSS 3.4**, **Lucide React** | Indian-heritage aesthetic palette (Terracotta, Parchment, Royal Navy, Gold), icon system. |
| **State Management** | **Zustand 5**, **TanStack Query 5** | Lightweight client state, decoupled toast store, room and game state synchronizers. |
| **Client UI Primitives**| **Radix UI**, **Canvas Confetti** | Accessible dialogs, range sliders, tooltips, tabs, and celebratory victory animations. |
| **Backend & Server** | **Node.js 20+**, **Express 5**, **tsx** | High-performance HTTP server serving static client assets, health probes, and API routes. |
| **Persistence Layer** | **Supabase PostgreSQL 17**, **pg** | ACID transactions, row-level locking, isolated `game` schema, versioned migrations, zero-dependency LAN fallback. |
| **Real-Time Transport** | **Socket.IO 4.8** | Authoritative bidirectional WebSocket transport with handshake auth, channel isolation, and socket fencing. |
| **Autonomous AI** | Pure Modular TypeScript Engine | Deterministic heuristic multi-agent decision models with automatic human takeover and animation synchronization. |
| **Desktop Runtime** | **Electron 45** | Native desktop wrapper with integrated background Node.js server for macOS and Windows. |
| **Testing & Quality** | **Vitest 3**, **Playwright**, **ESLint 9** | Unit, acceptance, integration, multi-agent pacing, hardening, and end-to-end verification. |

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
| `npm test` | Runs the full Vitest test suite (419 tests across 33 test files including performance & hardening suites). |
| `npm run test:watch` | Runs Vitest in interactive watch mode for test-driven development. |
| `npm run test:coverage`| Generates detailed test code coverage reports. |
| `npm run typecheck` | Strict TypeScript compiler validation across client, server, and tests (`tsc -b --noEmit`). |
| `npm run lint` | ESLint static analysis across all TypeScript and React files with zero errors. |
| `npm run preview` | Previews the production build locally via Vite. |

---

## 🎲 Game Rules & Economy Summary

| Feature | Mechanics & Rule Specification |
| :--- | :--- |
| **Mandatory Decision Resolution** | **Strict Turn Decision Enforcement**: A player cannot end their turn while an unresolved mandatory gameplay popup is active (Buy City/Property, Reacquire City/Property, or Build House/Tower). When a build opportunity is available, the player must either execute **Build House/Tower** (or press <kbd>Enter</kbd>) or explicitly select **Done** (or press <kbd>N</kbd>). Generic End Turn and Spacebar are suppressed until resolved. |
| **Unified Fair Crypto Dice** | **Unbiased Rejection Sampling**: Authoritative dice rolls use cryptographic random bytes with rejection sampling (bytes 0–251 accepted, 252–255 rejected and re-sampled) to eliminate modulo bias. Zero `Math.random()` fallback. The exact same generator governs human rolls, autonomous CPU moves, and Try Doubles rolls. |
| **P + 80% Tariff Sale & P + 50% Reacquisition** | **Revised Property Economy**: Developable cities sell to the Reserve Bank for **Original Deed Price (P) + 80% of Current Tariff (T)** across all building tiers (Levels 0–5) and are reacquired from the bank for **Original Deed Price (P) + 50% of Current Tariff (T)**, preserving all existing houses and towers intact. Infrastructure properties (Railways, Airports, Utilities) sell and reacquire at **100% of original deed price (P)**. Separate payout and reacquisition costs are authoritatively calculated and stored independently on `PropertyState`. |
| **Dynamic Tariff Construction Costs** | **Tariff-Equal Building**: The cost to construct each House or Commercial Tower strictly equals the tariff of that resulting tier (House 1 = `rentHouse1`, House 2 = `rentHouse2`, House 3 = `rentHouse3`, House 4 = `rentHouse4`, Commercial Tower = `rentTower`). Net worth calculations accurately accumulate invested building tariffs across built levels. |
| **Central Jail Center Notification Modal (2s)** | **Centered Arrest Alert**: When any player is sent to Central Jail (via Go to Jail tile, triple doubles, or card instruction), a dedicated alert modal renders exclusively at the geometric center of the game board, anchored directly over both dice and completely covering them with an opaque container for exactly **2 seconds (2000 ms)** before automatically dismissing. The redundant bottom-left toast is eliminated so player attention stays directly on the board center. |
| **Sell-to-Bank Turn & UI Restrictions** | **Turn Enforcement & Grid Decoupling**: Voluntary Sell-to-Bank is strictly restricted to the active player's turn (`actorUid === currentPlayerUid`) through the dedicated Sell Properties to Bank modal or <kbd>S</kbd> key. Sell-to-Bank buttons are decoupled and removed from individual board grid tiles (`CityDeedModal`). Debt resolution obligations remain exempt, allowing debtors to liquidate properties when required. |
| **Give Up & Surrender Active-Turn Restrictions** | **Turn-Bound Surrender Security**: Surrendering and giving up is restricted exclusively to the active player's own turn (`actorUid === currentPlayerUid`). Surrendering during another player's turn or during a computer player's (CPU) turn is strictly prohibited. The frontend hides the Give Up button outside active turns, and both the authoritative game engine and server reject out-of-turn surrender attempts with `NOT_YOUR_TURN`. Outstanding financial debt obligations remain protected under the authoritative 120-second emergency resolution window. |
| **11-Card Canonical Decks** | **Exact Dice-Sum Mapping (#2 to #12)**: Both Civic Fund and Market Buzz decks contain exactly 11 canonical cards indexed to dice rolls 2 through 12 (`deck[T - 2]`). Outdated rules #1 (Bank interest and Startup grant) have been decommissioned. |
| **Shuffled Turn Order** | **Complete Player Randomization**: When a match starts, the entire participant list is shuffled using cryptographically secure Fisher-Yates randomization. The resulting order determines turn sequencing (`playerOrder`), starting active player, and initial seating. |
| **Permanent Green Cash Balances** | **Consistent Visual Design**: Liquid cash balances in the left player cards (`PlayerStrip`) are rendered permanently in emerald green (`text-emerald-700 dark:text-emerald-400`), remaining distinct and readable without ever flashing red during debits or fee deductions. |
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
| **Sell to Bank & Reacquisition** | Developable cities sell to the Reserve Bank for original deed price plus 80% of current tariff, and reacquire for deed price plus 50% of current tariff. Infrastructure assets sell and reacquire at 100% of deed price. Built houses and towers remain preserved. Landing on a bank-owned property prompts contextual reacquisition: **Reacquire City** for cities and **Reacquire Property** for transit and utility tiles, preserving developments and resuming rent collection. If a human player times out, affordable unmortgage decisions execute automatically. |
| **120s Debt Timer & Automatic Sell-to-Bank Liquidation** | **Authoritative 120-Second Emergency Window & Automatic Liquidation**: If cash balance drops into deficit after fees, taxes, or rent, the authoritative 120-second countdown begins (labeled `120s Window` across all views). The player can manually Sell to Bank via Adjust Payouts or inspect the board via Board Inspection Mode positioned precisely over the dice (`z-[130]`). When the 120-second countdown expires, the server automatically liquidates eligible properties sequentially, starting with lowest Sell-to-Bank payout assets (tie-broken by fewer buildings first, then lower spaceIndex). As soon as available cash covers the debt, liquidation stops immediately, the payment completes, and normal turn flow resumes. If proceeds remain insufficient after all eligible properties are exhausted, the debtor automatically surrenders, any remaining cash is transferred to the creditor, and properties become permanently `BLOCKED`. |
| **Turn Sync & Intelligent Timeouts** | Timers pause during token movement animations across all connected clients. Resets to full duration upon entering new actionable phases (e.g. `PROPERTY_DECISION`). Mandatory 2-second pacing handoff delay before CPU turns. Unresponsive human players are auto-resolved gracefully without stalling matches: property purchases are bought if affordable, jail bail is paid if funds permit, and houses/towers are constructed when standing on eligible cities. |
| **Audio Feedback** | Client-side procedural Web Audio chimes: personalized turn notification sound, pleasant rising chime (G5→C6) for purchase prompts, and subtle descending tone (F4→Db4) on decline actions. |
| **Global Settings Modal** | Accessible from any view (landing page, waiting lobby, ongoing match) via the header navigation. Non-blocking overlay ensures live games continue uninterrupted without pausing timers, unmounting game boards, or stalling CPU turns. Configures player display names, token avatar colors, master volume, mute toggles with audio chime preview, dark/light theme, and reduced-motion accessibility. |
| **Landing Rules Access** | Direct `?` Rules button provided on the landing page header and action strip, opening the comprehensive 12-section rulebook and category navigator prior to entering matches. |
| **Default CPU Compact Format** | Standardized default computer player naming to `CPU1`, `CPU2`, `CPU3` (without space) across lobby seating and server room management, while fully preserving host custom naming capabilities. |
| **Board Visual Enhancements & Clean Dice Arena** | Clean, distraction-free central board arena focusing attention on the dice and dynamic prompts. Harmonized corner space backgrounds (`REST` and `GO TO JAIL` share the `bg-indian-parchment-100` styling of `START`). Ambient subtle glow and directional arrow glide animation on the `START` tile. |
| **Shortcut Reference Spacing** | Polished bottom margin and padding (`mb-2 sm:mb-2.5 pb-0.5`) on the permanent left-side keyboard shortcut reference to ensure clean clearance above the viewport edge across all screen resolutions. |
| **Synchronized Entire Game Timer (MM:SS)** | **Authoritative Match Duration**: Centered directly in the top header bar between **Exit Room** and **Room #...**, a synchronized match timer tracks total gameplay duration in `MM:SS` format starting from `00:00`. Synchronized across all connected clients via authoritative server broadcasts on `game:timer` (`elapsedSeconds`), maintaining identical time displays and freezing automatically at final match completion duration. |

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
