# Indian Monopoly: Architectural Specifications, Autonomous Agents & System Implementation Journey

> **Document Type:** Formal System Architecture & Research Implementation Record  
> **Repository:** `https://github.com/K-692/Monopoly-India-Game`  
> **Target Audience:** Systems Researchers, Distributed Systems Engineers, Game Theory & Multi-Agent Researchers  
> **Status:** Current State Production Implementation (Simplified Room Creation, 6-Slot Waiting Lobby & Host-Controlled Multi-Agent Seating)  

---

## 1. Abstract & System Philosophy

**Indian Monopoly** is a distributed, server-authoritative digital adaptation of classic property trading dynamics set in an Indian economic context (cities across India, Reserve Bank of India conventions, GST checkposts, Civic Funds, and Infrastructure Levies). The system operates across web browsers, local offline Wi-Fi (LAN), and cross-platform desktop runtimes (Electron for macOS and Windows).

A foundational design requirement of this platform is **Strict Multi-Agent Parity & Turn Integrity**:
- Autonomous computer-controlled agents (CPUs) and human players participate within the exact same game session, obeying identical rules, financial invariants, and state transitions.
- The authoritative engine enforces zero special privileges or backdoors for automated players: every move, dice roll, financial settlement, and property transaction executes through the exact same serialized command pipeline (`applyGameCommand`) whether initiated by a human client or an autonomous agent.
- A player's turn is treated as complete **only after every action, movement animation, landing rule, and pending decision belonging to that turn has been fully resolved**.
- A guaranteed **2-second inter-turn delay** is enforced whenever transitioning to a computer-controlled player (consecutive CPU turns or after a human turn), during which the CPU does not act and the next player's timer does not decrement.
- Player countdown timers **pause during token movement animations** across all connected clients and reset to their full configured duration only when entering a genuinely new actionable phase (e.g., `PROPERTY_DECISION`).
- The dedicated **120-second financial resolution timer** operates completely independently from the normal turn timer and is never reset by property sales or client refreshes.

---

## 2. High-Level System Architecture

```
                                      +---------------------------------------------+
                                      |            CLIENT ENVIRONMENT               |
                                      |  (React 19, Zustand 5, Tailwind CSS, Vite)  |
                                      |                                             |
                                      |  +-------------------+  +----------------+  |
                                      |  |     GameBoard     |  |   PlayerStrip  |  |
                                      |  | (Animations, CSS) |  |  (PAUSED Badge)|  |
                                      |  +---------^---------+  +--------^-------+  |
                                      |            |                     |          |
                                      |     useGameStore <---------------+          |
                                      +------------|--------------------------------+
                                                   | Socket.IO WebSockets
                                                   | (Client Emits Actions / Receives State & Timer)
                                                   v
+-----------------------------------------------------------------------------------+
|                        AUTHORITATIVE SERVER ARCHITECTURE                          |
|                                                                                   |
|  +--------------------+       +------------------------------------------------+  |
|  |    RoomManager     |       |                  GameManager                   |  |
|  |  - Host Rules      |       |  - Cryptographic Fair Dice (Rejection Sampling)|  |
|  |  - Starting Cash   |       |  - Serialized Action Queue                     |  |
|  |  - CPU Seating     |       |  - Movement Pacing & Authoritative Completion  |  |
|  |  - Name Collisions |       |  - 2-Second CPU Handoff Coordination           |  |
|  +---------+----------+       |  - Phase-Aware Timer Pause & Reset Logic       |  |
|            |                  |  - Independent 120s Financial Resolution Timer |  |
|            |                  +-----------------------^------------------------+  |
|            v creates initial state                    |                           |
|  +----------------------------------------------------+------------------------+  |
|  |                       Core Game Engine (`applyGameCommand`)                 |  |
|  |  - State Invariants                                                         |  |
|  |  - Debt & Bankruptcy Tracking                                               |  |
|  |  - Visiting-City House Construction Enforcement                             |  |
|  |  - Bank-Sold Property & House Inheritance Logic                             |  |
|  +------------------------------------^----------------------------------------+  |
|                                       |                                           |
|                                       | invokes command pipeline                  |
|                        +--------------+---------------+                           |
|                        |       CpuController          |                           |
|                        | (Autonomous Turn Coordinator)|                           |
|                        | - Session-Level Locks        |                           |
|                        | - Handoff & Movement Gates   |                           |
|                        +--------------^---------------+                           |
|                                       | evaluates pure policy                     |
|                        +--------------+---------------+                           |
|                        |      CpuDecisionEngine       |                           |
|                        | (Deterministic Heuristics)   |                           |
|                        +------------------------------+                           |
+-----------------------------------------------------------------------------------+
```

