<div align="center">
  <img src="public/assets/game_logo.png" alt="Indian Monopoly Logo" width="180" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);" />
  
  # 🇮🇳 Indian Monopoly — Standalone Desktop & Local Wi-Fi LAN Multiplayer Board Game

  [![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
  [![Platform: macOS & Windows](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Web-blue.svg)](#-desktop-apps--download)
  [![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
  [![Electron](https://img.shields.io/badge/Electron-45+-47848F.svg)](https://www.electronjs.org/)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8+-010101.svg)](https://socket.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4+-38b2ac.svg)](https://tailwindcss.com/)
  [![Vite](https://img.shields.io/badge/Vite-6.0+-646cff.svg)](https://vite.dev/)
  [![Tests](https://img.shields.io/badge/Vitest-86%20Passing-brightgreen.svg)](https://vitest.dev/)

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

| Platform | Format | Description |
|:---|:---|:---|
| **macOS** (Apple Silicon & Intel) | `.dmg` installer | Native macOS app bundle. Drag-and-drop installation into `/Applications`. Embedded local server binds to available Wi-Fi interfaces automatically. |
| **Windows** (64-bit) | `.exe` NSIS installer | Standard Windows installer with customizable installation paths, Start Menu shortcuts, and desktop launcher icon. |
| **Mobile & Web Browser** | HTML5 / WebSockets | Join directly from Safari, Chrome, Edge, or Firefox by opening the host's LAN URL or scanning the on-screen QR code. |

### How Local LAN Desktop Multiplayer Works:
1. **Host Launches Native App**: Double-click `Indian Monopoly.app` or `Indian Monopoly.exe`.
2. **Server Self-Initializes**: The application starts its embedded authoritative Express + Socket.IO server on an auto-discovered port (starting at `4173`).
3. **Wi-Fi Discovery**: The host sees their LAN IP and an on-screen QR code (e.g. `http://192.168.1.50:4173`).
4. **Friends Connect**: Friends connect from phones (iPhone / Android), tablets (iPad), or laptops on the same Wi-Fi network without installing anything extra.
5. **Cross-Platform Play**: Real-time state synchronizes authoritatively across all connected clients.

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
- **Statistical Goodness-of-Fit**: Chi-square test on 6-face uniformity and 36-pair independence across 12,000 rolls ($\chi^2 < 15.086$ at $\alpha = 0.01$).
- **Unique Roll IDs & Idempotency**: Each roll is stamped with a unique `rollId`, rejecting duplicate command requests.
- **Ergonomic Widened Dice Geometry**: Tactile ivory gradient cubes (`w-12 h-12 sm:w-14 sm:h-14`), deep rounded bevels, generous inset padding (`p-1.5 sm:p-2`), and widely spaced dot gaps (`gap-1.5 sm:gap-2`). The pips are centered, distinct, and spacious, featuring signature Terracotta Crimson on the 1-pip.
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

### 4. Player-Specific Financial Audio System & Single-Active Notifications
- **Web Audio Procedural Sound Synthesizers**: All sounds are rendered in real time through the Web Audio API without remote audio files or latency:
  1. **Rolling Sound (`DICE_ROLL`)**: Rapid tumbling thuds synthesized via tuned triangle oscillators.
  2. **Players Walking Sound (`PAWN_STEP`)**: Percussive step taps as tokens advance across board grids.
  3. **Alert Tone (`NOTIFICATION`)**: Warm dual-tone chime ($E_5 \to G^\#_5$) accompanying alert popups.
  4. **Cash Credit Chime (`CASH_CREDIT`)**: Ascending 3-tone arpeggio (C5 $\to$ E5 $\to$ G5) when receiving funds (Start salary, rent collected, mortgage payout).
  5. **Cash Debit Chime (`CASH_DEBIT`)**: Descending triad (A4 $\to$ F4 $\to$ D4) when spending or paying funds (purchases, rent paid, fines).
- **Player-Specific Audio Isolation**: Financial transaction sounds play **exclusively on the physical device of the affected player**. Opponents and bystanders hear no transaction noise, ensuring quiet, unpolluted multiplayer play.
- **Strict 1-Notification Invariant**: At most 1 active notification box at any time (`toasts: [newToast]`).
- **Cross-Channel Deduplication**: Prevents duplicates between Socket.IO game events and local state triggers via `eventId` tracking.
- **Debounced Balance Warnings**: Uses `dedupKey` to prevent spamming insufficient balance warnings within 3.5 seconds.

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

### 8. Complete Mortgaging, 60-Second Debt Resolution & "Check Board" Inspection Mode
- **Dual-Modal Spatial Pop-ups**:
  - **For Mortgaging Player**: Displays a centered modal dialog (`fixed inset-0 z-[120] bg-black/80 flex items-center justify-center`) where they select cities to mortgage, view development statuses, and settle debts or surrender.
  - **For Other Players (Spectators)**: Displays an informative floating pop-up card at the **left below** (`fixed bottom-4 left-4 z-[120]`). It never covers the center of the screen, allowing other players to view the board while tracking debtor progress.
- **"Check Board" Inspection Mode**:
  - Debtors can click **Check Board** inside the low-balance resolution modal to freely inspect rival balances, property developments, and board monopolies before committing funds or surrendering.
  - A transparent full-screen click-capture shield prevents accidental board actions while allowing immediate return to the modal upon any click or tap.
  - A persistent top floating banner displays inspection status, unbroken 60-second countdown, and a direct "Return to Debt Resolution" button.
  - All selected properties, pending debt obligation data, and the 60-second countdown are strictly preserved.
- **Authoritative Independent 60-Second Window**: An independent 60-second timer begins upon low-balance rent or tax deficit, operating completely independently of standard turn expiration.
- **Physical Landing Required for Reacquisition**:
  - A player cannot reacquire mortgaged cities from property lists or deed modals.
  - Reacquisition is strictly offered when the owner **physically lands on that specific city again** in an eligible turn.
  - Declining marks the opportunity `DECLINED`, preventing reacquisition in the same turn.
  - Reacquisition price strictly equals the exact mortgage payout originally received ($C_{\text{reacquire}} = V_{\text{payout\_received}}$), and all buildings are preserved intact.
- **Voluntary Mortgaging**: Active players can open the center mortgage dialog anytime during management phases directly from the turn controls.
- **Development-Inclusive Valuation Formula**:
  $$\text{Mortgage Payout} = \min\left(P_{\text{base}}, \left\lfloor 0.5 \times P_{\text{base}} + 0.5 \sum_{i=1}^{B} C_{\text{build}}\right\rfloor\right)$$

### 9. Voluntary Give Up Functionality & Blocked City Mechanics
- **Player Strip Surrender Action**: A prominent Give Up button is positioned immediately below player cards in the left panel for the active viewer.
- **Strict Confirmation Warning**: Prompts players with a modal confirming irreversible removal and permanent city blocking.
- **Permanent City Blocking (`BLOCKED`)**: All cities owned by the surrendered player become permanently `BLOCKED`.
  - Cannot be bought, sold, traded, mortgaged, or reacquired by any player.
  - Landing on a blocked city generates **₹0 rent**.
  - Historical ownership, mortgage, and building records remain preserved.
  - Turn advancement safely cycles to the next player without interrupting active turns.

### 10. Canonical Civic Fund & Market Buzz Execution
- **Civic Fund (12 Canonical Cards)**: All 12 canonical cards execute authoritatively (municipal refunds, tax audits, deed taxes, development grants, player gatherings, jail exemptions, utility bills). Insufficient cash triggers `ACTION_REQUIRED` and debt resolution. Blocked cities are strictly excluded from deed taxes and grants.
- **Market Buzz (12 Canonical Cards)**: All 12 canonical cards execute authoritatively (startup grants, festival travel to Start collecting ₹2,000, business conference to Connaught Place #38 with purchase option, railway expansion with $2\times$ rent, road diversion -3 spaces, highway tolls, property maintenance, transit dividends, and Mumbai investment trip to #39).

### 11. Clean Player-Facing Board UI & Grid Background Artworks
- **Debug Info Elimination**: Technical identifiers (`Turn #X`, `Phase: AWAIT_ROLL`, raw state machine names) are removed from the player-facing board. Replaced with polished player-facing badges ("Your Turn — Roll the Dice", "Processing Move...", "Waiting for [Player Name]").
- **Rich SVG Backgrounds**: Non-city board spaces feature responsive, high-contrast SVG background illustrations with dark translucent overlays for Civic Fund, Market Buzz, GST Tax, Infra Levy, Urja Power, Jal Board, Railway, and Airport grids.

### 12. Stale Version Concurrency Resilience & Seamless Reconnection (`game:join`)
- Eliminates `Stale version (client expected X, current is Y)` errors caused by concurrent client acknowledgment actions (`DISMISS_CARD_POPUP`, `DISMISS_MONEY_ACK`).
- State mutations are cleanly separated from transient client toasts, and UI acknowledgments are version-resilient.
- Seamless reconnection: Refreshing clients emit `game:join` to authoritatively attach to active matches, restoring full room and game states.

### 13. Authoritative Session-Wide Bail Rule Consistency
- **Single Source of Truth**: The host-configured room rule `rules.jailBail` (with canonical default ₹500) governs all bail operations across the lifetime of the match.
- **Universal Synchronization**: Jail action buttons (`Pay ₹{bail} Bail`), status indicators, rules popups, notifications, deductions, and financial transaction ledgers reference the exact same authoritative accessor with zero hardcoded fallbacks or component drift.
- **Affordability Gating**: If an incarcerated player lacks sufficient cash for statutory bail, the payment action is cleanly disabled with visual opacity and cursor feedback.

### 14. Synchronized Authoritative Dice Values & Exact Circular Token Movement
- **Single Source of Truth**: Backend validates the active turn, generates fair cryptographic dice $(d_1, d_2)$, computes total steps $S = d_1 + d_2$, records `oldPos`, and computes `newPos = (oldPos + S) % 40`.
- **Unique Roll Metadata**: Every roll event persists `rollId`, `gameSessionId`, `playerId`, `turnId`, `die1`, `die2`, `total`, `oldPos`, `newPos`, and `createdAt`.
- **Race Condition Elimination**: Client store maintains idempotent `processedRollIds`, immediately committing authoritative dice faces upon receipt to eliminate stale-dice display during pawn animations.
- **Deterministic Stepping**: Tokens walk step-by-step for exactly $S$ steps, ensuring complete visual and mathematical alignment between rolled dice and final destination coordinates.

### 15. Dedicated Elevated Player Token Layer (Zero Clipping & Unobscured Visibility)
- **Top Visual Layer**: Tokens are rendered on a dedicated elevated grid overlay ($z$-index 35/40, `pointer-events-none`, `overflow-visible`) above all board tiles.
- **Uncompromised Legibility**: Tokens are never clipped by tile boundaries or `overflow-hidden`, and always render proudly above SVG background artworks, ownership color bands, houses, towers, and tile borders.
- **Multi-Player Stacking**: Spaces occupied by multiple players utilize an offset grouping layout (`-space-x-1.5`) with drop shadows, ensuring all tokens remain visible.
- **Active Trajectory Highlighting**: Stepping tokens enlarge to 125% scale with playful bounce animations during movement.

### 16. Mortgaged City Ownership Integrity & Visiting Landing Isolation
- **Ownership Preservation**: Mortgaged properties remain strictly owned by their mortgagors and can never be bought or treated as unowned from any entry point.
- **Visiting Non-Owner Protection**: When another player lands on a mortgaged city:
  - Pays **₹0 rent**.
  - Receives **zero purchase popups** and **zero reacquisition popups**.
  - No cash or ownership transfers take place.
  - Phase smoothly advances to `MANAGEMENT`.
- **Physical Landing Reacquisition**: Reacquisition is offered exclusively to the mortgagor when they physically land on their mortgaged property during an eligible turn, requiring the exact mortgage payout received ($C_{\text{reacquire}} = V_{\text{mortgage\_received}}$).

### 17. Standardized Property Terminology ("City" vs "Property")
- **Formal Lexical Taxonomy**:
  - **"City"**: Exclusively used for municipal property spaces (space type `'PROPERTY'`), e.g., Jaipur, Connaught Place, Marine Drive (`Buy City`, `Reacquire City`, `Mortgage City`, `City Owner`, `City Payment`).
  - **"Property"**: Applied to infrastructural spaces (type `'TRANSIT'` or `'UTILITY'`), e.g., Santacruz Airport, Howrah Station, Urja Power Grid (`Buy Property`, `Reacquire Property`, `Mortgage Property`, `Property Owner`).

### 18. Symmetrical 3-Zone Navigation Header & Universal Responsiveness
- **3-Zone Navbar**: CSS Grid `grid-cols-[1fr_auto_1fr]` guarantees the central Play and Settings tabs remain mathematically centered across all viewports, balanced by the Game Logo on the extreme left and Rules (`?`), Audio Toggle, and Player Name on the right.
- **Square Aspect Ratio**: The board container enforces `aspect-square max-h-full max-w-full`, preventing vertical stretching on tall mobile portrait viewports.
- **Mobile-Adaptive Layout**: On small screens ($< 768\text{px}$), the bulky 12-rule side panels collapse into compact quick-access buttons, granting the 3D dice arena and primary controls full prominence with $\ge 44\text{px}$ tap targets.
- **iOS Safe Areas**: Native toolbar and home indicator bar support via `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)`.

### 19. Authoritative 60-Second Low-Balance Mortgage Resolution & Disqualification
- **Mandatory Debt Protection**: When a player lands on rent, airport rent, municipal taxes, or draws a financial penalty with insufficient balance ($C < D$), the original transaction is paused and converted into a tracked obligation with an authoritative 60-second deadline.
- **Independent 60-Second Countdown**: The resolution countdown ($t_{\text{expires}} = t_0 + 60\text{s}$) is independent of standard turn timers and persists across client reloads or reconnects.
- **Dual-Action Architecture**:
  - **Surrender**: Allows voluntary give up via a confirmation dialog. Disqualifies the player, permanently marks all owned properties as **BLOCKED** (generating ₹0 rent), cancels the pending debt, and advances the game without disruption.
  - **Adjust Payouts**: Interactive multi-select property mortgaging interface with dynamic live calculation of funds to be raised and remaining balance needed.
- **Automatic Payment Resumption**: Once confirmed mortgages raise sufficient funds ($C \ge D$), the engine atomically debits the debt, credits the recipient/Bank, records paired transaction ledgers, clears the obligation, and restores normal gameplay.
- **Authoritative Disqualification at 0s**: If the 60-second window expires without sufficient resolution, the backend automatically disqualifies the debtor, permanently blocks their properties, and continues the match for remaining players.
- **Spectator Separation**: Non-debtor participants view an unintrusive floating card at the bottom-left, displaying debtor status and countdown without obscuring the board.

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
| `npm run desktop` | **Native Desktop Launcher**: Builds production assets and runs the native Electron desktop application with embedded local server. |
| `npm run dist:mac` | **Package macOS DMG**: Compiles and packages the installable universal `.dmg` installer for Apple Silicon and Intel Macs. |
| `npm run dist:win` | **Package Windows EXE**: Compiles and packages the installable NSIS `.exe` installer for 64-bit Windows. |
| `npm run dist:all` | **Package Both Platforms**: Packages both macOS DMG and Windows EXE distribution binaries. |
| `npm run build:desktop` | Builds both the React LAN frontend (`dist/`) and the standalone server bundle (`dist-server/index.cjs`). |
| `npm run lan:host` | **Production Host**: Builds the production bundle (`dist/`) and starts the authoritative LAN server on `0.0.0.0:4173`. |
| `npm run lan:dev` | **Concurrent Dev**: Runs the Node.js Socket.IO server (`tsx watch`) and Vite dev server (`5173`) with live hot-reloading. |
| `npm run build:lan` | Builds the React frontend with `/` base path explicitly targeted for LAN hosting. |
| `npm run build` | Builds the React frontend for production distribution. |
| `npm run server` | Starts the Node.js server directly using `tsx server/index.ts`. |
| `npm test` | Runs the full Vitest suite (86 passing tests covering engine invariants, dice fairness, mortgage preview, Start privacy, audio triggers, and multi-client integration). |
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
