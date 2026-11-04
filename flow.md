# Indian Monopoly — Implementation Flow & Research Architecture Record

## Abstract
This document chronicles the design, formal state transitions, mathematical models, architectural paradigms, and implementation journey of **Indian Monopoly**, a server-authoritative, real-time multiplayer property trading board game built for universal web standards. Designed for scholarly reference, reproducibility, and academic documentation, this record highlights state-machine formalisms, cryptographic integrity protocols, and cross-platform responsive interface engineering.

---

## 1. Project Genesis & Domain Specification

### 1.1 Domain Modeling & Subcontinent Topology
The property trading paradigm is mapped onto the contemporary Indian urban-economic landscape. The board consists of a canonical 40-space clockwise topology with:
- **22 Purchasable City Properties** grouped into 8 color bands representing major Indian metropolitan markets (Jaipur, Jodhpur, Lucknow, Varanasi, Agra, Ahmedabad, Surat, Vadodara, Kochi, Thiruvananthapuram, Kozhikode, Hyderabad, Bengaluru, Kolkata, Bhubaneswar, Chennai, Delhi, Mumbai).
- **4 Intercity Transit Assets**: Mumbai Western Line, Howrah Junction, Chennai Central, New Delhi Railway Station.
- **2 Public Utilities**: Urja Power Grid and Jal Board Water Authority.
- **2 Taxation Points**: GST Checkpost (₹2,000) and Infrastructure Levy (₹1,000).
- **2 Persistent Center Deck Card Spaces**: Civic Fund (public sector/regulatory events) and Market Buzz (economic/speculation events), permanently rendered in the center of the board.
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
  - Commercial Tower tier: $R_5$.
  - Transit spaces owned ($k \in \{1, 2, 3, 4\}$):
    $$\text{Rent}_{\text{transit}}(k) = 250 \times 2^{k-1}$$
  - Utility spaces owned ($m \in \{1, 2\}$):
    $$\text{Rent}_{\text{utility}}(m, \text{dice}) = \begin{cases} 4 \times \text{dice} & \text{if } m = 1 \\ 10 \times \text{dice} & \text{if } m = 2 \end{cases}$$

---

## 2. Frictionless Session Identity & Two-Tab Navigation

### 2.1 Frictionless Name-Based Entry
To maximize multiplayer adoption and eliminate third-party login friction:
- Google authentication is completely bypassed.
- Any participant with the room link or invitation code enters the room immediately after submitting their chosen display name.
- Anonymous player identifiers (`uid`) and color tokens are generated and stored in client `localStorage`.

### 2.2 Strict Two-Tab Information Architecture
The application navigation is strictly partitioned into two primary views:
1. **Play Tab (`/` and `/play`)**:
   - Practice Match Sandbox (comprehensive solo gameplay against 3 simulated tycoons).
   - Host Room creation with pre-game customizable rules modal.
   - Join Room with 6-character room code or deep invitation link.
2. **Settings Tab (`/settings`)**:
   - Web Audio procedural sound toggle and volume slider.
   - Light/Dark appearance theme toggle and reduced motion mode.
   - Display name editing and identity customization.

---

## 3. Universal Responsive & Non-Scrollable Viewport Architecture

### 3.1 Strict Viewport Isolation (`overflow-hidden` Playboard vs. Scrollable Settings/Lobby)
Only the active game board canvas is strictly non-scrollable (`h-[calc(100dvh-54px)] overflow-hidden`), preserving strict mathematical alignment across mobile and desktop. Meanwhile, auxiliary views (Settings tab `/settings` and Play lobby `/`) utilize natural dynamic viewport scrolling (`overflow-y-auto min-h-0`), ensuring complete accessibility for configuration controls across all device aspect ratios.

### 3.2 Maximized Playboard Footprint & Layout Proportions
The 12-column grid layout is optimized to dedicate maximum visual hierarchy to the game board:
- **Left Column (`lg:col-span-2`)**: Reduced, sleek player cards showing token, avatar initial, display name, cash, and turn timer only on the active player.
- **Center Column (`lg:col-span-7`)**: The board occupies `max-w-[min(88vh,88vw,820px)] aspect-square`, increasing board surface area by over 40% for optimal legibility.
- **Right Column (`lg:col-span-3`)**: Primary actions at top, followed immediately by "My Info" player portfolio, and contextual Deed inspector below.