---

## 3. Turn Lifecycle, Sequential Execution & State Machine

### 3.1 Formal State Machine Specifications
The turn state machine coordinates execution across client presentation and server truth:

$$\text{Phases: } P = \{\text{AWAIT\_ROLL}, \text{JAIL\_DECISION}, \text{PROPERTY\_DECISION}, \text{MANAGEMENT}, \text{ACTION\_REQUIRED}, \text{TURN\_END}\}$$
$$\text{Modifiers: } M = \{\text{MOVEMENT\_ACTIVE}, \text{HANDOFF\_ACTIVE}, \text{TIMER\_PAUSED}\}$$

```mermaid
stateDiagram-v2
    [*] --> TURN_START
    TURN_START --> AWAIT_ROLL: inJail == false
    TURN_START --> JAIL_DECISION: inJail == true

    state JAIL_DECISION {
        [*] --> TryDoubles: Roll Dice
        [*] --> PayBail: Pay ₹500
        [*] --> UseBailCard: Use Bail Key Card
    }

    JAIL_DECISION --> AWAIT_ROLL: Escaped Jail (Normal Roll)
    JAIL_DECISION --> TURN_END: Failed Doubles / 3 Attempts

    AWAIT_ROLL --> MOVEMENT_ACTIVE: ROLL_DICE Committed
    
    state MOVEMENT_ACTIVE {
        [*] --> PauseTimer: isTimerPaused = true
        PauseTimer --> WalkingAnimation: T_move = 600 + (steps * 380) + 300 ms
        WalkingAnimation --> SettleDestination: onMovementCompleted()
    }

    MOVEMENT_ACTIVE --> LANDING_RESOLUTION: Token Arrives at Destination

    state LANDING_RESOLUTION {
        [*] --> EvaluateSpace: Check Board Index
        EvaluateSpace --> PropertyLanding: Unowned / Sold to Bank
        EvaluateSpace --> RentOrTax: Automatic Payment
        EvaluateSpace --> SpecialSpace: Civic Fund / Market Buzz / Jail
    }

    PropertyLanding --> PROPERTY_DECISION: Reset Timer (Fresh 30s)
    RentOrTax --> ACTION_REQUIRED: Insufficient Cash (120s Debt Timer)
    RentOrTax --> MANAGEMENT: Solvent (Reset Timer to 30s)
    SpecialSpace --> MANAGEMENT: Solvent (Reset Timer to 30s)

    PROPERTY_DECISION --> MANAGEMENT: Buy or Decline Committed
    ACTION_REQUIRED --> MANAGEMENT: Debt Extinguished via Sell to Bank
    ACTION_REQUIRED --> COMPLETED: 120s Timeout / Give Up (Game Over)

    MANAGEMENT --> TURN_END: Player / CPU Ends Turn
    
    state TURN_END {
        [*] --> AdvanceTurn: advanceTurn(state)
        AdvanceTurn --> CheckNextPlayer: Identify Next UID
    }

    TURN_END --> HANDOFF_ACTIVE: Next Player is CPU
    TURN_END --> TURN_START: Next Player is Human

    state HANDOFF_ACTIVE {
        [*] --> Wait2Seconds: delayMs = 2000 (Timer Paused)
        Wait2Seconds --> ActivateNextTurn: onHandoffCompleted()
    }

    HANDOFF_ACTIVE --> TURN_START: Fresh Timer (30s) Started
```

### 3.2 Authoritative Movement Pacing
When a player rolls the dice, movement duration is calculated deterministically on the server:

$$T_{\text{move}} = T_{\text{dice\_tumble}} + (\Delta \text{spaces} \times T_{\text{step}}) + T_{\text{settle}}$$

In production:
- $T_{\text{dice\_tumble}} = 600\text{ ms}$
- $T_{\text{step}} = 380\text{ ms}$
- $T_{\text{settle}} = 300\text{ ms}$

