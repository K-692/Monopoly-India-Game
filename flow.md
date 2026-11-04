# Indian Monopoly — Implementation Flow & Research Architecture Record

## Abstract
This document chronicles the design, formal state transitions, mathematical models, architectural paradigms, and implementation journey of **Indian Monopoly**, a server-authoritative, real-time multiplayer property trading board game built for universal web standards. Designed for scholarly reference, reproducibility, and academic documentation, this record highlights state-machine formalisms, cryptographic integrity protocols, cross-platform responsive interface engineering, and ergonomic touch/click-first interaction models.

---

## 1. Project Genesis & Domain Specification

### 1.1 Domain Modeling & 20 Unique Metropolitan Cities Topology
The property trading paradigm is mapped onto the contemporary Indian urban-economic landscape. The board consists of a canonical 40-space clockwise topology with **zero Hindi text**, featuring:
- **20 Purchasable City Properties**: 100% unique Indian metropolitan centres grouped into 8 color bands with **strictly ascending tier-wise prices**:
  - **Tier 3 Heritage & Royal Metros** (Brown): Jaipur (₹600, Space 1), Jodhpur (₹600, Space 3).
  - **Tier 2.5 Historic & Cultural Metros** (Light Blue): Lucknow (₹1,000, Space 6), Varanasi (₹1,000, Space 8).
  - **Tier 2 Commercial & Industrial Metros** (Pink): Indore (₹1,400, Space 11), Bhopal (₹1,400, Space 13), Surat (₹1,600, Space 14).
  - **Tier 2 Coastal & Maritime Metros** (Orange): Visakhapatnam (₹1,800, Space 16), Kochi (₹1,800, Space 18), Goa (₹2,000, Space 19).
  - **Tier 1 Tech & Financial Innovation Giants** (Red): Ahmedabad (₹2,200, Space 21), Pune (₹2,200, Space 23), Hyderabad (₹2,400, Space 24).
  - **Tier 1 Mega Metropolitan Hubs** (Yellow): Bengaluru (₹2,600, Space 26), Chennai (₹2,600, Space 27), Kolkata (₹2,800, Space 29).
  - **Tier 1 Capital & Corporate Corridors** (Green): Chandigarh (₹3,000, Space 31), Gurugram (₹3,000, Space 32).
  - **Tier 1+ Supreme Political & Financial Capitals** (Dark Blue): New Delhi (₹3,500, Space 37), Mumbai (₹4,000, Space 39).
- **4 Intercity Transit Gateways**: Chhatrapati Shivaji Terminus Mumbai (Western, Space 5), Howrah Junction (Eastern, Space 15), Chennai Central (Southern, Space 25), New Delhi Railway Terminal (Northern, Space 35).
- **4 National Public Utilities**: Bharat Telecom Grid (Space 9), Urja Power Grid (Space 12), Jal Board Water Authority (Space 28), National Gas Grid (Space 34).
- **2 Taxation Checkpoints**: GST Checkpost (₹2,000, Space 4) and Infrastructure Wealth Levy (₹1,000, Space 38).
- **2 Persistent Center Deck Card Spaces**: Civic Fund (Community Treasury events) and Market Buzz (Fortune & Chance speculation events), permanently rendered in the center of the board with zero Hindi script.
- **4 Corner Anchors**: START (configurable passing reward, default ₹2,000), Central Jail / Just Visiting, Rest House (Free Parking), and Go to Jail.

### 1.2 Mathematical Formulations & Rule Invariants
- **Discrete Currency Resolution**: All transactions are discrete integer values in Indian Rupees ($\mathbb{Z}^+$). Fractional money (paise) is strictly disallowed:
  $$\Delta \text{Cash} \in \mathbb{Z}$$
- **START Invariant**:
  $$\text{reward} = \begin{cases} R_{\text{start}} & \text{if } (p_{\text{old}} + d) \ge 40 \text{ and clockwise movement} \\ 0 & \text{otherwise} \end{cases}$$
  Direct incarceration movement to Jail ($p = 10$) bypasses index 0 and explicitly yields 0 reward.
