# Indian Monopoly — Software Architecture Document

## 1. Executive Summary
Indian Monopoly is engineered as a server-authoritative, real-time multiplayer board game with an Indian urban theme. It employs a split architectural model:
- **Presentation Tier**: Static single-page application (React 19 + TypeScript + Vite + Tailwind CSS) deployed on GitHub Pages.
- **Backend & Authoritative Domain Tier**: Firebase Cloud Functions (TypeScript) executing transactions against Cloud Firestore, with optional Realtime Database for presence and transient reaction broadcasts.

```
+-------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                 |
|                                                                               |
|   +-----------------------+   +---------------------+   +-----------------+   |
|   |  Desktop View (3-Col) |   | Tablet View (2-Col) |   | Mobile Touch UI |   |
|   +-----------------------+   +---------------------+   +-----------------+   |
|                              |                                                |
|               +--------------+---------------+                                |
|               |  Web Audio Procedural Sound  |                                |
|               +--------------+---------------+                                |
|                              |                                                |
|     +------------------------+-------------------------+                      |
|     |  State Store (Zustand) & Firebase Listeners      |                      |
|     +------------------------+-------------------------+                      |
+------------------------------|------------------------------------------------+
                               |
                               | HTTPS Callable / Firestore Listeners
                               v
+-------------------------------------------------------------------------------+
|                                FIREBASE BACKEND                               |
|                                                                               |
|   +--------------------+     +-------------------+     +------------------+   |
|   |  Firebase Auth     |     |  Cloud Firestore  |     |  Cloud Functions |   |
|   |  (Google Identity) |     |  - users          |     |  - createRoom    |   |
|   +--------------------+     |  - rooms          |     |  - joinRoom      |   |
|                              |  - games (live)   |     |  - submitAction  |   |
|   +--------------------+     |  - events (audit) |     |  - sendReaction  |   |
|   |  Realtime Database |     |  - gameArchives   |     |  - archiveGame   |   |
|   |  (Presence/Emotes) |     +-------------------+     +------------------+   |
|   +--------------------+                                                      |
+-------------------------------------------------------------------------------+
```

---

## 2. Server-Authoritative Trust Boundary

### Non-Negotiable Security Principles
1. **Zero Client Authority**: The browser never decides dice outcomes, pawn destination, property purchasing eligibility, rent calculation, house building, mortgages, auctions, or bankruptcy.
2. **Versioned Commands & Idempotency**:
   Every mutation sent from the client includes:
   ```typescript
   interface GameCommand {
     commandId: string;        // Client-generated UUIDv4
     roomId: string;           // Target room identifier
     gameId: string;           // Active game snapshot identifier
     expectedVersion: number;  // Optimistic concurrency control
     type: GameActionType;     // Action name
     payload: Record<string, unknown>;
   }
   ```
3. **Firestore Atomic Transactions**:
   Functions execute within Firestore transactions that:
   - Verify `game.version === expectedVersion`.
   - Validate that `callerUid === game.currentPlayerUid`.
   - Generate cryptographically secure dice rolls (`crypto.randomInt(1, 7)`).
   - Evaluate rules (e.g. doubles, Go to Jail, rent calculation).
   - Increment `version` and append to `events` subcollection.

---

## 3. Core Game Engine State Machine

```
                 +---------------+
                 |     LOBBY     |
                 +-------+-------+
                         | Host clicks start (2-6 players ready)
                         v
                 +---------------+
                 |  INITIALIZING |
                 +-------+-------+
                         | Server builds initial board & player order
                         v
+--------------->+---------------+
|                |  IN_PROGRESS  |
|                +-------+-------+
|                        |
|        +---------------+---------------+
|        | Dice Roll / Movement          |
|        v                               v
|  +------------+                 +---------------+
|  | Normal Turn|                 |ACTION_REQUIRED|
|  +-----+------+                 | (Buy/Auction/ |
|        |                        |  Jail/Debt)   |
|        v                        +-------+-------+
|  +------------+                         | Action resolved
|  | End Turn   |                         |
|  +-----+------+                         |
|        |                                |
|        +--------------------------------+
|        |
|        v Check game over (1 solvent player remaining)
|  +---------------+
|  |   COMPLETED   |
|  +-------+-------+
|          | Verified archival to `gameArchives`
|          v
|  +---------------+
|  |    CLEANUP    | (Delete live room, game, members & events)
|  +---------------+
```

---

## 4. Universal Responsive Layout Architecture

### 4.1 Desktop & Laptop Viewports (>= 1024px)
- **Left Panel (280px - 320px)**: Active players overview, net worth, turn status indicator, token indicators.
- **Center Canvas**: Full 40-space authentic Indian Monopoly board with central palace illustration, card decks, and animated pawn tokens.
- **Right Panel (300px - 340px)**: Action cards (Roll Dice, Buy Property, Auction, Mortgage, Manage Towers) and deed detail view.
- **Bottom Footer**: Scrolling event log and quick-access emote reaction tray.

### 4.2 Tablet Viewports (768px - 1023px)
- Adaptive 2-column or tabbed split.
- Board scaled dynamically using container aspect ratio (`aspect-square max-h-[75vh]`).
- Player stats accessible via floating avatar strip or quick drawer.
- Action controls grouped into a tactile bottom bar.

### 4.3 Mobile Viewports (320px - 767px)
- **Board Display**: Auto-scales or provides intuitive touch pan/zoom to focus on current player position and destination.
- **Header**: Minimal bar showing current turn, player balance, sound & settings toggles.
- **Action Bottom Sheet**: Contextual drawer sliding up when an action is required (e.g. "Buy Jaipur MI Road for ₹2,000", "Pay Rent ₹150").
- **Primary CTA**: Large thumb-friendly 56px floating action button for rolling dice.
- **Emote Drawer**: Quick swipeable reaction strip.

---

## 5. Sound & Audio System
Built directly on the **Web Audio API** with zero external asset dependencies:
- **Tone & Noise Synthesis**: Uses oscillators (`sine`, `triangle`, `square`) and noise buffers.
- **Events**:
  - `DICE_ROLL`: Procedural rattle and settle thud.
  - `TOKEN_STEP`: Soft wooden click chime.
  - `CASH_EARNED`: Crisp metallic coin register ding.
  - `RENT_PAID`: Gentle descending chime.
  - `PROPERTY_BOUGHT`: Regal harmonic fanfare.
  - `JAIL_LOCK`: Heavy mechanical slam.
  - `EMOTE_SENT`: Playful bubble pop.
  - `BUTTON_CLICK`: Micro haptic click.
- **Browser Autoplay Compliance**: Unlocks `AudioContext` on first user touch/click.
- **Volume & Mute**: Persisted in local settings with instant UI toggle.

