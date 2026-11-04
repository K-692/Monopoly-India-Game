# Indian Monopoly — Implementation Plan & Roadmap

## 1. Project Overview & Objectives
**Indian Monopoly** is a responsive, real-time multiplayer board game set in an Indian urban landscape. It features 40 board spaces, authentic Indian cities, transit networks, utilities, tax checkposts, and dynamic event cards ("Civic Fund" & "Market Buzz").

### Core Engineering Principles
1. **Server-Authoritative Game Architecture**: The browser is an untrusted presentation client. All dice rolls, pawn movements, property deeds, cash transactions, jail logic, bankruptcy, and victory calculations are strictly validated and executed on the backend (Firebase Cloud Functions / pure TypeScript domain engine).
2. **Universal Responsive & Touch-First Design**: Native feel across desktop browsers (Chrome, Safari, Edge, Firefox), tablets (iPads, Android tablets), and mobile devices (iPhones, Android phones from 320px to 430px+).
3. **PWA-Ready & Resilient**: Handles offline states, network interruptions, and reconnects gracefully without losing player seats or game state.
4. **Rich Sensory Experience**: Curated visual design matching the Indian palace aesthetic with custom mandalas, terracotta/cream colorway, and procedural Web Audio API sound effects.
5. **Privacy-Conscious & Secure**: Strict Firebase Security Rules, authenticated callable endpoints, bounded event storage, and an archive-before-delete lifecycle.

---

## 2. Milestone Breakdown

| Milestone | Title | Scope & Deliverables | Verification Gates |
|---|---|---|---|
| **M0** | Documentation & Architecture | Specification analysis, architectural decisions, technical documentation, ruleset baseline | Docs approved, repo initialized |
| **M1** | Project Scaffold & Design System | Vite, React 19, TypeScript strict, Tailwind CSS, design tokens, UI primitives, audio engine, CI workflows | Build passes, typecheck passes, tests pass |
| **M2** | Responsive Shell & Routes | Landing page, dashboard, room lobby shell, game view shell, sound controls, responsive navigation | Playwright viewports (320px to 1920px) |
| **M3** | Firebase Client & Auth | Centralized Firebase module, Google OAuth popup/redirect, auth state persistence, user profile creation | Auth emulator + smoke tests |
| **M4** | Friend System | Unique friend codes, sending/accepting/rejecting requests, friend list, room invites | Friend service unit & integration tests |
| **M5** | Room Management & Lobby | Create room, join via invite code/deep link, ready toggle, host controls, membership limits (2-6 players) | Multi-client lobby sync tests |
| **M6** | Pure TypeScript Game Engine | 40-space board config, dice & doubles, Start pass bonus, property acquisition, rent calculations, development, mortgages, jail, Civic & Market cards, bankruptcy, victory | 100% engine unit test coverage & invariant checks |
| **M7** | Firebase Server Engine & Cloud Functions | Callable command handlers, Firestore transactions, versioning, idempotency keys, server-generated dice, append-only event logs | Concurrent transaction & replay tests |
| **M8** | Live Real-Time Gameplay UI | Interactive board rendering, animated pawn movement, 3D/2D dice roll, property deed viewer, bottom sheet for mobile, sound playback | Real-time 2-player browser test |
| **M9** | Reactions & Ephemeral Emotes | Curated reaction tray (👏, 😂, 😮, 😭, 🔥, ❤️, 🤝, 🎉), rate limiting, auto-expiring popups | Abuse & rate limit tests |
| **M10** | Presence & Reconnection | Realtime Database / Firestore presence, heartbeat, seamless rejoin on page refresh/tab switch | Disconnect/reconnect simulation |
| **M11** | Post-Game Archival & Cleanup | Final standings calculation, immutable archive in `gameArchives`, verified cleanup of live session | Archive-before-delete verification |
| **M12** | Hardening & Accessibility | Firestore Security Rules tests, WCAG 2.2 AA contrast, keyboard navigation, touch targets, sound toggle | Security emulator test suite & Lighthouse |
| **M13** | CI/CD & GitHub Pages Deployment | GitHub Actions workflow, SPA routing fallback (404.html / hash router), production build verification | Deployed to GitHub Pages |

---

## 3. Detailed Verification Matrix

### Device & Viewport Test Matrix
- **Small Phone**: 320 × 568 (iPhone SE gen 1)
- **Standard iPhone**: 375 × 667 (iPhone 8 / SE gen 2)
- **Modern iPhone**: 390 × 844 (iPhone 13 / 14 / 15)
- **Large Phone**: 430 × 932 (iPhone 14/15/16 Pro Max, Samsung Galaxy S Ultra)
- **Small Tablet**: 768 × 1024 (iPad Mini)
- **iPad Portrait**: 820 × 1180 (iPad Air)
- **Tablet Landscape**: 1024 × 768
- **Laptop**: 1366 × 768
- **Desktop**: 1920 × 1080

### Browser Compatibility Matrix
- Safari on iOS & iPadOS (safe area insets, dynamic viewport `dvh`, audio gesture unlock)
- Chrome on Android & Desktop
- Firefox on Desktop & Android
- Microsoft Edge on Windows