- **Rent Multiplier Formalism**:
  - Unimproved property rent: Base rent $R_0$.
  - Monopolized group (all properties of color set $C$ owned by single entity, no buildings): $2 \times R_0$ when enabled by host rule.
  - Developed tiers (1 to 4 blocks): $R_1, R_2, R_3, R_4$.
  - Commercial Skyscraper Tower tier: $R_5$.
  - Transit spaces owned ($k \in \{1, 2, 3, 4\}$):
    $$\text{Rent}_{\text{transit}}(k) = 250 \times 2^{k-1}$$
  - Utility spaces owned ($m \in \{1, 2, 3, 4\}$):
    $$\text{Rent}_{\text{utility}}(m, \text{dice}) = \begin{cases} 4 \times \text{dice} & \text{if } m = 1 \\ 10 \times \text{dice} & \text{if } m \ge 2 \end{cases}$$

---

## 2. Information Architecture & Spatial Reorganization

### 2.1 Max-Width Window-Stretched Geometry (`[210px_1fr_250px]`)
To maximize visual immersion and legibility across all desktop viewports, the game canvas stretches edge-to-edge across the window with no artificial max-width container constraints (`w-full max-w-none`):
1. **Left Column (Compact `210px` / `xl:230px`)**:
   - **Decreased Width Player Strip**: Slim, space-efficient player cards (height $\approx 36\text{px}$ each) showing avatar, color token, name, turn timer badge, and live Rupee balance.
   - **Click-to-Select Player Inspection (Zero Hovering)**: Replaced ephemeral, unstable hover popovers with an intentional, touch-friendly click selection architecture. Clicking any player card immediately renders their comprehensive profile directly below:
     - Liquid cash vs. Total net worth breakdown.
     - Current board tile position (interactive click-to-focus space).
     - Incarceration status (Jail turns counter and Get Out of Jail Free cards).
     - Owned properties portfolio with color group borders, house/tower counts, mortgage status, and interactive click-to-inspect deed navigation.
   - **Space Deed Inspector**: Directly under player info, displaying deed schedules for selected spaces.
2. **Center Column (`1fr` Dynamic Workspace — 70%+ of Screen Width)**:
   - **Edge-to-Edge Stretched Game Board**: Takes 100% of the remaining horizontal window width, expanding the board from previously constrained 50% width to upwards of 72%–76% of modern monitors (1440px, 1680px, 1920px+).
   - **Proportional Asymmetric Grid Topology**: `grid-template-columns: 1.4fr repeat(9, 1fr) 1.4fr` and `grid-template-rows: 1.5fr repeat(9, 1fr) 1.5fr`.
   - **Optimized City Cell Dimensions**: Each cell possesses calibrated aspect ratios:
     - Top & bottom lanes: $1.0\text{fr} \times 1.5\text{fr}$ ($\approx 92\text{px} \times 84\text{px}$), providing vertical depth for city labels, icons, prices, and owner markers.
     - Left & right lanes: $1.4\text{fr} \times 1.0\text{fr}$ ($\approx 135\text{px} \times 52\text{px}$), providing horizontal span for multi-syllable city names (e.g. *Visakhapatnam*) without truncation.
   - **Elevated Typography Hierarchy**:
     - Place/City Names: Upgraded to `text-[10.5px] sm:text-[11.5px] md:text-[12.5px] font-extrabold tracking-tight` for immediate recognition.
     - Purchase Prices & Tax Fines: Upgraded to `text-[10px] sm:text-[11px] md:text-[12px] font-black text-emerald-800 dark:text-emerald-400`.
     - Corner Landmarks: Upgraded to `text-xs sm:text-sm md:text-base font-black`.
   - **Center Arena**: Houses the persistent face-up *Civic Fund* and *Market Buzz* cards alongside the 3D tumbling dice arena.
3. **Right Column (Compact `250px` / `xl:270px`)**:
   - **Turn Actions & Controls**: Primary Roll The Dice, Buy/Decline, Pay Bail, and End Turn controls.
   - **"My Info" & Click-to-Expand Portfolio**: Liquid cash, net worth, and interactive click-to-expand property portfolio, completely eliminating hover dependencies.

