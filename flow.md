# Indian Monopoly — Implementation Flow & Research Architecture Record

## Abstract
This document chronicles the design, formal state transitions, mathematical models, architectural paradigms, and implementation journey of **Indian Monopoly**, a server-authoritative, real-time multiplayer property trading board game built for universal web standards. Designed for scholarly reference, reproducibility, and academic documentation, this record highlights state-machine formalisms, cryptographic integrity protocols, statistical randomness validation, cross-platform responsive interface engineering, and ergonomic touch/click-first interaction models.

---

## 1. Project Genesis & Domain Specification

### 1.1 Canonical 40-Space Topology: 24 Cities (Strictly 6 Per Side), 4 Transit Gateways (2 Railways & 2 Airports), 2 Civic Fund, 2 Market Buzz, 2 Utilities, 2 Taxes, 4 Corners
The property trading paradigm is mapped onto the contemporary Indian urban-economic landscape. The board features an exact 40-space clockwise topology with **zero Hindi text**, featuring:
- **24 Purchasable City Properties (Strictly 6 Cities on Each Side)**: 100% authentic Indian metropolitan centres grouped into 8 color bands (3 cities per band) with strictly ascending tier-wise pricing across the 4 sides:
  - **Bottom Side (Spaces 0 to 10)**:
    - 6 Cities: Jaipur (₹600, Brown), Jodhpur (₹600, Brown), Udaipur (₹800, Brown), Agra (₹1,000, Light Blue), Lucknow (₹1,000, Light Blue), Varanasi (₹1,200, Light Blue).
    - 1 Civic Fund space (Space 2).
    - 1 Transit Gateway: CST Mumbai (Space 5, Railway).
    - 1 Tax Checkpost: GST Tax (Space 8).
  - **Left Side (Spaces 10 to 20)**:
    - 6 Cities: Indore (₹1,400, Pink), Bhopal (₹1,400, Pink), Surat (₹1,600, Pink), Visakhapatnam (₹1,800, Orange), Kochi (₹1,800, Orange), Goa (₹2,000, Orange).
    - 1 Market Buzz space (Space 12).
    - 1 Transit Gateway: Howrah Railway (Space 15, Railway).
    - 1 Utility Grid: Urja Power Grid (Space 17).
  - **Top Side (Spaces 20 to 30)**:
    - 6 Cities: Ahmedabad (₹2,200, Red), Pune (₹2,200, Red), Hyderabad (₹2,400, Red), Bengaluru (₹2,600, Yellow), Chennai (₹2,600, Yellow), Kolkata (₹2,800, Yellow).
    - 1 Civic Fund space (Space 22).
    - 1 Transit Gateway: Chennai Airport (Space 25, Airport).
    - 1 Utility Grid: Jal Board Grid (Space 28).
  - **Right Side (Spaces 30 to 40/0)**:
    - 6 Cities: Chandigarh (₹3,000, Green), Gurugram (₹3,200, Green), Noida (₹3,200, Green), Navi Mumbai (₹3,500, Dark Blue), New Delhi (₹3,800, Dark Blue), Mumbai (₹4,000, Dark Blue).
    - 1 Market Buzz space (Space 32).
    - 1 Transit Gateway: IGI Airport (Space 35, Airport).
    - 1 Tax Checkpost: Infra Levy (Space 37).