### 3.3 Center Decks with Face-Up Card Contents
Rather than displaying closed card backs, the two central decks (*Civic Fund* in terracotta and *Market Buzz* in teal) permanently present their **active card contents** (title, descriptive text, and amount pill) face-up with authentic Indian iconography and Hindi titles.

### 3.4 3D Tumbling Dice Synthesis & Turn Step Acknowledgments
- **3D Tumbling Dice**: When rolled, the dice execute a 3D perspective rotation (`perspective: 600px; transform: rotateX(...) rotateY(...) rotateZ(...)`) while rapidly cycling pseudo-random face values every 70ms before snapping to server-authoritative numbers.
- **Turn Step Acknowledgment HUD**: An active breadcrumb pipeline (`1. Roll ➔ 2. Action ➔ 3. Complete`) provides instant visual acknowledgments for rolls, moves, purchases, rents, and turn conclusions.
- **Player Hover Flyout**: Hovering over any compact player card opens a detailed informational flyout detailing cash, net worth, board position, jail status, full list of owned properties by color group with house/tower levels, mortgaged states, transit lines, and utilities.

---

## 4. Modular Practice Match Architecture

To verify end-to-end gameplay mechanics prior to live room play, an isolated Practice Match module (`src/features/practice/`) executes:
- Exact same pure TypeScript game engine (`applyGameCommand`) and board components.
- Autonomous AI player loop with heuristic bidding, buying, and building decisions.
- Real-time turn countdown with automatic roll and pass enforcement.
- Engineered for seamless, modular removal in future releases without touching core game logic.

---

## 5. Security Hardening & GitHub Secrets CI/CD

Firebase public client credentials are scrubbed from version control:
- Local configurations read purely from `import.meta.env.VITE_FIREBASE_*`.
- Safe mock fallbacks ensure development, offline sandbox play, and CI test pipelines run smoothly without live credentials.
- GitHub Actions deployments inject production keys from repository secrets (`${{ secrets.VITE_FIREBASE_* }}`) using the setup detailed in `docs/SECRETS_SETUP.md`.

---

## 6. Procedural Web Audio Sound Synthesis Engine

Rather than loading high-latency or network-dependent `.mp3` / `.wav` assets over HTTP, game feedback is synthesized in real time via the browser's `AudioContext`:
- **Dice Rolling**: Synthesized white noise burst shaped by a bandpass biquad filter ($f_c = 1200\text{ Hz}, Q = 3.5$) with exponential gain decay:
  $$g(t) = g_0 \cdot e^{-t / \tau_{\text{dice}}}$$
- **Pawn Hop / Step**: Frequency sweep using a sine oscillator descending from 520 Hz to 260 Hz over 80 ms.
- **Cash Register / Transaction Chime**: Dual-tone overtone chord (880 Hz $A_5$ and 1320 Hz $E_6$) with instantaneous attack and 350 ms exponential ringdown.
- **Jail Clang**: Low metallic square wave (110 Hz $A_2$) mixed with lowpass resonant filter ($Q = 8$) simulating heavy iron bars closing.
- **User Permission & Autoplay**: Resumes `AudioContext` on user interaction and respects user settings (volume and mute toggle).

---

## 7. Quality Assurance & Multi-Device Verification Matrix

A comprehensive verification suite guarantees stability across all target form factors:
- **Unit Testing (Vitest 3.2)**: 6/6 tests verify engine determinism, START passing invariant, rent doubling on monopoly, bankruptcy thresholds, and three-doubles incarceration.
- **Static Analysis (TypeScript 5.7 & ESLint 9)**: 0 errors across all frontend and cloud functions codebases.
- **E2E Visual & Responsive Testing (Playwright 1.58)**: 27/27 end-to-end tests passing across 3 viewport configurations:
  - **Desktop (1920 × 1080)**: Full 3-column layout, visible financial strip, centered board, and transaction deeds.
  - **Modern Mobile Phone (390 × 844)**: Responsive board scaling within `100dvh`, compact player chips, and bottom HUD controls.
  - **Tablet Portrait (820 × 1180)**: Fluid responsive column collapse with center-anchored in-board dice.