### 2.2 2-Player Practice Match State Machine Formalism
The Practice Match sandbox is configured strictly as a **2-Player Head-to-Head Duel**:
- **Entities**: Player 1 (`player_human`, Maharaja user) and Player 2 (`player_ai_1`, Priya Mumbai).
- **Turn Transition Cycle**:
  $$\text{Turn}_{k+1} = \begin{cases} \text{player\_ai\_1} & \text{if } \text{Turn}_k = \text{player\_human} \\ \text{player\_human} & \text{if } \text{Turn}_k = \text{player\_ai\_1} \end{cases}$$
- **AI Decision Tree**:
  1. Await Roll: Dispatch `ROLL_DICE` with synchronized 140ms step hopping animation.
  2. Jail Decision: Attempt doubles or pay bail if cash reserves exceed $\text{Bail} + 1000$.
  3. Property Acquisition: Automatically purchases unowned property if $\text{Cash} \ge \text{Price} + ₹1,000$; otherwise declines to preserve liquidity.
  4. Turn Finalization: Concludes with `END_TURN`, handing control back to human player.

### 2.3 Dynamic State-Change Glow & Zoom Feedback
When a game state update occurs, animated visual indicators alert all participants:
- **Board Space Tiles**: When a pawn steps along or lands on a space, or a deed is acquired/mortgaged/upgraded, the tile activates `isHighlighted` with an animated pulsing amber/gold neon glow ring (`ring-4 ring-amber-400 dark:ring-amber-300 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-pulse`).
- **Player Cards & Financial Changes**: The active player's card pulses with an amber glow ring. Whenever a player's cash changes, their cash badge flashes in green (+ cash) or red (- cash) with a momentary zoom scale-up (`scale-110`).

---

## 3. Universal Responsive & Non-Scrollable Viewport Architecture

### 3.1 Strict Viewport Isolation & Board Completeness Guarantee
Only the active game board canvas is strictly non-scrollable (`h-[calc(100dvh-54px)] overflow-hidden`), preserving strict mathematical alignment across mobile and desktop. Auxiliary views (Settings tab `/settings` and Play lobby `/`) utilize natural dynamic viewport scrolling (`overflow-y-auto min-h-0`).

### 3.2 Dynamic Buyer-Color Ownership Formalism
- **Unowned Spaces**: Completely uncolored (clean neutral parchment with white border).
- **Purchased Spaces**: Dynamically adopt the **purchasing player's assigned token color** (`owner.colorToken`), accompanied by an owner name badge and building count pips (`🏠xN` or `🏢 Tower`).

### 3.3 Sequential One-by-One Pawn Walking Animation
Rather than teleporting across the board upon rolling, player pawns advance sequentially along the walk lane:
$$P_{t+1} = (P_t + 1) \pmod{40}$$
For each step:
- The discrete hop executes at a 140 ms cadence.
- Audio synthesis fires a procedural `PAWN_STEP` frequency sweep (520 Hz $\to$ 260 Hz).
- Passing START (index 0) triggers the `PASS_START` chime.
- On reaching the target tile ($S = \text{dice}_1 + \text{dice}_2$), the step terminates and lands on the property decision.

---

## 4. Production Deployment & Verification

### 4.1 Automated CI/CD & Testing Verification
- **Unit & State Machine Tests**: Vitest suite verifies discrete currency resolution, rent scaling, 3-consecutive doubles incarceration, and 2-player turn cycles.
- **Cross-Platform End-to-End Suite**: Playwright multi-worker browser verification tests two-tab navigation, practice match launching, dice rolling, sound synthesis toggles, and responsive layouts across Chromium, WebKit, and mobile viewport simulations.
- **GitHub Pages Deployment**:
  - **Live URL**: `https://k-692.github.io/Monopoly-India-Game/`
  - **Routing Paradigm**: HTML5 HashRouter (`/#/`, `/#/practice`, `/#/room/:roomId`) enabling deep room links across any static hosting CDN without 404 rewriting requirements.
  - **Automated CI/CD**: Fully configured via `.github/workflows/deploy-pages.yml` with automated builds and artifact uploads on every push to `main`.
