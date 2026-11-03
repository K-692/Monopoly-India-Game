# Indian Monopoly — Implementation Flow & Research Architecture Record

## Abstract
This document chronicles the design, formal state transitions, mathematical models, architectural paradigms, and implementation journey of **Indian Monopoly**, a server-authoritative, real-time multiplayer property trading board game built for universal web standards. Designed for scholarly reference, reproducibility, and academic documentation, this record highlights state-machine formalisms, cryptographic integrity protocols, and cross-platform responsive interface engineering.

---

## 1. Project Genesis & Domain Specification

### 1.1 Domain Modeling & Historical Context
The traditional property trading game is mapped onto the Indian subcontinent's contemporary urban-economic geography. The board consists of a canonical 40-space clockwise topology with:
- **22 Purchasable City Properties** grouped into 8 color bands representing major Indian metropolitan markets (Jaipur, Jodhpur, Lucknow, Varanasi, Agra, Ahmedabad, Surat, Vadodara, Kochi, Thiruvananthapuram, Kozhikode, Hyderabad, Bengaluru, Kolkata, Bhubaneswar, Chennai, Delhi, Mumbai).
- **4 Intercity Transit Assets**: Mumbai Western Line, Howrah Junction, Chennai Central, New Delhi Railway Station.
- **2 Public Utilities**: Urja Power Grid and Jal Board Water Authority.
- **2 Taxation Points**: GST Checkpost (₹2,000) and Infrastructure Levy (₹1,000).
- **2 Dynamic Deck Card Spaces**: Civic Fund (public sector events) and Market Buzz (economic/speculation events).
- **4 Corner Anchors**: START (₹2,000 passing reward), Central Jail / Just Visiting, Rest House (Free Parking), and Go to Jail.

### 1.2 Mathematical Formulations
- **Currency Resolution**: All transactions are strictly discrete integer values in Indian Rupees ($\mathbb{Z}^+$). Fractional money (paise) is strictly disallowed to eliminate floating-point drift:
  $$\Delta \text{Cash} \in \mathbb{Z}$$
- **Pass START Invariant**:
  $$\text{reward} = \begin{cases} 2000 & \text{if } (p_{\text{old}} + d) \ge 40 \text{ and clockwise movement} \\ 0 & \text{otherwise} \end{cases}$$
  Direct incarceration movement to Jail ($p = 10$) bypasses index 0 and explicitly yields 0 reward.
- **Rent Multiplier Formalism**:
  - Unimproved property rent: Base rent $R_0$.
  - Monopolized group (all properties of color set $C$ owned by single entity, no buildings): $2 \times R_0$.
  - Developed tiers (1 to 4 blocks): $R_1, R_2, R_3, R_4$.
  - Commercial Tower tier: $R_5$.
  - Transit spaces owned ($k \in \{1, 2, 3, 4\}$):
    $$\text{Rent}_{\text{transit}}(k) = 250 \times 2^{k-1}$$
  - Utility spaces owned ($m \in \{1, 2\}$):
    $$\text{Rent}_{\text{utility}}(m, \text{dice}) = \begin{cases} 4 \times \text{dice} & \text{if } m = 1 \\ 10 \times \text{dice} & \text{if } m = 2 \end{cases}$$

---

## 2. Server-Authoritative Trust Model & State Invariants

### 2.1 Threat Vector Mitigation
Client execution environments (V8, JavaScriptCore) are classified as untrusted execution zones. The following vectors are eliminated by architectural enforcement:
1. **Dice Forgery**: Pseudorandom number generators in the browser cannot manipulate outcome distributions. The server generates random integers using `crypto.randomInt(1, 7)` within a secure Cloud Function sandbox.
2. **Replay & Concurrency Attacks**: Every mutation command mandates an idempotency UUID and expected version vector $V$. Commands with $V \ne V_{\text{server}}$ are rejected with `VERSION_CONFLICT`.
3. **Double Spending & Liquidation Arbitrage**: Cash debit operations execute inside Firestore atomic transactions with precondition checks:
   $$\text{balance} \ge \text{obligation} \implies \text{debit}$$
   Otherwise, the state machine transitions to `ACTION_REQUIRED (INSUFFICIENT_FUNDS)` triggering mandatory mortgage or asset sale workflows.

---

## 3. Universal Responsive & Touch-First Design Paradigm

### 3.1 Adaptive Viewport Topology
- **Desktop (>= 1024px)**: High-information density with persistent 3-column arrangement:
  - Left column: Real-time player financial status, token mapping, active turn highlights.
  - Center workspace: Fixed aspect-ratio board featuring Indian architectural motifs and smooth CSS-transformed pawn transitions.
  - Right column: Contextual deed inspector, transaction controls, mortgage management.
  - Sub-board tray: High-throughput event ticker and rate-limited emoji reactions.
- **Tablet (768px - 1023px)**: Dynamic 2-column layout with adaptive board scaling and slide-over player trays.
- **Mobile Handheld (320px - 767px)**: Touch-first single-column view:
  - Dynamic Viewport Units (`dvh`) and iOS Safari safe area insets (`env(safe-area-inset-*)`).
  - Contextual modal bottom sheets for decision prompts.
  - Prominent 56px thumb-zone primary action button.
  - Board interactive pan/zoom viewport focusing on active player coordinates.

---

## 4. Audio Synthesis Architecture

Rather than relying on uncompressed remote audio files that suffer from network latency and mobile audio blocking, Indian Monopoly incorporates a zero-dependency **Web Audio API Procedural Synthesizer**:
- **Frequency Modulation & Noise Synthesis**: Custom oscillators generate dice rattle (filtered white noise bursts), pawn hops (sine sweeps), cash register bell chimes (dual high-Q bandpass harmonics), and lockup clangs.
- **AudioContext Lifecycle**: Automatically registers unlock listeners on primary touch/pointer interactions, meeting iOS Safari and Android Chrome strict autoplay policies.

---

## 5. Implementation Journey & Milestone Progress

- **Milestone 0 (Architecture & Foundation)**:
  - Complete domain modeling, 40-space board topology, ruleset definition.
  - Standardized ADRs covering Firebase Mumbai region, GitHub Pages HashRouting, dual reaction transport, and archive lifecycle.
- **Milestone 1 (Scaffolding & UI Framework)**:
  - React 19 + TypeScript strict mode + Tailwind CSS + Lucide icons.
  - Pure TypeScript Game Engine implementation.
  - Web Audio synthesis module.
  - Responsive shell, navigation, and theme system.
  - CI/CD workflows and automated test harness.