During this window:
1. `state.movement = { playerId, startPos, targetPos, steps, startedAt, endsAt, durationMs, isComplete: false }`.
2. `state.isTimerPaused = true`. The countdown ticker does **not** decrement.
3. All gameplay actions from any player are rejected with `INVALID_PHASE: Player token is currently moving`.
4. At `endsAt`, the server executes `onMovementCompleted()`:
   - Sets `movement.isComplete = true` and `isTimerPaused = false`.
   - If transitioning to `PROPERTY_DECISION`, the player timer is **reset to its full configured duration** (e.g., 30s).
   - Broadcasts the resumption to all connected clients.

---

## 4. 2-Second CPU Pacing & Session-Level Execution Locking

### 4.1 Inter-Turn Handoff Delay
Whenever control transitions to a computer player:
- `CPU1 -> CPU2`: Wait at least 2 seconds before CPU2 rolls.
- `CPU2 -> CPU3`: Wait at least 2 seconds before CPU3 rolls.
- `Human -> CPU1`: Wait at least 2 seconds before CPU1 rolls.

**Invariants:**
- `state.handoff = { fromPlayerUid, toPlayerUid, startedAt, endsAt, delayMs: 2000, isActive: true }`.
- `state.isTimerPaused = true`. The next player's countdown does **not** run during handoff.
- The next CPU does not roll dice, make decisions, or move until `onHandoffCompleted()` triggers.
- Reconnects or client refreshes do not duplicate or skip the handoff delay.
- If the game ends during handoff, pending timers are cancelled immediately.

### 4.2 Session-Level Execution Lock
To prevent overlapping CPU actions, `CpuController` maintains strict session-level locks:
```typescript
interface GameCpuSession {
  gameId: string;
  lockedTurnId: number | null;
  lockedPlayerUid: string | null;
  status: 'IDLE' | 'HANDOFF' | 'WAITING_FOR_TURN' | 'DECIDING' | 'ACTION_PENDING' | 'WAITING_FOR_RESULT';
  activeTimer: NodeJS.Timeout | null;
  isProcessing: boolean;
  currentActionId: string | null;
  retryCount: number;
}
```
- A CPU turn cannot execute if another action is in flight (`isProcessing === true`).
- The session is bound to `(turnNumber, cpuUid)`. If the turn advances while a timer is pending, the obsolete execution is discarded.
- All actions carry idempotent IDs (`cmd_cpu_<timestamp>_<uuid>`). Duplicate deliveries are returned from cache without re-execution.

---

## 5. Timer Architecture & Financial Resolution Isolation

### 5.1 Dual-Timer Model

| Timer Type | Scope & Trigger | Initial Duration | Reset Policy | Expiration Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **Normal Player Turn Timer** | `AWAIT_ROLL`, `JAIL_DECISION`, `PROPERTY_DECISION`, `MANAGEMENT` | Host-configured (15s, 30s, 45s, 60s; default 30s) | Pauses during movement/handoff; resets to **full duration** on new actionable phase | Auto-roll (`AWAIT_ROLL`), Auto-decline (`PROPERTY_DECISION`), Auto-end turn (`MANAGEMENT`) |
| **Financial Resolution Timer** | `ACTION_REQUIRED` (Negative cash deficit) | Statutory **120 seconds** fixed | **Never resets** on property sales, mortgages, or reconnects | Disqualification & immediate Game Over (`PLAYER_DISQUALIFIED`) |

### 5.2 Strict Invariance
- `resetTurnTimer()` explicitly guards against resetting the 120-second timer when in `ACTION_REQUIRED`.
- Selling cities or infrastructure to the bank reduces the debt deficit while the original `expiresAt` timestamp remains fixed.

---

## 6. Implementation Journey & Milestones

