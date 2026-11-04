# Indian Monopoly — Architectural Decision Log (ADR)

This document records the foundational architectural decisions made for Indian Monopoly in accordance with the Implementation Manual.

---

## ADR-001: Firebase Region Selection
- **Status**: Decided
- **Context**: The game is targeted primarily at users in India and the South Asian diaspora, requiring low-latency synchronization and co-location of database and functions.
- **Decision**: Select `asia-south1` (Mumbai) for Cloud Firestore and Firebase Cloud Functions.
- **Rationale**: Minimal network roundtrip latency for Indian players. Co-locating Firestore and Functions eliminates cross-region transit fees and serialization latency.

---

## ADR-002: Routing Strategy for GitHub Pages
- **Status**: Decided
- **Context**: The client application is hosted as a static site on GitHub Pages. Direct deep links (e.g. `/room/IND-8492` or `/game/abc123xyz`) cause HTTP 404 on traditional static web servers when using standard HTML5 pushState without server rewrites.
- **Decision**: Implement a dual strategy:
  1. Default to **HashRouter** (`/#/room/XYZ`) for seamless deep linking, bookmarking, and link sharing on GitHub Pages without requiring server configuration.
  2. Provide a standardized `public/404.html` SPA redirect fallback script for standard BrowserRouter compatibility if a custom domain with root base is attached.
- **Rationale**: Zero configuration failure on GitHub Pages, prevents broken invite links, works identically across Safari iOS, Android Chrome, and desktop.

---

## ADR-003: Reaction & Ephemeral Emote Transport
- **Status**: Decided
- **Context**: In-game player reactions (emotes such as 👏, 😂, 🔥, ❤️) are short-lived (5-10 seconds) and high-frequency.
- **Decision**:
  - Support dual transport: Firebase Realtime Database when configured via `VITE_FIREBASE_DATABASE_URL`, falling back seamlessly to an ephemeral Firestore subcollection (`games/{gameId}/reactions`) with client-side 6-second auto-expiry.
  - Rate-limit to 3 reactions per 5 seconds per player enforced on both client and server.
- **Rationale**: Enables full functionality even if Realtime Database is not yet provisioned on the Firebase project, with clear upgrade path to RTDB.

---

## ADR-004: Room Invite Code Entropy & Security
- **Status**: Decided
- **Context**: Room codes must be easily typed and shared on mobile devices without ambiguity, yet have enough entropy to prevent enumeration attacks.
- **Decision**:
  - Format: 6-character alphanumeric code using an unambiguous alphabet (excluding `0`, `O`, `1`, `I`, `L`, `8`, `B`): e.g. `2345679ACDEFGHJKMNPQRSTUVWXYZ` (29 characters).
  - $29^6 \approx 594\text{ million}$ combinations.
  - Indexed via hashed lookup `rooms.inviteCodeHash = SHA256(code.toUpperCase())`.
  - Rate-limit join attempts to 5 per minute per IP/UID to prevent brute-force guessing.
- **Rationale**: Maximum readability on phones, effortless cross-device sharing, strong defense against automated scraping.

---

## ADR-005: Game Session Archival & Two-Stage Cleanup
- **Status**: Decided
- **Context**: When a game terminates, players want to view their game history and final standings. However, live rooms and unbounded event documents must not accumulate and inflate Firestore storage costs.
- **Decision**: Implement a two-stage archival workflow:
  1. **Archive**: Upon game completion, write a bounded immutable summary record to `gameArchives/{gameId}` containing final player standings, net worth, start/end timestamps, and compact event milestones.
  2. **Verification & Cleanup**: Verify `gameArchives/{gameId}` write success; only then delete live documents in `games/{gameId}` and `rooms/{roomId}` with recursive subcollection cleanup.
- **Rationale**: Guarantees zero data loss from transient failures during cleanup.

---

## ADR-006: Turn Timeout & Auto-Action Policy
- **Status**: Decided
- **Context**: If a player disconnects, switches tabs, or goes AFK, the other players should not be blocked indefinitely.
- **Decision**:
  - Optional turn timers (off, 30s, 45s, 60s) configured by the host at room creation.
  - When timer expires on the server:
    - If awaiting roll: roll automatically for the player.
    - If awaiting property buy: auto-decline and send to auction (or pass if auction).
    - If in jail: attempt free doubles or auto-pay bail if cash permits.
    - If awaiting trade response: auto-reject trade.
    - Auto-end turn.
- **Rationale**: Deterministic, game progresses continuously without stalling.

---

## ADR-007: Host Disconnection & Leadership Election
- **Status**: Decided
- **Context**: The player who created the room may leave or disconnect during the lobby phase or during the game.
- **Decision**:
  - In Lobby: If host leaves, ownership transfers automatically to the earliest remaining member (`joinedAt` ASC). If all players leave, lobby expires after 24 hours.
  - In Game: Host status is purely administrative; in-game turn order and rules are governed by the canonical game state machine regardless of who created the room.
- **Rationale**: Eliminates single point of failure.

---

## ADR-008: Game Rules Versioning
- **Status**: Decided
- **Context**: Rule balances or prices may be tuned in future releases.
- **Decision**: Store ruleset configuration with an explicit semantic version (e.g. `1.0.0`). Every active game and archive stores `rulesetVersion: "1.0.0"`.
- **Rationale**: Full backwards compatibility for past game archives when viewing historical records.

