# 🇮🇳 Indian Monopoly — Online Multiplayer Board Game

[![CI](https://github.com/K-692/Monopoly-India-Game/actions/workflows/ci.yml/badge.svg)](https://github.com/K-692/Monopoly-India-Game/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Functions-orange.svg)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4+-38b2ac.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646cff.svg)](https://vite.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-Multi--Device%20E2E-green.svg)](https://playwright.dev/)

A modern, responsive, real-time multiplayer property trading board game celebrating India's iconic cities, transit systems, and commerce. Built with a **server-authoritative** architecture, Google authentication, instant room codes, procedural Web Audio sound effects, and an Indian palace-inspired visual design.

---

## 🌟 Key Highlights

- 🏰 **Authentic Indian Board**: 40 spaces featuring 22 major Indian city properties (from *Jaipur MI Road* to *Mumbai Marine Drive*), 4 transit networks, 2 utilities (*Urja Power Grid* & *Jal Board*), *GST Checkposts*, and dynamic *Civic Fund* & *Market Buzz* cards.
- 🔒 **Server-Authoritative Game Engine**: The client never decides dice rolls, rents, or money. Every state change is validated and committed via atomic transactions in Firebase Cloud Functions.
- 📱 **Universal Cross-Device Responsive**:
  - **Desktop & Mac**: Full 3-column panoramic interface with player financial boards, deed inspections, and live event ticker.
  - **Tablets & iPads**: Adaptive 2-column layout respecting orientation changes and touch inputs.
  - **Mobile (iPhone & Android)**: Bottom-sheet action trays, thumb-friendly floating roll controls, and zoomable board navigation with iOS safe-area handling.
- 🎵 **Procedural Web Audio Sound FX**: Zero remote audio lag. Rich, synthesized dice rolls, pawn steps, coin register jingles, jail lock clangs, and reaction pops.
- 🤝 **Social & Room Management**: Google Sign-In, 6-character human-readable invite codes (unambiguous charset), friend requests, and pre-game lobbies supporting 2 to 6 players.
- ⚡ **Real-Time Multiplayer & Reconnection**: Firestore live snapshots with optimistic UI feedback and seamless reconnection if mobile network momentarily drops.
- 👏 **Curated Emote Reactions**: Express yourself with rate-limited, auto-expiring in-game reactions without toxic chat text.
- 📜 **Post-Game Archival**: Two-stage verified session archival retaining player rankings, net-worth metrics, and summary timelines.

---

## 🎲 Board Layout & Properties

```
+---------------------------------------------------------------------------------------------+
| REST    | HYDERABAD | MARKET | HYDERABAD | BENGALURU | CHENNAI | BENGALURU | KOLKATA | GO TO|
| HOUSE   | CYBER TW  |  BUZZ  | HI-TECH   | MG ROAD   | CENTRAL | BRIGADE RD| PARK ST | JAIL |
| (20)    | (21)      | (22)   | (23)      | (24)      | (25)    | (26)      | (27)    | (30) |
+---------+-------------------------------------------------------------------------+---------+
| KOZHIKODE                                                                         | KOLKATA |
| (19)                                                                              | (31)    |
|---------+                                                                         +---------|
| KOCHI                                🇮🇳 INDIAN MONOPOLY                           | JAL     |
| (18)                                                                              | BOARD   |
|---------+                         Server-Authoritative Multi-Device               | (32)    |
| CIVIC                                                                             +---------|
| FUND                                                                              | BHUBAN- |
| (17)                                                                              | ESHWAR  |
|---------+                                                                         | (33)    |
| THIRUVAN-                                                                         +---------|
| ANTHAPURAM                                                                        | CHENNAI |
| (16)                                                                              | (34)    |
|---------+                                                                         +---------|
| HOWRAH                                                                            | DELHI   |
| METRO                                                                             | METRO   |
| (15)                                                                              | (35)    |
|---------+                                                                         +---------|
| SURAT                                                                             | MARKET  |
| (14)                                                                              | BUZZ    |
|---------+                                                                         | (36)    |
| VADODARA                                                                          +---------|
| (13)                                                                              | CHENNAI |
|---------+                                                                         | BOAT CL |
| URJA                                                                              | (37)    |
| POWER                                                                             +---------|
| (12)                                                                              | INFRA   |
|---------+                                                                         | LEVY    |
| AHMEDABAD                                                                         | (38)    |
| (11)                                                                              | +-------|
|---------+                                                                         | DELHI CP|
| JAIL /                                                                            | (39)    |
| VISITING+-------------------------------------------------------------------------+---------+
| (10)    | AGRA    | VARANASI | LUCKNOW | MUMBAI  | GST       | JODHPUR | CIVIC | JAIPUR | START|
|         | (9)     | (8)      | (6)     | LOCAL(5)| CHECKPOST | (3)     | FUND  | (1)    | (0)  |
+---------------------------------------------------------------------------------------------+
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript 5.7](https://www.typescriptlang.org/) |
| **Build & Dev Tooling** | [Vite 6](https://vite.dev/) |
| **Styling & Tokens** | [Tailwind CSS 3.4](https://tailwindcss.com/) + CSS Custom Properties |
| **UI Primitives** | [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/) |
| **Audio Engine** | Web Audio API (procedural synthesis for zero-latency cross-platform sound) |
| **Routing** | [React Router 7](https://reactrouter.com/) (with HashRouter for GitHub Pages compatibility) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) + [TanStack Query](https://tanstack.com/query) |
| **Backend & Realtime** | [Firebase Authentication](https://firebase.google.com/docs/auth), [Cloud Firestore](https://firebase.google.com/docs/firestore), [Cloud Functions](https://firebase.google.com/docs/functions) |
| **Testing** | [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/), [Playwright](https://playwright.dev/) |
| **Deployment** | GitHub Pages (Frontend) + GitHub Actions CI/CD |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20.x or 22.x LTS (or recent Node version)
- npm 10+
- Optional: [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`) for local emulator integration

### 1. Clone the repository
```bash
git clone https://github.com/K-692/Monopoly-India-Game.git
cd Monopoly-India-Game
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default public web configuration for project `monopoly-india-f9700` is pre-populated for client access.

### 4. Run local development server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 🧪 Testing & Quality Gates

Run the automated test suites:

```bash
# Run unit tests
npm run test

# Run TypeScript typechecks
npm run typecheck

# Run linter
npm run lint

# Run end-to-end multi-device browser tests
npm run test:e2e

# Run production build
npm run build
```

---

## 📂 Repository Structure

```text
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Continuous Integration pipeline
│       └── deploy-pages.yml       # Automated GitHub Pages static deployment
├── docs/
│   ├── ARCHITECTURE.md            # Detailed system architecture and state machine
│   ├── DECISION_LOG.md            # Architectural Decision Records (ADRs)
│   ├── DEVELOPMENT_STATUS.md      # Live milestone tracking & test results
│   └── IMPLEMENTATION_PLAN.md     # 13-milestone implementation plan
├── functions/                     # Firebase Cloud Functions (backend domain authority)
│   ├── src/
│   │   ├── index.ts
│   │   ├── callable/
│   │   └── game-engine/
├── public/
│   ├── assets/                    # Optimized visual assets
│   ├── manifest.webmanifest       # PWA manifest
│   └── 404.html                   # SPA routing fallback for GitHub Pages
├── src/
│   ├── app/                       # Application shell and routing
│   ├── components/                # Modular UI primitives, board views, player cards
│   ├── domain/                    # Pure TypeScript game rules, board config, action schemas
│   ├── features/                  # Auth, Dashboard, Lobby, Game, Friends, History, Settings
│   ├── lib/                       # Firebase services, Audio engine, Validation
│   └── styles/                    # Tailwind CSS custom utilities and design tokens
├── flow.md                        # Implementation journey and academic record
├── firestore.rules                # Strict Firestore security rules
└── vite.config.ts                 # Vite bundler configuration
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check out [issues](https://github.com/K-692/Monopoly-India-Game/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