```mermaid
flowchart TD
    M1["1. Root-Cause Analysis<br>• Premature CPU handoffs identified<br>• Movement animation race conditions<br>• Timer ticking during token walking"]
    M2["2. Authoritative Movement & Handoff Schema<br>• MovementState & TurnHandoffState in game-types.ts<br>• TimerSyncPayload extended in server-types.ts"]
    M3["3. Authoritative GameManager Overhaul<br>• scheduleMovementCompletion & onMovementCompleted<br>• 2-second scheduleHandoffCompletion<br>• Idempotent command deduplication before guards"]
    M4["4. CpuController Session Locking<br>• Multi-level execution lock (gameId, turnId, cpuUid)<br>• Handoff & movement gates<br>• Elimination of double-trigger loops"]
    M5["5. Client UI & Pacing Synchronization<br>• GameBoard handoff & walking indicators<br>• PlayerStrip PAUSED timer indicator<br>• Action buttons disabled during movement/handoff"]
    M6["6. CPU Continuation & Auto-Completion Fix<br>• Post-dispatch authoritative state re-evaluation<br>• canSafelyEndTurn explicit null-decision handling<br>• Symmetrical 2s handoff: CPU->CPU, CPU->Human, Human->CPU"]
    M7["7. Verification & 12-Regression Suite<br>• 13 Test Suites / 149 Tests Passing (100%)<br>• 12 Dedicated Regression Tests in turn-sync-and-pacing.test.ts"]
    M8["8. Configurable Start Crossing Money<br>• Room creation modal options: ₹1,000, ₹2,000, ₹3,000<br>• Server room manager and engine integration<br>• 153 Tests Passing (100%) across 13 test suites<br>• Zero-error typecheck, lint, and production builds"]
    M9["9. Game Economy, Turn Alerts & Inspection<br>• Festival Travel instruction & singular salary<br>• Human-only client-local procedural audio chime<br>• Highest Net Worth winner determination<br>• Sell-to-Bank tariff-based sorting & interactive board preview<br>• 164 Tests Passing (100%) across 14 test suites"]
    M10["10. Player Cards, Turn Timer & 11-Section Rules<br>• Separate prominent Balance & distinct gold NET WORTH<br>• Active-player-only turn timer countdown in card header<br>• Centralized authoritative 11-section rules guide (game-rules-guide.ts)<br>• Non-blocking RulesModal with search & category navigation<br>• 173 Tests Passing (100%) across 15 test suites"]
    M11["11. Net Worth Typography, Bottom-Left Preview, Audio Alerts & Shortcuts<br>• Increased Net Worth font size with clear 3-tier visual hierarchy<br>• Bottom-left anchored Return-to-Sell-to-Bank control with 120s countdown<br>• Web Audio PURCHASE_PROMPT (G5->C6) and DECLINE_ACTION (F4->Db4) alerts<br>• Accessible keyboard shortcuts: Space (Roll), Enter (Confirm/Buy), N (Decline)<br>• 185 Tests Passing (100%) across 16 test suites"]
    M12["12. Simplified Room Creation & 6-Slot Waiting Lobby<br>• Create Room modal simplified: fixed 6 slots, no CPU configuration during creation<br>• Waiting lobby redesigned with 6 fixed slots accommodating any mix of Humans & CPUs<br>• Host-only CPU management: add, rename, and remove with real-time Socket.IO sync<br>• Human readiness system: all human players (including host) must explicitly mark ready<br>• Start Game validation: >= 2 total players and all humans ready verified on server<br>• Scrollable lobby viewport (overflow-y-auto) & clean room slots section header<br>• 199 Tests Passing (100%) across 18 test suites"]
    M13["13. Contextual Shortcuts, Dynamic Net Worth Rankings & Continuity Safeguards<br>• Contextual shortcuts: Spacebar (Roll dice / Try Double / End turn), S (Sell to Bank), Enter (Accept / Bail), N (Decline)<br>• Permanent compact keycap shortcut reference below left player panel<br>• Section 12 Keyboard Shortcuts in centralized rules guide & rules modal<br>• Dynamic live NET WORTH competition rankings (#1, #2, #3) with highlighted #1 badge<br>• Card money formatting: green +₹ for rewards, red -₹ for costs, neutral for utility cards<br>• Audited card content: cleaned nonexistent auction references in market_4<br>• Robust CPU fallback decision generator & server stuck-turn recovery safeguards<br>• 220 Tests Passing (100%) across 19 test suites"]
    M14["14. Building Shortcut, Rules Navigation & NET WORTH Tie-Breaking<br>• Spacebar context extended: Roll Dice, Try Double, Build House/Tower, End Turn<br>• Permanent left panel shortcut reference & Section 12 updated with Build House/Tower<br>• Rules popup categorized into 9 structured navigation categories with desktop sidebar & mobile bar<br>• Strict room-join sequence tie-breaking: unique sequential ranks #1..#N across human and CPU players<br>• Monotonic roomJoinSequence lifecycle persisted across reconnection and player rotations<br>• 235 Tests Passing (100%) across 20 test suites"]

    M1 --> M2
    M2 --> M3
    M3 --> M4
    M4 --> M5
    M5 --> M6
    M6 --> M7
    M7 --> M8
    M8 --> M9
    M9 --> M10
    M10 --> M11
    M11 --> M12
    M12 --> M13
    M13 --> M14
```

