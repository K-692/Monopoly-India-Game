# Indian Monopoly — Implementation Flow & Research Architecture Record

## Abstract
This document chronicles the design, formal state transitions, mathematical models, architectural paradigms, and implementation journey of **Indian Monopoly**, a server-authoritative, real-time multiplayer property trading board game built for universal web standards. Designed for scholarly reference, reproducibility, and academic documentation, this record highlights state-machine formalisms, cryptographic integrity protocols, cross-platform responsive interface engineering, and ergonomic touch/click-first interaction models.

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
- **4 Corner Anchors**: START (#0, collect ₹2,000), Central Jail / Just Visiting (#10), Rest House (#20, Free Parking), and Go to Jail (#30).
- **Total Board Invariant**:
  $$\text{Total Spaces} = 24 \text{ (Cities)} + 4 \text{ (Transit)} + 2 \text{ (Civic)} + 2 \text{ (Market)} + 2 \text{ (Utilities)} + 2 \text{ (Taxes)} + 4 \text{ (Corners)} = 40$$

### 1.2 Mathematical Formulations & Rule Invariants
- **Discrete Currency Resolution**: All transactions are discrete integer values in Indian Rupees ($\mathbb{Z}^+$). Fractional money (paise) is strictly disallowed:
  $$\Delta \text{Cash} \in \mathbb{Z}$$
- **START Invariant**:
  $$\text{reward} = \begin{cases} R_{\text{start}} & \text{if } (p_{\text{old}} + d) \ge 40 \text{ and clockwise movement} \\ 0 & \text{otherwise} \end{cases}$$
  Direct incarceration movement to Jail ($p = 10$) bypasses index 0 and explicitly yields 0 reward.
- **Rent Multiplier Formalism**:
  - Unimproved property rent: Base rent $R_0$.
  - Monopolized group (all 3 properties of color set $C$ owned by single entity, no buildings): $2 \times R_0$.
  - Developed tiers (1 to 4 blocks): $R_1, R_2, R_3, R_4$.
  - Commercial Skyscraper Tower tier: $R_5$.
  - Transit spaces owned ($k \in \{1, 2, 3, 4\}$):
    $$\text{Rent}_{\text{transit}}(k) = 250 \times 2^{k-1}$$
  - Utility rent scaling: $4 \times (\text{dice}_1 + \text{dice}_2)$ for 1 utility owned; $10 \times (\text{dice}_1 + \text{dice}_2)$ for both utilities owned.

---

## 2. Information Architecture, Board Geometry & Visual Hierarchy

### 2.1 Compact Extreme Corners, Asymmetrical Grid & Two-Line Decreased Typography
To maximize cell readability and eliminate word wrapping:
- **Grid Proportions**:
  $$\text{grid-template-columns: } 1.15\text{fr repeat}(9, 1\text{fr}) 1.15\text{fr}$$
  $$\text{grid-template-rows: } 1.1\text{fr repeat}(9, 1\text{fr}) 1.1\text{fr}$$
- **Corner Compression & Extreme Placement**:
  - The four corner spaces (Rest House at #20, Jail at #10, START at #0, and Go To Jail at #30) are contained in compact boxes at the extreme four corners ($1.15\text{fr} \times 1.1\text{fr}$).
  - This liberates maximum area exclusively for the 9 inner columns along top and bottom lanes, and the 9 inner rows along left and right lanes.
- **Two-Line Grid Architecture**:
  - Every city and edge grid is formatted strictly across **two distinct lines**:
    - **Line 1 (Top)**: City / Place Name.
    - **Line 2 (Bottom)**: Price / Rupee Amount or Card Category.
- **Decreased Adaptive Typography**:
  - String-length-based dynamic font scaling prevents awkward mid-word breaking or truncation:
    $$\text{Font Size} = \begin{cases} \text{text-[7px] sm:text-[7.5px] md:text-[8px]} & \text{if } \text{length} > 12 \\ \text{text-[7.5px] sm:text-[8px] md:text-[8.5px]} & \text{if } \text{length} > 8 \\ \text{text-[8.5px] sm:text-[9px] md:text-[9.5px]} & \text{otherwise} \end{cases}$$
  - Prices render in crisp `text-[8px] sm:text-[8.5px] md:text-[9px] font-black`.
  - Every place name (e.g., "Visakhapatnam", "Chennai Airport", "Jal Board Grid", "Ahmedabad") fits on a single line without wrapping.
- **In-Grid Railway & Airport Vector Illustrations**:
  - Express locomotive engine with headlights and railway track ties on CST Mumbai (#5) and Howrah Railway (#15).
  - High-altitude passenger jetliner airliner on Chennai Airport (#25) and IGI Airport (#35).
- **Non-Obscuring Corner Player Tokens**:
  - Player tokens sit as compact floating badges in the tile corners, keeping the two centered lines (Name & Price) 100% visible and unblocked at all times.

### 2.2 Strict Zero-Scroll Architecture Across Game Tab
- **Zero Scrollbars Policy**: The entire game tab is engineered to fit strictly within `h-[calc(100dvh-54px)]` with `overflow-hidden` across all top-level wrappers and columns.
- **Left Column (`210px` / `xl:230px`)**:
  - Contains `PlayerStrip` (ultra-compact player cards, height $\approx 32\text{px}$) and `SpaceDeedInspector` (compact 2-column rent grid, height $\approx 160\text{px}$). Sits comfortably within ~380px vertical space.
  - Click-to-inspect player details with zero hovering dependency.
- **Center Column (`1fr`)**:
  - Stretched board spanning 100% of available viewport width and height.
  - Center area houses face-up Civic Fund and Market Buzz cards and 3D tumbling dice arena.
- **Right Column (`250px` / `xl:270px`)**:
  - Action panel and "My Info" section with compact property chips, completely eliminating vertical scrolling.

### 2.3 2-Player Practice Match State Machine Formalism
The Practice Match sandbox is configured strictly as a **2-Player Head-to-Head Duel**:
- **Entities**: Player 1 (`player_human`, Maharaja user) and Player 2 (`player_ai_1`, Priya Mumbai).
- **Turn Transition Cycle**:
  $$\text{Turn}_{k+1} = \begin{cases} \text{player\_ai\_1} & \text{if } \text{Turn}_k = \text{player\_human} \\ \text{player\_human} & \text{if } \text{Turn}_k = \text{player\_ai\_1} \end{cases}$$
- **Direct Destination Arrival**:
  - When rolling the dice, pawns land directly at the destination space:
    $$P_{\text{final}} = (P_{\text{start}} + \text{dice}_1 + \text{dice}_2) \pmod{40}$$
  - UI focus immediately updates to the destination deed in `SpaceDeedInspector`.

---

## 3. Universal Responsive & Ownership Visualization

### 3.1 Dynamic Buyer-Color Ownership Formalism
- **Unowned Spaces**: Completely uncolored (clean neutral parchment with white border).
- **Purchased Spaces**: Dynamically adopt the **purchasing player's assigned token color** (`owner.colorToken`), accompanied by an owner name badge and building count pips (`🏠xN` or `🏢 Tower`).

### 3.2 Dynamic State-Change Glow Feedback
- **Board Space Tiles**: When a deed is acquired, mortgaged, upgraded, or landed upon, the tile activates `isHighlighted` with an animated pulsing amber/gold neon glow ring (`ring-4 ring-amber-400 dark:ring-amber-300 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-pulse`).
- **Player Cards & Financial Changes**: Active player card pulses with an amber glow ring. Cash balance updates trigger green (+ cash) or red (- cash) flash badges with scale-up animations.

---

## 4. Production Deployment & Verification

### 4.1 Automated CI/CD & Testing Verification
- **Unit & State Machine Tests**: Vitest suite (7/7 tests passing) verifies discrete currency resolution, rent scaling, 3-consecutive doubles incarceration, and 2-player turn cycles.
- **Cross-Platform End-to-End Suite**: Playwright multi-worker browser verification (27/27 tests passing) validates two-tab navigation, practice match launching, dice rolling, sound synthesis toggles, and responsive layouts across Chromium, WebKit, and mobile viewport simulations.
- **Production Build**: Verified with `npm run build` (`tsc -b && vite build`) with zero TypeScript errors.
- **GitHub Pages Deployment**:
  - **Live URL**: `https://k-692.github.io/Monopoly-India-Game/`
  - **Routing Paradigm**: HTML5 HashRouter (`/#/`, `/#/practice`, `/#/room/:roomId`).
  - **Automated CI/CD**: Fully configured via `.github/workflows/deploy-pages.yml` with automated builds and artifact uploads on every push to `main`.