- **Exact 2 Civic Fund Deck Spaces**: Spaces 2 and 22 (Community Treasury events), distributed symmetrically across opposite sides.
- **Exact 2 Market Buzz Deck Spaces**: Spaces 12 and 32 (Fortune & Chance events), distributed symmetrically across opposite sides.
- **4 Intercity Transit Gateways (2 Railways & 2 Airports)**: 
  - Railways: CST Mumbai (#5) and Howrah Railway (#15) equipped with dedicated in-grid express locomotive illustrations.
  - Airports: Chennai Airport (#25) and IGI Airport (#35) equipped with dedicated in-grid passenger jetliner illustrations.
- **2 National Public Utilities**: Urja Power Grid (#17) and Jal Board Grid (#28).
- **2 Taxation Checkposts**: GST Tax (#8) and Infra Levy (#37).
- **4 Corner Anchors**: START (#0, clean name & directional arrow without in-grid price text), Central Jail / Just Visiting (#10, red glow & black/white jail bars), Rest House (#20, Free Parking), and Go to Jail (#30).
- **Total Board Invariant**:
  $$\text{Total Spaces} = 24 \text{ (Cities)} + 4 \text{ (Transit)} + 2 \text{ (Civic)} + 2 \text{ (Market)} + 2 \text{ (Utilities)} + 2 \text{ (Taxes)} + 4 \text{ (Corners)} = 40$$

### 1.2 Canonical 12 Market Buzz & 12 Civic Fund Card Decks
The card engine manages two authoritative 12-rule indexed decks:
- **Market Buzz (12 Indexed Rules)**:
  1. `Startup grant`: Receive ₹800 from the bank (`CASH_BANK: 800`).
  2. `Festival travel`: Advance to Start and collect ₹2,000 (`ADVANCE_START`).
  3. `Business conference`: Move to Delhi – Connaught Place (#38). Collect Start money if passed (`ADVANCE_POSITION: 38`).
  4. `Railway expansion`: Advance to next Transit space (#5, #15, #25, #35). If owned by another player, pay $2\times$ normal transit rent (`ADVANCE_NEXT_TRANSIT: 2x rent`).
  5. `Road diversion`: Move backwards 3 spaces and resolve destination space (`MOVE_BACKWARD: 3`).
  6. `Highway toll`: Pay ₹300 to the bank (`PAY_BANK: 300`).
  7. `Property maintenance`: Pay ₹250 for each development block and ₹750 for each commercial tower (`REPAIRS: 250/750`).
  8. `Successful tender`: Receive ₹1,200 from the bank (`CASH_BANK: 1200`).
  9. `Regulatory violation`: Go directly to Jail. Do not collect Start money (`GO_TO_JAIL`).
  10. `Transit dividend`: Receive ₹400 for each Transit space owned (`TRANSIT_DIVIDEND: 400`).
  11. `Emergency procurement`: Pay ₹700 to the bank (`PAY_BANK: 700`).
  12. `Mumbai investment trip`: Advance to Mumbai – Marine Drive (#39). Collect Start money if passed (`ADVANCE_POSITION: 39`).
- **Civic Fund (12 Indexed Rules)**:
  1. `Bank interest`: Receive ₹500 (`CASH_BANK: 500`).
  2. `Tax refund`: Receive ₹700 (`CASH_BANK: 700`).
  3. `Education expense`: Pay ₹400 (`PAY_BANK: 400`).
  4. `Festival gathering`: Pay ₹200 to every other active player (`PAY_PLAYERS: 200`).
  5. `Development grant`: Receive ₹100 for each development block and ₹300 for each commercial tower (`DEVELOPMENT_GRANT: 100/300`).
  6. `Municipal maintenance`: Pay ₹250 for every property deed owned (`DEED_TAX: 250`).
  7. `Community development grant`: Receive ₹1,000 (`CASH_BANK: 1000`).
  8. `Road repair contribution`: Pay ₹1,000 (`PAY_BANK: 1000`).
  9. `Special legal exemption`: Keep Get Out of Jail card until used or traded (`JAIL_FREE`).
  10. `Civic investigation`: Go directly to Jail. Do not collect Start money (`GO_TO_JAIL`).
  11. `Legal settlement`: Receive ₹1,500 (`CASH_BANK: 1500`).
  12. `Water and electricity expenses`: Pay ₹600 (`PAY_BANK: 600`).

---

## 2. Information Architecture, Board Geometry & Visual Hierarchy

### 2.1 Center Board Architecture: Dual 1–12 Indexed Rule Panels & Central Tumbling Dice
- **Dual Indexed Rule Panels**:
  - The board center features two structured panels:
    - **Civic Fund (Left)**: 12 Community Treasury Rules, indexed #1 to #12 with terracotta/amber theme.
    - **Market Buzz (Right)**: 12 Fortune & Chance Rules, indexed #1 to #12 with emerald/teal theme.
  - Active rules highlight dynamically based on the authoritative dice roll sum.
- **Central 3D Tumbling Dice Arena & Center Turn Controls**:
  - Located symmetrically between the indexed panels.
  - Houses interactive 3D dice faces with tumbling animations and rolled total indicator.
  - Features the primary action button (`ROLL DICE`, `END TURN`, `TRY DOUBLES`, `PAY BAIL`) right at the center of the board, eliminating the need for disconnected side control panels.

### 2.2 Board Space Presentation & Clean Typography
- **Single-Line City Names**: All 24 cities render on a single line (`truncate whitespace-nowrap`) with adaptive font scaling and full title tooltips to ensure zero wrapping or grid overflow across mobile, iPad, and desktop viewports.
- **Removal of Monetary Prices from Grids**: Board grids strictly communicate property identity, color groups, developments, and ownership status. Prices are removed from in-grid tiles and preserved in property deed inspection modals and purchase popups.
- **Blocked State Badge**: Properties owned by disqualified players feature a distinct `BLOCKED` badge with grayscale styling.

### 2.3 Viewport and Collision-Aware Pointed Comment Box (`usePopupPosition`)
- The purchase, development, and reacquisition prompt is positioned using a dedicated, collision-aware positioning engine (`use-popup-position.ts`):
  1. Computes the exact DOM bounding rect of the target space grid cell.
  2. Dynamically measures the popup width and height.
  3. Evaluates available viewport space (`window.innerWidth`, `window.innerHeight`).
  4. For cities along the bottom edge (spaces 0 to 10), the popup is placed above the bottom tile directly inside the lower board interior (`targetY = cellRect.top - popupHeight - GAP`).
  5. Clamps position within `MIN_MARGIN = 12px`, guaranteeing the popup never crosses the bottom browser margin or viewport boundaries.
  6. Positions a dynamic pointer arrow (`popupPos.arrowStyle`) aligned with the cell center.
  7. Re-evaluates continuously on resize, scroll, and orientation change events.
- **Strict Movement Timing Invariant**:
  - The purchase popup is **strictly suppressed** while the player token is stepping through the board (`walkingAnimation !== null`).
  - The purchase prompt appears **only after** the pawn walking animation finishes settling on the final destination grid.
- **Turn Duration Gating**:
  - Remains visible for the full decision window until the player explicitly executes an action (Buy or Decline) or the authoritative server turn timer expires (triggering automatic decline/timeout transition).

---

## 3. Mathematical Models & Financial State Formulations

### 3.1 Random Authoritative Starting Player Selection
At the initialization of every match:
- The authoritative server invokes `crypto.randomInt(0, memberCount)` to select an initial player index $S$.
- Starting player UID is designated:
  $$\text{currentPlayerUid} \leftarrow \text{playerOrder}[S]$$
- The player order array is rotated so the starting player is positioned at index 0:
  $$\text{playerOrder}' = [\text{playerOrder}[S \dots N-1], \text{playerOrder}[0 \dots S-1]]$$
- Persisted within `initialGame` on the server and broadcast via `game:started` and `game:state`.
- **Reconnection Invariant**: Reconnecting or refreshing clients receive the persisted authoritative session state without re-randomizing or resetting the starting player.

### 3.2 Cryptographic Fair Dice Engine & Statistical Goodness-of-Fit
- **Elimination of Modulo Bias via Rejection Sampling**:
  - Raw unsigned 8-bit bytes ($[0, 255]$) have 256 states. Since $256 \pmod 6 = 4$, standard modulo creates systematic bias favoring 1, 2, 3, and 4.
  - Rejection sampling rejects raw values $\ge 252$ ($42 \times 6$). Each outcome $d \in \{1, 2, 3, 4, 5, 6\}$ achieves an exact probability:
    $$P(d) = \frac{42}{252} = \frac{1}{6} \approx 16.6667\%$$
- **Pearson's Chi-Square Goodness-of-Fit Test**:
  $$\chi^2 = \sum_{i=1}^{6} \frac{(O_i - E_i)^2}{E_i}, \quad E_i = \frac{N}{6}$$
  Across $N = 12,000$ simulated rolls ($E_i = 2,000$), testing confirms $\chi^2 < 15.086$ (critical value for 5 degrees of freedom at $\alpha = 0.01$).
- **Independence of Two Dice**:
  Across $N = 18,000$ simulated pairs, all 36 combinations $(d_1, d_2)$ appear with equal probability ($E = 500$), and doubles occur within $3\sigma$ bounds ($E = 3,000, \sigma = 50$).
- **Unique Roll ID & Idempotency**:
  Each roll is stamped with a unique `rollId` (`roll_<turn>_<timestamp>_<uuid>`). Duplicate command submissions return cached results without rerolling.

### 3.3 Jail Incarceration & Try Double Mechanics
- **Strict Single-Roll Invariant**: Rolling doubles outside jail does not grant extra turns. Only one roll is permitted per turn.
- **Jail Try Double Window (Turns 1, 2, and 3)**:
  - An incarcerated player may attempt doubles on their first three eligible turns ($N_{\text{jail}} \in \{0, 1, 2\}$).
  - If $d_1 = d_2$: Released immediately, moves forward by $d_1 + d_2$, and **does not receive an extra turn**. Flag `escapedJailThisTurn = true` prevents double-roll recurrence.
  - If $d_1 \ne d_2$: Remains in jail, $N_{\text{jail}} \leftarrow N_{\text{jail}} + 1$. Zero movement.
- **Automatic 4th Eligible Turn Release**:
  - If a player fails all 3 double attempts ($N_{\text{jail}} \ge 3$), the engine automatically releases them at the beginning of their 4th eligible turn without requiring another Try Double attempt.

### 3.4 Distinct Airport Visiting Rent Scaling
Airport transit charges scale distinctly higher than railways to reflect high-value aviation infrastructure:
$$\text{Rent}_{\text{airport}}(k) = \begin{cases} 
₹1,000 & \text{if } k = 1 \\
₹2,500 & \text{if } k = 2 
\end{cases}$$
Where $k$ is the number of airports owned by the same proprietor (Chennai Airport #25 and IGI Airport #35). In contrast, railways (CST Mumbai #5 and Howrah #15) scale at ₹250 and ₹500 respectively.

### 3.5 Mortgage Valuation Model with Development Recovery
$$V_{\text{mortgage}}(S, P) = \min\left(P_{\text{base}}, \left\lfloor 0.5 \times P_{\text{base}} + 0.5 \times \sum_{i=1}^{B} C_{\text{build}}\right\rfloor\right)$$
- Physical developments remain attached to deeds upon mortgaging.
- Redemption cost strictly equals the exact mortgage payout received: $C_{\text{reacquire}} = V_{\text{payout\_received}}$.

### 3.6 Mandatory Financial Resolution & Blocked Property Invariant
When debt $D$ exceeds cash $C$:
1. State pauses into `pendingFinancialObligation`.
2. Debtor mortgages properties to raise liquid funds.
3. If debtor surrenders (`GIVE_UP`), remaining cash transfers to creditor, debtor is marked $\text{isBankrupt} = \text{true}, \text{isDisqualified} = \text{true}$, and all debtor properties enter `BLOCKED` state. Blocked properties remain on the board permanently, produce zero rent, and cannot be acquired or traded.

---

## 4. UI/UX Transformation: Notifications, 3D Dice & Identity Setup

### 4.1 Strict Notification Deduplication & Audio Normalization
- **Single Active Notification Constraint**: Exactly 1 active toast at any time (`toasts: [newToast]`), eliminating visual clutter.
- **Cross-Channel Deduplication**: A global bounded LRU set tracks `eventId`s (transactions, card draws, mortgage actions). Redundant events across Socket.IO broadcasts and state bridges are completely suppressed.
- **Logical Key Debouncing**: Insufficient balance warnings use `dedupKey` to prevent multiple notices within 3.5 seconds.
- **Post-Landing Display Timing**: Landing notifications (rent payments, START salary, card draws) are held until pawn walking finishes (`!walkingAnimation`).
- **Normalized Subtle Chime**: Employs a soft dual-tone sine wave chime (E5 $\to$ G#5) replacing harsh clangs and eliminating jail audio leaks.

### 4.2 Modernized 3D Digital Board Game Dice
- **Realistic Bevels & Depth**: Ivory gradient cubes with smooth rounded corners (`rounded-2xl`), deep inset shadow bevels (`shadow-[0_6px_16px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.9)]`), and indented pips.
- **Heritage 1-Pip Styling**: The central pip of 1 features rich Indian Terracotta Crimson (`#C85A32`) with a gold rim accent.
- **Physical Landing Settle**: Keyframe animation `animate-dice-settle` simulates physical deceleration and bounce upon settling on authoritative outcomes.
- **Accessibility**: Includes full `@media (prefers-reduced-motion: reduce)` overrides.

### 4.3 Inline Tycoon Setup Prompt on Landing Page
- If player identity is missing or unconfigured:
  - An inline Tycoon Identity Setup Card renders prominently on `PlayPage.tsx`.
  - Input validation: Trimmed length between 2 and 20 characters, strictly alphanumeric, spaces, hyphens, and underscores (`/^[a-zA-Z0-9 _-]+$/`).
  - Visual color picker for player token selection.
  - Room creation and joining cards are gated with locked state indicators until a valid name is confirmed.
- Once configured, displays an active player identity badge with a convenient change button.

---

## 5. Architectural Migration: Zero-Cloud Authoritative LAN Server

### 5.1 In-Memory Server-Authoritative Architecture
- Complete retirement of Firebase/Firestore dependencies.
- LAN server runs on Node.js using Socket.IO with authoritative serialized command queues (`GameManager`).
- Ephemeral cryptographic reconnection tokens allow seamless session resumption across network reconnects.
- Automatic LAN IP resolution and 2D QR matrix generation facilitate instant multi-device onboarding.

---

## 6. Verification, Test Coverage & Benchmark Results

### 6.1 Test Suite Summary
- **Total Passing Tests**: 61 tests passing across 6 comprehensive suites with 0 failures:
  - **Hardening & Canonical Rules Suite (`multiplayer-turns-and-cards.test.ts` - 6 tests passing)**:
    - *Scenario A*: Multiplayer turn reliability, non-active roll rejection, double roll rejection, and turn progression.
    - *Scenario B*: Strict physical landing required for mortgage reacquisition; rejection from popups/lists; decline persistence; subsequent landing re-eligibility at exact original cost.
    - *Scenario C*: Comprehensive execution of all 12 canonical Civic Fund cards, financial obligations on insufficient cash, and exclusion of blocked properties from deed taxes and grants.
    - *Scenario D*: Comprehensive execution of all 12 canonical Market Buzz cards, navigation cards (Start, Connaught Place #38 with property decision, Mumbai #39, relative -3, advance transit 2x rent), and financial obligations.
    - *Scenario E*: Voluntary surrender (`GIVE_UP`), automatic property blocking (`BLOCKED`), preservation of historical ownership, mortgage, and buildings, zero rent on blocked cities, and safe turn advancement.
    - *Scenario F*: Reconnection and authoritative state recovery via `game:join`.
  - **Unit & Invariant Suite (`engine.test.ts` - 28 tests passing)**:
    - 1st, 2nd, and 3rd jail escape double attempts with extra turn suppression.
    - Incarcerated failed attempts maintaining zero movement.
    - 4th turn automatic release without Try Double requirement.
    - Insufficient cash rejection for property purchases and building.
    - Distinct airport visiting rent scaling and blocked property immunity.
    - Mortgage valuation formula with house recovery and capped bounds.
    - Exact payout reacquisition without penalty.
    - Financial resolution debt handling, surrender, and `BLOCKED` deed retention.
  - **Fairness & Statistical Suite (`dice-and-player-fairness.test.ts` - 6 tests passing)**:
    - Cryptographically random starting player assignment and player order rotation.
    - Chi-Square goodness-of-fit test across 12,000 rolls ($\chi^2 < 15.086$ at $\alpha = 0.01$).
    - 2-Dice independence across 18,000 pairs (all 36 combinations verified).
    - Unique `rollId` tracking and command idempotency.
  - **Popup, Notification & Concurrency Suite (`popup-and-notification.test.ts` - 11 tests passing)**:
    - Single active notification enforcement.
    - Event ID cross-channel deduplication.
    - Dedup key throttling for balance warnings.
    - Comprehensive username validation rules (length, characters, empty/whitespace rejection).
    - Stale version resilience on transient UI acknowledgment commands (`DISMISS_MONEY_ACK`, `DISMISS_CARD_POPUP`).
    - Turn timer renewal to full duration on mortgage execution.
    - Procedural audio engine validation ensuring strictly permitted sound dispatching.
  - **Multiplayer Integration Suite (`multiplayer-integration.test.ts` - 7 tests passing)**:
    - Two-client real-time synchronization, room lifecycle, turn authorization, and session resumption.
  - **Clipboard & Environment Suite (`clipboard.test.ts` - 3 tests passing)**:
    - Dual-strategy clipboard fallback across unencrypted HTTP LAN environments.
- **Production Build**: Verified with Vite production build completing in ~2.18s with zero TypeScript compilation errors.

---

## 7. Concurrency Resilience, Tri-Acoustic Audio & Dual-Modal Spatial Mortgaging

### 7.1 Stale Version Conflict Resolution & Concurrency Harmonization
- **Pathological Condition Diagnosed**: During multiplayer gameplay, floating acknowledge toasts (`activeMoneyTransaction` and `activeCardPopup`) triggered synchronous network dismissals across all connected clients simultaneously. The first client's dismissal incremented the authoritative `state.version`, causing subsequent client commands to be rejected with `VERSION_CONFLICT (Stale version: client expected X, current is Y)`.
- **Architectural Solution**:
  1. **Transient UI Decoupling**: Floating alert toasts are strictly managed on local client instances with 3-second auto-close and `eventId` deduplication via `useToastStore`. Synchronous network emissions from clients on toast appearance are eliminated.
  2. **Engine Idempotency Relaxation**: In `applyGameCommand`, UI dismissals (`DISMISS_CARD_POPUP`, `DISMISS_MONEY_ACK`) are exempt from strict version checks. If a stale dismissal arrives, the server acknowledges it without throwing `VERSION_CONFLICT`.
  3. **Natural Turn Garbage Collection**: `advanceTurn` and `ROLL_DICE` automatically clear `state.activeMoneyTransaction` and `state.activeCardPopup` to `null`.
  4. **Silent Error Suppression**: The client store captures transient stale version race conditions silently, preventing alarming red alert boxes and unprompted jail sounds.

### 7.2 Tri-Acoustic Procedural Audio Synthesis
- **Strict Tri-Acoustic Mandate**: The sound engine is restricted to exactly three procedural sounds generated via Web Audio API:
  1. **Rolling Sound (`DICE_ROLL`)**: Tumbling dice thuds synthesized via five staggered triangle oscillators ($140\,\text{Hz} \to 45\,\text{Hz}$).
  2. **Players Walking Sound (`PAWN_STEP`)**: Soft wooden pawn footstep synthesized via descending sine oscillator ($380\,\text{Hz} \to 160\,\text{Hz}$, 50ms decay).
  3. **Nice Alert Tone (`NOTIFICATION`)**: Harmonic dual-tone chime ($E_5 = 659.25\,\text{Hz} \to G^\#_5 = 830.61\,\text{Hz}$) accompanying alert toasts.
- **Complete Elimination of Secondary Sounds**: All other sound synthesizers (`BUY_PROPERTY`, `PAY_RENT`, `PASS_START`, `GO_TO_JAIL`, `DRAW_CARD`, `EMOTE`, `BUTTON_CLICK`, `VICTORY`, `DICE_TICK`, `DICE_LAND`) are silenced and removed.

### 7.3 Dual-Modal Spatial Mortgage Architecture & Decision Timer Renewal
- **Spatial Separation of Mortgaging vs Spectator Views**:
  - **For Mortgaging Player (`isDebtor === true` or Voluntary Mortgaging)**:
    - Renders a centered modal dialog (`fixed inset-0 z-[120] bg-black/80 flex items-center justify-center`).
    - Full list of eligible cities with building states, payout amounts, and "Mortgage City" buttons.
    - Settle Debt and Surrender actions.
  - **For Other Players (Spectators)**:
    - Renders a floating notification box strictly at the **left below** (`fixed bottom-4 left-4 z-[120]`).
    - Eliminates center screen occlusion and background blur, preserving full board and turn visibility for other players.
    - Real-time debtor liquid balance progress bar ($₹\text{Current Cash} / ₹\text{Amount Due}$) and active timer indicator.
- **Decision Timer Renewal**:
  - Incurring a financial debt obligation or executing a `MORTGAGE` command immediately resets the turn countdown to the full 30 seconds (`turnTimeRemaining = 30`).
  - Restarts the authoritative server timer interval (`resetTurnTimer`), giving players ample time to calculate options without abrupt timeouts.
- **Voluntary Mortgaging**:
  - Active players can trigger the center mortgage dialog anytime during turn management phases directly from the turn controls (`Landmark` icon).

### 7.4 Ergonomic Dice Geometry & Widened Dot Dispersion
- **Grid Gap Enlargement**: Increased die grid spacing from `gap-0.5` (2px) to `gap-1.5 sm:gap-2` (6px-8px).
- **Expanded Die Dimensions**: Increased die container size to `w-12 h-12 sm:w-14 sm:h-14` with `p-1.5 sm:p-2` inset padding.
- **Centering & Proportion**: Resized circular pips to `w-1.5 h-1.5 sm:w-2 sm:h-2` with signature Terracotta Crimson on the center 1-pip (`w-2.5 h-2.5 sm:w-3 sm:h-3`), resulting in clear, widely spaced, authentic pips.

### 7.5 Retirement of Legacy GitHub Actions Workflows
- Per deployment directives, the `.github/workflows/` directory (`ci.yml`, `deploy-pages.yml`) was completely retired and removed.
- Repository CI status badges and workflow references updated to reflect standalone zero-cloud LAN distribution.

---

## 8. Hardening Milestone: Multiplayer Turn Reliability, Board Aesthetics, Canonical Decks & Surrender

### 8.1 Multiplayer Turn Reliability & Authoritative State Synchronization
- **Authoritative Gatekeeping**: Only the active player (`actorUid === state.currentPlayerUid`) is permitted to submit `ROLL_DICE`, `BUY_PROPERTY`, `DECLINE_PROPERTY`, or `END_TURN` commands. Non-active submissions are rejected server-side with `NOT_YOUR_TURN`.
- **Single Roll Per Turn Invariant**: The engine strictly enforces `phase === 'AWAIT_ROLL'` for dice rolls outside jail. Once rolled, the turn transitions to `MANAGEMENT`, `PROPERTY_DECISION`, `CARD`, or `ACTION_REQUIRED`, completely blocking duplicate roll commands.
- **Timeout De-duplication & Freeze Prevention**:
  - `GameManager.startTurnTimer` stops ticking intervals immediately when `turnTimeRemaining <= 0` before executing timeout logic, preventing concurrent timeout executions.
  - Fail-safe timeout execution automatically recovers stuck phases (`recoverStuckTurn`), resetting the countdown if a command fails, guaranteeing turns never lock up.
- **Authoritative Session Hydration via `game:join`**:
  - Reconnecting or refreshing clients emit `game:join` with `{ gameId }`.
  - The server authoritatively looks up the game instance, joins the client socket to `game.roomId`, associates the session, emits presence to peers, and hydrates the client with fresh `gameState` and `room`.

### 8.2 Clean Player-Facing Board UI (Debug Info Suppression)
- **Technical Identifier Elimination**: All raw developer debug labels (`Turn #X`, `Phase: AWAIT_ROLL`, raw status strings, internal event names) have been removed from the player-facing board tiles, center status area, and navigation header.
- **Polished Player Indicators**: Replaced with human-readable, context-aware badges:
  - "Your Turn — Roll the Dice" (for active player in `AWAIT_ROLL`).
  - "Processing Move..." (during active rolling or token stepping).
  - "Waiting for [Player Name]" (for non-active players).
  - Clean Room Badges (`Room #XXXXXX`).

### 8.3 Physical Landing Requirement for Mortgage Reacquisition
- **Mathematical Invariant**: A mortgaged city cannot be redeemed from deed popups, player information panels, or merely visiting the space in earlier turns.
- **Formal State Transition**:
  $$\text{Reacquisition Eligible} \iff (S_{\text{dest}} = S_{\text{city}}) \land (\text{ownerUid} = P_{\text{active}}) \land (\text{isMortgaged} = \text{true}) \land (\text{status} \ne \text{BLOCKED})$$
- When an active player physically lands on their mortgaged city during an eligible turn:
  1. The engine generates a unique `reacquisitionOpportunity`:
     $$\text{reacquisitionOpportunity} = \{\text{landingId}, \text{turnNumber}, \text{playerUid}, \text{spaceIndex}, \text{cost}, \text{status}: \text{PENDING}\}$$
  2. The prompt presents the reacquisition opportunity at the exact mortgage payout originally received ($C_{\text{reacquire}} = V_{\text{mortgage\_received}}$).
  3. If declined (`DECLINE_REACQUISITION` or `DECLINE_PROPERTY`), status transitions to `DECLINED`. Re-attempting within the same turn without landing again is strictly blocked.
  4. In a subsequent turn, physically landing on the space again issues a new `reacquisitionOpportunity`, allowing the player to pay and unmortgage the property while keeping all existing buildings intact.

### 8.4 Responsive Grid Background Images
- **Replacement of Standalone Icons**: Raw icons (`RailwayImage`, `AirportImage`, `Zap`, `Droplets`, `ShieldAlert`, `Gift`, `Flame`) on non-city board grids were completely removed.
- **Dedicated High-Contrast SVG Artworks**: Replaced with optimized local SVG background illustrations with translucent overlays and high-contrast typography:
  - `civic_fund.svg` (Civic Fund grids #2 and #22)
  - `market_buzz.svg` (Market Buzz grids #12 and #32)
  - `gst_tax.svg` (GST Tax grid #8)
  - `infra_levy.svg` (Infrastructure Levy grid #37)
  - `urja_power.svg` (Urja Power Grid #17)
  - `jal_board.svg` (Jal Board Grid #28)
  - `railway.svg` (CST Mumbai #5 & Howrah Railway #15)
  - `airport.svg` (Chennai Airport #25 & IGI Airport #35)
- All grid titles render on a single line with `truncate whitespace-nowrap`, maintaining legibility across mobile, tablet, and desktop screens.

### 8.5 Authoritative Execution of Civic Fund & Market Buzz
- **Civic Fund (All 12 Canonical Cards)**:
  - Every card executes atomically and records appropriate financial ledger transactions.
  - Cash credits (cards 1, 2, 7, 11), bank payments (cards 3, 8, 12), player gatherings (card 4), development grants (card 5), deed taxes (card 6), get out of jail free (card 9), and go to jail (card 10).
  - Insufficient cash on penalties and taxes triggers `ACTION_REQUIRED` and `pendingFinancialObligation` rather than ignoring the debt.
  - Blocked properties owned by surrendered players are excluded from deed taxes and development grants.
- **Market Buzz (All 12 Canonical Cards)**:
  - Startup grant (card 1), festival travel to Start collecting ₹2,000 (card 2), business conference to Connaught Place #38 with unowned property purchase option (card 3), railway expansion with $2\times$ transit rent (card 4), road diversion moving backwards 3 spaces (card 5), highway toll (card 6), property maintenance (card 7), successful tender (card 8), regulatory violation (card 9), transit dividends (card 10), emergency procurement (card 11), and Mumbai investment trip to space #39 (card 12).
  - Movement cards properly trigger property decision or destination landing effects.

### 8.6 Voluntary Surrender (`GIVE_UP`) & Permanent City Blocking
- **User Interface**: A dedicated "Give Up" button is positioned prominently below player cards in `PlayerStrip` for the viewing player.
- **Two-Step Confirmation**: Clicking triggers a modal dialog with explicit warning:
  > *"Are you sure you want to give up? You will be removed from the game, and all your cities will be blocked permanently. This action cannot be undone."*
- **Authoritative Engine Consequences**:
  1. Player state: $\text{isBankrupt} \leftarrow \text{true}, \text{isDisqualified} \leftarrow \text{true}, \text{cash} \leftarrow 0$.
  2. Property state: All properties owned by the player transition to $\text{ownershipState} \leftarrow \text{'BLOCKED'}$.
  3. Historical preservation: Property ownership (`ownerUid`), mortgage status (`isMortgaged`), and development levels (`buildings`) are preserved intact.
  4. Board mechanics: Blocked properties cannot be bought, sold, traded, mortgaged, or reacquired. Any player landing on a blocked property pays ₹0 rent.
  5. Concurrency safety: If the active player surrenders, the turn cleanly advances to the next eligible player; if a non-active player surrenders, the active player's turn continues uninterrupted.

