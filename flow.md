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
- **Dual Indexed Rule Panels in Place of Cards**:
  - Instead of displaying isolated card backs or single face-up cards, the board center features two structured panels:
    - **Left Panel**: Civic Fund (12 Community Treasury Rules, indexed #1 to #12) with terracotta/amber theme.
    - **Right Panel**: Market Buzz (12 Fortune & Chance Rules, indexed #1 to #12) with emerald/teal theme.
  - All 12 rules are visible simultaneously with index numbers, titles, and amounts.
  - Active rules light up with a vibrant pulse highlight matching the rolled dice total.
- **Central 3D Tumbling Dice Arena & Center Turn Controls**:
  - Located directly between the two indexed panels.
  - Houses interactive 3D dice faces with tumbling animations and rolled total indicator.
  - Features the primary action button (`ROLL DICE`, `END TURN`, `TRY DOUBLES`, `PAY BAIL`) right at the center of the board, eliminating the need for disconnected side control panels.

### 2.2 Two-Line City Grids with In-Grid Prices and Mortgage Values
- Each city cell presents a structured, two-line vertical hierarchy:
  - **Line 1**: Full City Name (single line without wrapping, dynamic length-adaptive font sizing).
  - **Line 2**: Purchase Price alongside Mortgage Value (`M: ₹{mortgageValue}`) in a clean, legible font.
- Extreme corner cells (`START`, `JAIL`, `REST`, `GO TO JAIL`) are styled compactly, preserving perimeter grid width and height for metropolitan city cells.

### 2.3 Pointed Comment Box (Callout Tooltip for Buy & Build Actions)
- Replaced cumbersome right-side action panels with a floating in-board **Pointed Comment Box**.
- Positioned dynamically adjacent to the active player's space on the perimeter grid.
- Features an exact geometric pointer triangle directed straight at the player's active tile.
- Handles context-sensitive turn operations:
  - **Buy Property Decision**: Displays property name, purchase price, mortgage value, and action buttons (`Buy City`, `Decline`).
  - **House / Tower Construction**: Displays construction cost, building level target, and action buttons (`Build House/Tower`, `Done`).

### 2.4 City Deed Modal & Player Detail Modal via Top-Level Portals
- **CityDeedModal (Triggered on City Grid Click)**:
  - Clicking any space on the board opens a deed inspection modal showing space index, color band, ownership status, purchase price, mortgage value, unmortgage cost, and complete rent schedule (Base, House 1-4, Commercial Tower).
  - Owners can mortgage or unmortgage directly from this dialog.
- **PlayerDetailModal (Triggered on Player Card Click)**:
  - Clicking any player's name card in the slim left panel opens an in-depth financial dossier showing liquid cash, total net worth, current position, jail status, and their complete portfolio of owned deeds with current rent yields.
- **Full-Screen React Portal Architecture**:
  - Both modals, along with the card rule popup and transaction acknowledgements, are rendered via `createPortal(..., document.body)` with `z-[100]` and `bg-black/70 backdrop-blur-sm`, guaranteeing zero stacking-context conflicts with board grid elements.

### 2.5 Jailed Player Economic Exemption Rule
- **Incarceration Rule Invariant**:
  - Incarcerated players located in Central Jail earn **₹0 rent** when opponents land on their properties (`calculateRent(..., isOwnerInJail = true) => 0`).
  - Incarcerated players receive **₹0** from card payment redistributions (`CASH_PLAYERS` / `PAY_PLAYERS`).
  - Economic earnings resume immediately upon release via bail or rolling doubles.

### 2.6 Money Transaction Acknowledgement Receipt Modal
- Whenever currency changes hands (rent payments, property deeds, construction costs, statutory taxes, START rewards), a dedicated transaction acknowledgement modal appears:
  - Displays transaction type icon, payer name (spent, highlighted in red), recipient name (earned, highlighted in emerald), formatted amount, and explanatory description.
  - Requires explicit confirmation via a prominent, high-contrast, gold `✓ ACKNOWLEDGE` button, ensuring both players have full awareness of financial state updates.

### 2.7 Delayed Building Logic (Next Turn Construction Constraint)
- When a player purchases a property, the engine records `propState.boughtOnTurn = state.turnNumber`.
- Construction of houses or towers on that property is strictly prohibited during the turn of purchase (`currentTurnNumber <= propState.boughtOnTurn`).
- Building is permitted starting from subsequent turns (`currentTurnNumber > propState.boughtOnTurn`) when the owner visits their city with sufficient funds.

### 2.8 Purchased City Ownership Grid Coloring
- When a player purchases a city, utility, or transit space, the entire grid cell adopts the player's theme:
  - **Cell Border**: 2px solid border styled with `owner.colorToken`.
  - **Cell Background**: Tinted with an alpha-blended wash of `owner.colorToken + '18'` (light mode) / `'28'` (dark mode).
  - **Accent Header**: Sleek top/inner banner colored with `owner.colorToken` displaying the owner's display name.
  - **In-Grid Development**: Up to 4 house icons (`🏠`) or golden commercial tower (`🏢 TOWER`).

### 2.9 Maximized Full-Screen Board with Slim Left Panel & Zero Footer
- Removed the right action container (`ActionPanel`) and bottom footer/emoji reaction bar entirely.
- Slimmed the left panel to `w-32 sm:w-36 md:w-40`.
- Maximized board canvas across `flex-1` width and `h-[calc(100dvh-50px)]`, providing expansive, comfortable grid cells with zero page scrolling.

### 2.10 Grid Visual Hierarchy: Name-Only Focus & Dynamic Player Token Positioning
- In strict adherence to legibility standards and viewport geometry, individual city grids display **strictly the city/place name** without in-grid price or mortgage clutter.
- When players land on a tile, their avatar tokens (`(K)`, `(P)`) are rendered directly beneath the city name with zero clipping, overflow, or occlusion. The city name remains 100% visible at all times.
- Full financial intelligence (deed purchase price, mortgage value, unmortgage cost, and complete tier-by-tier rent schedules) is seamlessly accessible by clicking any grid cell to open the authoritative `CityDeedModal`.
- Subtle vector motifs for special spaces (Transit express trains/airports, utilities, taxes, cards) are positioned in the background with reduced opacity so text remains crystal clear.

### 2.11 Discrete Step-by-Step Walking Animation (0.5s per Space)
- Movement across the 40-space board utilizes a discrete step-by-step traversal loop:
  - When dice are rolled, the active player's pawn hops from tile to tile, advancing one space at a time.
  - Each individual step lasts strictly **0.5 seconds** ($500\text{ms}$), playing procedural footstep audio (`PAWN_STEP`) or START salary fanfare (`PASS_START`).
  - Active space glowing highlights and player coordinates update synchronously on every hop.
  - Upon arrival at the target tile, the final position holds for 0.5s before triggering context-sensitive decisions (Buy/Build pointed boxes or card modals).

### 2.12 Complete Bankruptcy & Game-Over Invariant
- Under tournament rules, a player becomes **completely bankrupt** when:
  $$\text{Player Cash} \le 0 \quad \text{AND} \quad \text{Mortgageable Properties Count} = 0$$
- When triggered:
  1. The player's status is permanently updated to `isBankrupt = true` with cash set to 0.
  2. All deeds held by the player are immediately liquidated back to the Reserve Bank.
  3. Turn advancement shifts to the next solvent player in round-robin order.
  4. The engine checks solvent player count:
     $$\text{Solvent Players} = \{p \in \text{Players} \mid \neg p.\text{isBankrupt}\}$$
     If $|\text{Solvent Players}| \le 1$, the game transitions to `status = 'COMPLETED'` and records `winnerUid` with victory fanfare.

### 2.13 Universal Turn Timer Integration across All Popup Dialogs
- To ensure players never lose track of active turn progression while reviewing modals, an authoritative `PopupTurnTimer` badge is rendered inside:
  - `activeCardPopup` (Civic Fund & Market Buzz indexed rule receipts).
  - `activeMoneyTransaction` (Rent payments, taxes, rewards).
  - `CityDeedModal` (City deed information and mortgage panel).
  - `PlayerDetailModal` (Player financial dossiers).
  - `inspectedCard` (Rule inspection dialogs).
- Features live countdown seconds (`30s`), active player token avatar, and pulse warnings when $t \le 10\text{s}$.

### 2.14 3D Rolling Dice Arena with Dynamic Random Dots & Web Audio Sound Engine
- Two 3D dice cubes feature individual rotation, perspective skew, and pitch keyframe animations (`animate-dice-roll-1`, `animate-dice-roll-2`).
- **Dynamic Random Dots During Roll**: While rolling (`isRolling = true`), both cubes rapidly cycle random active dot configurations (2 to 6 dots across the $3\times3$ grid positions) and perspective shifts every 55ms, simulating fast tumbling motion blur with procedural wooden rattle clicking sounds (`DICE_TICK`).
- **Clean Settled Landing Impact**: Upon roll completion, the dice cubes snap instantly into their authoritative rolled states (`dice.first`, `dice.second`) in solid black, accompanied by a solid dual-thud landing impact sound (`DICE_LAND`).
- Outcome badge underneath presents strictly the single combined total (`🎲 Rolled: {first + second}`), removing breakdown noise.

### 2.15 Jail Space Barred Cell & Glowing Red Prison Plaque
- The Central Jail corner grid (Space #10) features an authentic prison visual aesthetic:
  - **Glowing Red Outer Frame**: `border-2 border-red-600 shadow-[0_0_18px_rgba(239,68,68,0.85)] ring-2 ring-red-500/50`.
  - **Black & White Vertical Jail Bars**: CSS repeating linear gradient (`repeating-linear-gradient(90deg, #18181b 0px, #18181b 4px, #ffffff 4px, #ffffff 9px)`) spanning the entire background.
  - **Centered Plaque**: High-contrast red badge (`bg-red-700/95 border border-red-400 text-white`) with prominent `JAIL` and `Visiting` text.

### 2.16 Non-City Grids: Glowing Orange Frame, Solid White Fill & High-Opacity Vector Motifs
- All non-city grid spaces (Transits #5, #15, #25, #35; Utilities #17, #28; Taxes #8, #37; Cards #2, #12, #22, #32; Rest House #20):
  - **Solid White Fill**: High-contrast, clean white backdrop (`bg-white text-indian-navy-950`).
  - **Glowing Orange Accent**: `border-2 border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.65)] ring-1 ring-orange-400/50`.
  - **High-Opacity Crisp Vector Icons**: Increased illustration opacity from 15% to 90% (`opacity-90`), rendering locomotives, airplanes, lightning bolts, water droplets, and event icons in rich, vivid detail without text overlap.

### 2.17 24-Step Continuous City Price Spectrum (Orange to Green)
- The 24 metropolitan city properties feature a mathematically continuous color ramp mapped directly to property deed value:
  - **Lowest Value (₹600 - ₹800)**: Deep Orange (`#EA580C`, Jaipur & Jodhpur) to Vivid Orange (`#F97316`, Udaipur).
  - **Moderate Value (₹1,000 - ₹1,600)**: Tangerine/Amber (`#FB923C`, `#F59E0B`, Agra, Lucknow, Varanasi) to Warm Gold (`#EAB308`, `#FACC15`, Indore, Bhopal, Surat).
  - **Mid-Tier Metropolitan (₹1,800 - ₹2,400)**: Lime/Citron (`#D9E74C`, `#A3E635`, `#84CC16`, `#65A30D`, Kochi, Goa, Ahmedabad, Pune, Hyderabad).
  - **High-Value Tech Hubs (₹2,600 - ₹3,200)**: Vibrant Emerald to Forest Green (`#22C55E`, `#16A34A`, `#15803D`, `#166534`, Bengaluru, Chennai, Kolkata, Chandigarh, Gurugram, Noida).
  - **Premier Tier (₹3,500 - ₹4,000)**: Dark Emerald to Supreme Green (`#0F5132`, `#064E3B`, `#047857`, Navi Mumbai, New Delhi, Mumbai).
- Unowned city grids display a top colored header bar and border corresponding to their price shade.
- Upon purchase, the grid dynamically adopts the owner's player color token and branding banner.

### 2.18 Non-Scrollable Symmetrical Center Arena with All 12 Rules in Enlarged Font
- Both the **Civic Fund** and **Market Buzz** center panels have been engineered to fit all 12 indexed canonical rules simultaneously with **zero scrollbars** (`overflow-hidden`).
- Positioned symmetrically on opposite sides of the central 3D dice arena.
- Increased rule title typography to `text-[10px] sm:text-[11px] md:text-[12.5px] font-black` for effortless legibility across all screen sizes.
- Symmetrical flex alignment guarantees perfect center balance.

### 2.19 Unification into Online Multiplayer Private Rooms
- Streamlined the game hub by focusing on **Host Multiplayer Room** (custom rulesets, turn timer, starting capital) and **Join with Room Code**.
- Retired the isolated single-player sandbox practice route, standardizing all state synchronization, 0.5s pawn traversal, and bankruptcy checking across online private rooms (`/room/:roomId` and `/game/:gameId`).

### 2.20 Scrollable Official Rulebook Tab & Distraction-Free Header
- A dedicated **Rules** tab (`/rules`) is accessible from the main navigation between **Play** and **Settings**.
- Built with a full-viewport, smooth-scrolling container (`h-full w-full overflow-y-auto custom-scrollbar`) providing seamless navigation across all 4 rule categories (Core Flow, 12 Civic Fund rules, 12 Market Buzz rules, Bankruptcy & Jail).
- Removed the black/white theme toggle button from the header, standardizing the aesthetic around the warm Indian parchment palette.

### 2.21 Retirement of Color-Set Monopoly Double Rent
- With the transition of metropolitan cities from legacy color groupings to an individual price spectrum from Orange to Green based on property deed value (₹600 to ₹4,000), color-set monopoly grouping was retired.
- Base rent calculation on undeveloped properties no longer doubles based on color-group sets; rent on unimproved deeds is the listed base rent ($p.\text{baseRent}$), while development progression is driven by residential blocks (1-4 houses) and commercial skyscraper towers.

### 2.22 Anti-Clipping Typography, Non-Overlapping Player Tokens & Cache-Resilient Architecture
- **Multi-Word Stacked Typography**: Addressed edge tile truncation ("Chennai Airp...", "CST To...") by rendering multi-word destinations in vertically stacked, auto-scaled typography. Top ascender clipping (such as the top stem of "Kochi") is eliminated through generous vertical padding and unclipped text containers.
- **Collision-Free Token Layout**: Vector illustrations on non-city tiles automatically scale down (`scale-75 w-4 h-4`) when player pawns occupy the grid, ensuring zero collision between icons, city names, and player tokens. When multiple players share a space, tokens stack using negative horizontal margins (`-space-x-1.5`) without vertical overflow.
- **Deed Modals Harmonization**: Eliminated obsolete Monopoly color group stripes from property portfolio listings in player detail views, synchronizing all deed badges with the continuous orange-to-green price spectrum (`getCityPriceColor`).
- **High-Visibility Acknowledgment Controls**: Upgraded rule card popups and financial transaction receipts with prominent, high-contrast action buttons (`Acknowledge & Continue`) equipped with live turn timers for both parties.
- **Cache-Busting & Clean Distribution**: Added strict HTTP cache-control meta headers to `index.html` (`no-cache, no-store, must-revalidate`) and removed legacy practice sandbox files to guarantee that visitors to the GitHub Pages live deployment immediately load the latest application bundle.

---

## 3. Production Deployment & Verification

### 3.1 Automated CI/CD & Testing Verification
- **Unit & State Machine Tests**: Vitest suite (12/12 tests passing) verifies discrete currency resolution, transit scaling, 3-consecutive doubles incarceration, 2-player turn cycles, `boughtOnTurn` construction delay enforcement, jailed owner rent exemption, dice-total card index resolution, transaction acknowledgement state transitions, and the complete bankruptcy tournament invariant.
- **Cross-Platform End-to-End Suite**: Playwright multi-worker browser verification validates navigation, practice match launching, dice rolling, sound synthesis toggles, and responsive layouts across Chromium, WebKit, and mobile viewport simulations.
- **Production Build**: Verified with `npm run build` (`tsc -b && vite build`) with zero TypeScript errors.
- **GitHub Pages Deployment**:
  - **Live URL**: `https://k-692.github.io/Monopoly-India-Game/`
  - **Routing Paradigm**: HTML5 HashRouter (`/#/`, `/#/rules`, `/#/practice`, `/#/room/:roomId`).
  - **Automated CI/CD**: Fully configured via `.github/workflows/deploy-pages.yml` with automated builds and artifact uploads on every push to `main`.
