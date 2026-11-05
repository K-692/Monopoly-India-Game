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
> **Indian Monopoly** is a modern, high-performance, zero-scroll property trading board game built for local network Wi-Fi multiplayer and offline play. Designed with **React 19, TypeScript, Tailwind CSS, Node.js 22, Express, and Socket.IO**, the system operates with **zero Firebase, zero external cloud dependencies, and zero Internet connection required** during gameplay.
>
> A host player starts the lightweight Node.js server on their laptop, which automatically detects all private LAN IPv4 addresses, serves the production-built React frontend, and acts as the authoritative Socket.IO game server. Friends and family on the same Wi-Fi connect seamlessly from iPhones, Android devices, iPads, or laptops by scanning an on-screen QR code or entering a 6-character room code.

---

## 🎲 Core Game Rules & Invariants

- **Strict Single-Roll Invariant**: If a player rolls doubles (e.g., 2,2 or 6,6), they will **not** receive another chance to roll the dice. Only one time rolling is allowed per turn.
- **Jail & "Try Double" Mechanics**: An incarcerated player can attempt to roll doubles on each of their first three eligible turns. Rolling doubles releases them immediately and advances them by the roll sum without granting an extra turn. On the 4th eligible turn, automatic release is granted.
- **Authoritative Balance Validation**: City purchases and building upgrades strictly validate liquid balances on both client and server before committing any transaction.
- **Zero-Cloud LAN Multiplayer**: Fully private, server-authoritative multiplayer synchronization over local Wi-Fi.

---

## 🏛️ Comprehensive Gameplay Logic & Financial Systems

### 1. Jail Mechanics & "Try Double" System
- **Three Double Attempts**: An incarcerated player may attempt to roll doubles on each of their first three eligible turns.
- **Immediate Escape with Movement**: Rolling doubles immediately releases the player and advances their token by the dice roll total.
- **Extra Turn Suppression**: Rolling doubles while escaping jail **never grants an additional turn**. The player resolves their destination space and finishes their single turn.
- **Incarcerated Stasis on Failure**: Non-double rolls keep the player in Central Jail with zero movement.
- **Automatic 4th Eligible Turn Release**: A player who fails all three attempts is automatically released at the beginning of their 4th eligible turn without needing to roll Try Double, proceeding with normal rolling and movement.

### 2. Insufficient Balance Gating & Backend Verification
- **City Purchase Protection**: Landing on an unowned property with insufficient cash suppresses the purchase prompt and triggers a non-blocking notification: `"Insufficient balance to purchase this property."`
- **Construction Protection**: Visiting an owned city with insufficient cash suppresses the building prompt and triggers: `"Insufficient balance to build on this property."`
- **Server Validation**: The authoritative engine validates cash balances before every acquisition or construction, eliminating negative balances or race condition exploits.

### 3. Distinct Airport Visiting Tariffs
- **Aviation Tariff Scaling**: Landing on an airport owned by another player costs:
  - **1 Airport Owned**: ₹1,000
  - **2 Airports Owned (Both)**: ₹2,500
- **Railways Comparison**: CST Mumbai (#5) and Howrah Railway (#15) scale at ₹250 and ₹500.
- **Immunity Conditions**: Rent is waived if the owner is in jail, the airport is mortgaged, or the owner is in the `BLOCKED` state.

### 4. Complete Mortgaging & Financial Resolution System
- **Development-Inclusive Valuation Formula**:
  $$\text{Mortgage Payout} = \min\left(P_{\text{base}}, \left\lfloor 0.5 \times P_{\text{base}} + 0.5 \sum_{i=1}^{B} C_{\text{build}}\right\rfloor\right)$$
  Undeveloped properties yield 50% of purchase price. Developed properties receive credit for 50% of construction investments without exceeding 100% of the property's original purchase price.
- **Development Asset Preservation**: Houses and Commercial Towers are **not demolished** during mortgage. Physical developments remain intact on the deed.
- **Exact Payout Reacquisition**: The redemption cost strictly equals the exact mortgage payout originally received:
  $$C_{\text{reacquire}} = V_{\text{payout\_received}}$$
- **Mandatory Financial Resolution Window**: When a financial obligation (rent, airport rent, tax) exceeds available liquid cash, the match pauses, opening a non-bypassable resolution window for the debtor to mortgage eligible properties or surrender.
- **Surrender / Give Up & BLOCKED Property State**: If unable or unwilling to settle, choosing "Give Up" transfers remaining liquid cash to the creditor, marks the debtor as disqualified, and transitions all their properties to the `BLOCKED` state (cannot be purchased, traded, mortgaged, and generates ₹0 rent).

### 5. Non-Blocking Floating Toast Notifications
- **Bottom-Left Positioning**: Floating notifications appear at `fixed bottom-4 left-4 z-50`, completely clear of board spaces, dice arena, and action controls.
- **Zero Acknowledgment Buttons**: Acknowledgment buttons are removed entirely. Notifications feature an automatic 3-second dismissal with an animated progress bar and a small cross (`×`) icon for manual dismissal.
- **Hardware-Accelerated Animation**: Smooth entry (`slideInLeft`) and exit (`slideOutLeft`) CSS transitions.
- **Per-Player Client Isolation**: Toast notifications and dismissal actions are strictly local to each player's browser.

### 6. Authoritative Financial Ledger & Transaction History
- **Structured Transaction Records**: Every balance adjustment records an immutable entry in the authoritative transaction history:
  - `STARTING_BALANCE`, `START_REWARD`, `CITY_PURCHASE`, `HOUSE_PURCHASE`, `BUILDING_PURCHASE`, `RENT_RECEIVED`, `RENT_PAID`, `AIRPORT_RENT_RECEIVED`, `AIRPORT_RENT_PAID`, `MORTGAGE_PROCEEDS`, `MORTGAGE_REACQUISITION`, `TAX_PAYMENT`, `CARD_REWARD`, `CARD_PENALTY`, `JAIL_PAYMENT`, `DISQUALIFICATION_ADJUSTMENT`.
- **Linked Transaction IDs**: Player-to-player transfers generate paired debit and credit records linked by the exact same `transactionId`.
- **In-Game Financial Statement**: Viewable in the Player Profile modal with reverse-chronological ordering, timestamp, counterparty, property name, and signed currency amounts (`+₹1,500` / `-₹800`).

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

## 🛠️ CLI Commands & Development Scripts

| Command | Purpose |
|:---|:---|
| `npm run lan:host` | **Production Host**: Builds the production bundle (`dist/`) and starts the authoritative LAN server on `0.0.0.0:4173`. |
| `npm run lan:dev` | **Concurrent Dev**: Runs the Node.js Socket.IO server (`tsx watch`) and Vite dev server (`5173`) with live hot-reloading. |
| `npm run build:lan` | Builds the React frontend with `/` base path explicitly targeted for LAN hosting. |
| `npm run build` | Builds the React frontend for production distribution. |
| `npm run server` | Starts the Node.js server directly using `tsx server/index.ts`. |
| `npm test` | Runs the full Vitest suite (38 passing tests covering game engine invariants, jail escapes, mortgages, paired transaction IDs, and real multi-client Socket.IO integration). |
| `npm run test:e2e` | Runs multi-browser Playwright E2E suite. |
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
