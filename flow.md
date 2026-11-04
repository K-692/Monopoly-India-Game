# Indian Monopoly — Implementation Flow & Research Architecture Record

## Abstract
This document chronicles the design, formal state transitions, mathematical models, architectural paradigms, and implementation journey of **Indian Monopoly**, a server-authoritative, real-time multiplayer property trading board game built for universal web standards. Designed for scholarly reference, reproducibility, and academic documentation, this record highlights state-machine formalisms, cryptographic integrity protocols, and cross-platform responsive interface engineering.

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

### 2.1 Three-Column Balanced Layout
The main non-scrollable game canvas is partitioned into three functional columns:
1. **Left Column (`lg:col-span-3`)**:
   - **Compact Player Strip**: Minimalist player rows with turn timers on the active player and hover flyouts.
   - **Selected Space Deed Inspector**: Positioned directly beneath the players list. Clicking any tile on the board immediately presents the complete deed schedule (purchase price, rent table across 1–4 houses and tower, mortgage/unmortgage values, transit/utility scaling, and owner development controls).
2. **Center Column (`lg:col-span-6`)**:
   - **Wide Non-Square Game Board**: Maxed out horizontally and vertically (`w-full h-full max-h-full mx-auto`) to utilize the full available workspace.
   - **Center Arena**: Houses the persistent face-up *Civic Fund* and *Market Buzz* cards alongside the 3D tumbling dice arena.
3. **Right Column (`lg:col-span-3`)**:
   - **Turn Actions & Controls**: Primary Roll The Dice, Buy/Decline, Pay Bail, and End Turn controls.
   - **"My Info" & Hover-Only Portfolio**: Liquid cash and total net worth summary. Property assets are cleanly hidden from the default view and revealed via an interactive hover card on cursor hover, preventing layout clutter.

### 2.2 Dynamic State-Change Glow & Zoom Feedback
When a game state update occurs, animated visual indicators alert all participants:
- **Board Space Tiles**: When a pawn steps along or lands on a space, or a deed is acquired/mortgaged/upgraded, the tile activates `isHighlighted` with an animated pulsing amber/gold neon glow ring (`ring-4 ring-amber-400 dark:ring-amber-300 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-pulse`).
- **Player Cards & Financial Changes**: The active player's card pulses with an amber glow ring. Whenever a player's cash changes, their cash badge flashes in green (+ cash) or red (- cash) with a momentary zoom scale-up (`scale-110`).

---

## 3. Universal Responsive & Non-Scrollable Viewport Architecture

### 3.1 Strict Viewport Isolation & Board Completeness Guarantee
Only the active game board canvas is strictly non-scrollable (`h-[calc(100dvh-54px)] overflow-hidden`), preserving strict mathematical alignment across mobile and desktop. Auxiliary views (Settings tab `/settings` and Play lobby `/`) utilize natural dynamic viewport scrolling (`overflow-y-auto min-h-0`).

### 3.2 Widened Walk Lane Grid Topology
The perimeter walk lane width is widened using asymmetric CSS Grid templates:
- **Grid Layout**: `grid-template-columns: 1.5fr repeat(9, 1fr) 1.5fr` and `grid-template-rows: 1.5fr repeat(9, 1fr) 1.5fr`.
- **Space Legibility**: The 1.5fr outer lanes provide expanded space depth ($1.5 / 12.0 = 12.5\%$ per outer lane), eliminating truncated text and cleanly accommodating full unique city names, prices, and owner identifiers.

### 3.3 Dynamic Buyer-Color Ownership Formalism
- **Unowned Spaces**: Completely uncolored (clean neutral parchment with white border).
- **Purchased Spaces**: Dynamically adopt the **purchasing player's assigned token color** (`owner.colorToken`), accompanied by an owner name badge and building count pips (`🏠xN` or `🏢 Tower`).

### 3.4 Sequential One-by-One Pawn Walking Animation
Rather than teleporting across the board upon rolling, player pawns advance sequentially along the walk lane:
$$P_{t+1} = (P_t + 1) \pmod{40}$$
For each step:
- The discrete hop executes at a 140 ms cadence.
- Audio synthesis fires a procedural `PAWN_STEP` frequency sweep (520 Hz $\to$ 260 Hz).
- Passing START (index 0) triggers the `PASS_START` chime.
- On reaching the target tile ($S = \text{dice}_1 + \text{dice}_2$), the step terminates and lands on the property decision.

---

## 4. Production Deployment & Live Access

### 4.1 GitHub Pages Deployment
- **Live URL**: `https://k-692.github.io/Monopoly-India-Game/`
- **Routing Paradigm**: HTML5 HashRouter (`/#/`, `/#/practice`, `/#/room/:roomId`) enabling deep room links across any static hosting CDN without 404 rewriting requirements.
- **Automated CI/CD**: Fully configured via `.github/workflows/deploy-pages.yml` with automated builds and artifact uploads on every push to `main`.