---

## 7. Verification Matrix & Formal Invariants

| Invariant | Formal Definition | Enforcement Point | Verification Result |
| :--- | :--- | :--- | :--- |
| **Sequential Control** | $\forall t, \left|\{p \in \text{Players} \mid \text{canAct}(p, t)\}\right| \le 1$ | `GameManager.executeCommandInternal` | ✅ Verified (`turn-sync-and-pacing.test.ts`) |
| **Movement Immobility** | $\text{movement.isComplete} = \text{false} \implies \forall \text{cmd}, \text{processCommand}(\text{cmd}) = \bot$ | `GameManager.executeCommandInternal` | ✅ Verified (`turn-sync-and-pacing.test.ts`) |
| **Movement Timer Pause** | $\text{movement.isComplete} = \text{false} \implies \frac{d(\text{turnTimeRemaining})}{dt} = 0$ | `GameManager.startTurnTimer` | ✅ Verified (`turn-sync-and-pacing.test.ts`) |
| **Actionable Timer Reset** | $\text{PhaseTransition}(\to \text{PROPERTY\_DECISION}) \implies \text{turnTimeRemaining} = T_{\text{limit}}$ | `GameManager.onMovementCompleted` | ✅ Verified (`turn-sync-and-pacing.test.ts`) |
| **CPU Handoff Gap** | $\text{NextPlayer} \in \text{CPU} \lor \text{PrevPlayer} \in \text{CPU} \implies \Delta t_{\text{handoff}} \ge 2000\text{ ms}$ | `GameManager.scheduleHandoffCompletion` | ✅ Verified (`turn-sync-and-pacing.test.ts`) |
| **Automatic CPU Termination**| $\text{CPUFinished}(p) \implies \text{exec}(\text{END\_TURN}) \text{ without waiting for } T_{\text{timer}} = 0$ | `CpuController.executeCpuAction` & `canSafelyEndTurn` | ✅ Verified (`turn-sync-and-pacing.test.ts`) |
| **Configurable Pass START** | $\text{Reward}(\text{START}) \in \{₹1000, ₹2000, ₹3000\} = \text{rules.passStartReward}$ | `engine.ts` & `room-manager.ts` | ✅ Verified (`cpu-multiplayer-integration.test.ts`) |
| **Festival Travel Salary** | $\text{Card}(\text{market\_2}) \implies \text{Target} = 0 \land \text{Credit} = \text{rules.passStartReward}$ (Single) | `engine.ts` | ✅ Verified (`game-economy-inspection-alerts.test.ts`) |
| **Localized Turn Alert** | $\text{AudioChime}(p) \iff p = \text{localUser} \land p \notin \text{CPU} \land \text{TurnStarted}(p)$ | `GameBoard.tsx` & `sound-engine.ts` | ✅ Verified (`game-economy-inspection-alerts.test.ts`) |
| **Authoritative Net Worth** | $\text{NetWorth} = \text{Cash} + \text{Val}(\text{Assets}) - \text{Liabilities}$ | `ruleset.ts` & `engine.ts` | ✅ Verified (`game-economy-inspection-alerts.test.ts`) |
| **Net Worth Victory** | $\text{Winner} = \arg\max_{p} \text{NetWorth}(p)$ | `engine.ts` | ✅ Verified (`game-economy-inspection-alerts.test.ts`) |
| **Sell-to-Bank Sorting** | $i < j \implies \text{maxTariff}(p_i) \le \text{maxTariff}(p_j)$ (stable spaceIndex tie-break) | `FinancialResolutionModal.tsx` & `GameBoard.tsx` | ✅ Verified (`game-economy-inspection-alerts.test.ts`) |
| **Board Preview Invariance** | $\text{PreviewOpen} \implies \frac{d(\text{expiresAt})}{dt} = 0 \land \text{readOnly} = \text{true}$ | `FinancialResolutionModal.tsx` & `CityDeedModal.tsx` | ✅ Verified (`game-economy-inspection-alerts.test.ts`) |
| **Financial Independence** | $\text{Phase} = \text{ACTION\_REQUIRED} \implies \text{TimerDeadline} = \text{expiresAt}_{120\text{s}}$ | `GameManager.startTurnTimer` | ✅ Verified (`turn-sync-and-pacing.test.ts`) |
| **Command Idempotency** | $\forall \text{cmd}, \text{exec}(\text{cmd}) \equiv \text{exec}(\text{cmd})$ without duplicate state changes | `GameManager.processedCommands` | ✅ Verified (`turn-sync-and-pacing.test.ts`) |
| **Dual Financial Metrics** | $\text{Display}(\text{Card}) = \{\text{Balance: } \text{Cash}, \text{NET WORTH: } \text{NetWorth}_{\text{gold}}\}$ | `PlayerStrip.tsx` & `PlayerDetailModal.tsx` | ✅ Verified (`player-cards-timer-and-rules.test.tsx`) |
| **Active-Only Turn Timer** | $\text{TimerVisible}(p) \iff p = \text{currentPlayerUid} \land \text{isBankrupt}(p) = \text{false}$ | `PlayerStrip.tsx` | ✅ Verified (`player-cards-timer-and-rules.test.tsx`) |
| **Authoritative 11 Rules** | $|\text{RulesSections}| = 11 \land \text{NonBlocking}(\text{Modal}) = \text{true}$ | `game-rules-guide.ts` & `RulesModal.tsx` | ✅ Verified (`player-cards-timer-and-rules.test.tsx`) |
| **Net Worth Typography** | $\text{Size}(\text{Cash}) > \text{Size}(\text{NetWorthAmount}) > \text{Size}(\text{NetWorthLabel})$ | `PlayerStrip.tsx` | ✅ Verified (`shortcuts-alerts-and-preview.test.tsx`) |
| **Bottom-Left Preview** | $\text{PreviewControl} \in \text{BottomLeft}(\text{BoardArea}) \land \text{Overlay} = \text{Hidden}$ | `FinancialResolutionModal.tsx` | ✅ Verified (`shortcuts-alerts-and-preview.test.tsx`) |
| **Prompt & Decline Audio**| $\text{PlayAlert}(\text{Action}) \iff \text{HumanPlayer} \land \text{Action} \in \{\text{Prompt}, \text{Decline}\}$ | `sound-engine.ts` & `GameBoard.tsx` | ✅ Verified (`shortcuts-alerts-and-preview.test.tsx`) |
| **Safe Keyboard Shortcuts**| $\text{Key}(\text{Space} \mid \text{Enter} \mid \text{N}) \land \neg \text{InputFocused} \land \neg \text{ModalOpen} \implies \text{ExecAction}$ | `GameBoard.tsx` | ✅ Verified (`shortcuts-alerts-and-preview.test.tsx`) |
| **Fixed 6-Slot Capacity** | $|\text{Members}(\text{Room})| \le 6 \land \text{JoinAttempt}(p_{>6}) \implies \bot$ | `room-manager.ts` (`joinRoom`, `addCpu`) | ✅ Verified (`room-lobby-redesign.test.ts`) |
| **Host-Only CPU Control** | $\text{Op} \in \{\text{Add}, \text{Remove}, \text{Rename}\} \land \text{caller} \neq \text{hostUid} \implies \bot$ | `room-manager.ts` (`addCpu`, `removeCpu`, `renameCpu`) | ✅ Verified (`room-lobby-redesign.test.ts`) |
| **Human Ready Requirement**| $\forall p \in \text{Humans}, \text{initReady}(p) = \text{false} \land \text{HostIncluded}(p)$ | `room-manager.ts` (`createRoom`, `joinRoom`) | ✅ Verified (`room-lobby-redesign.test.ts`) |
| **Dual Start Guard** | $\text{CanStart}(\text{Room}) \iff |\text{Members}| \ge 2 \land (\forall h \in \text{Humans}, \text{isReady}(h) = \text{true})$ | `game-manager.ts` (`startGame`) | ✅ Verified (`room-lobby-redesign.test.ts`) |
| **Scrollable Lobby Viewport** | $\text{Container}(\text{Lobby}) \in \text{overflow-y-auto} \land \neg \text{HeaderAddBtn}$ | `LobbyPage.tsx` | ✅ Verified (`room-lobby-ui.test.tsx`) |
| **Contextual Shortcuts** | $\text{Spacebar} \in \{\text{Roll}, \text{TryDouble}, \text{EndTurn}\}, \text{S} \to \text{SellToBank}, \text{Enter} \in \{\text{Accept}, \text{Bail}\}, \text{N} \to \text{Decline}$ | `GameBoard.tsx` | ✅ Verified (`contextual-shortcuts-and-rankings.test.tsx`) |
| **Permanent Shortcut Reference** | $\text{Visible}(\text{Keycaps}) \land \text{AnchoredBottom}(\text{PlayerPanel})$ | `PlayerStrip.tsx` | ✅ Verified (`contextual-shortcuts-and-rankings.test.tsx`) |
| **Rules Guide Section 12** | $|\text{RulesSections}| = 12 \land \text{HasSection}(\text{'keyboard-shortcuts'})$ | `game-rules-guide.ts` & `RulesModal.tsx` | ✅ Verified (`player-cards-timer-and-rules.test.tsx`, `contextual-shortcuts-and-rankings.test.tsx`) |
| **Dynamic Net Worth Rankings** | $\text{Rank}(p) = 1 + \sum_{o \neq p} \mathbb{I}(\text{NetWorth}(o) > \text{NetWorth}(p))$ (competition ranking with gold #1 badge) | `PlayerStrip.tsx` | ✅ Verified (`contextual-shortcuts-and-rankings.test.tsx`) |
| **Card Financial Polarity** | $\text{Gain} \implies +\text{₹} (\text{green}) \land \text{Loss} \implies -\text{₹} (\text{red}) \land \text{Neutral} \implies \text{plain}$ | `board-config.ts`, `GameBoard.tsx`, `RulesModal.tsx` | ✅ Verified (`contextual-shortcuts-and-rankings.test.tsx`) |
| **CPU Fallback Safeguards** | $\forall \text{Phase}, \text{RetriesExhausted} \implies \text{fallbackDecision}(\text{Phase}) \neq \bot \land \text{stuckRecovery}(\text{Phase}) \neq \bot$ | `cpu-controller.ts` & `game-manager.ts` | ✅ Verified (`contextual-shortcuts-and-rankings.test.tsx`) |
| **Spacebar Building Context** | $\text{Phase} = \text{MANAGEMENT} \land \text{canBuildHere} \implies \text{Key}(\text{Spacebar}) \to \text{BUILD} \land \neg \text{END\_TURN}$ | `GameBoard.tsx` | ✅ Verified (`building-shortcut-rules-nav-and-rankings.test.tsx`) |
| **Sequential Rank Tie-Break**| $\text{NetWorth}(p_i) = \text{NetWorth}(p_j) \implies (\text{Rank}(p_i) < \text{Rank}(p_j) \iff \text{joinSeq}(p_i) < \text{joinSeq}(p_j))$ | `PlayerStrip.tsx` | ✅ Verified (`building-shortcut-rules-nav-and-rankings.test.tsx`) |
| **Join Sequence Immutability**| $\forall p, \text{joinSeq}(p) = \text{const} \land \forall t, \text{Rotate}(\text{playerOrder}) \implies \Delta(\text{joinSeq}) = 0$ | `room-manager.ts` & `create-initial-game.ts` | ✅ Verified (`building-shortcut-rules-nav-and-rankings.test.tsx`) |
| **Categorized Rules Navigation**| $|\text{Categories}| = 9 \land \text{Filter}(\text{cat}) \to \text{Sections}(\text{cat}) \land \text{NonMutating} = \text{true}$ | `game-rules-guide.ts` & `RulesModal.tsx` | ✅ Verified (`building-shortcut-rules-nav-and-rankings.test.tsx`) |

---

## 8. Summary of Research Citation Context

This implementation serves as a formal reference for:
- **Server-Authoritative Multi-Agent Turn Coordination:** Managing hybrid human-AI participants under identical authoritative pipelines without leaking unfair latency or state advantages.
- **Visual Pacing Synchronization in Distributed Board Games:** Bridging the gap between instantaneous server state transitions and physical board-game presentation aesthetics.
- **Idempotent Fault-Tolerant Action Pipelines:** Safeguarding multiplayer game loops against packet retransmissions, network drops, and race conditions.
