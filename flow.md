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

### 2.19 Multiplayer Private Rooms & Isolated Sandbox Practice Mode
- Streamlined the game hub by providing dedicated **Host Multiplayer Room** (custom rulesets, turn timer, starting capital) and **Join with Room Code / Invite Link**, while preserving an isolated **Launch Solo Practice Match** card for zero-risk gameplay testing.
- State synchronization, 0.5s pawn traversal, and tournament bankruptcy checking are synchronized through real-time Firestore listeners (`/room/:roomId` and `/game/:gameId`).

### 2.20 Question Mark Rules Modal & Streamlined Top Navigation
- Removed the separate **Rules** navigation tab from the header, standardizing navigation on **Play** and **Settings**.
- Added a high-contrast **Question Mark button** (`?` / `HelpCircle` icon) positioned immediately to the left of the speaker mute button.
- Clicking the question mark button triggers an on-page modal popup window displaying the complete official rulebook across four tabbed categories (Core Game Flow, Civic Fund 12 Rules, Market Buzz 12 Rules, Bankruptcy & Jail), with escape key, overlay click, and close button handling.

### 2.21 Retirement of Color-Set Monopoly Double Rent
- With the transition of metropolitan cities from legacy color groupings to an individual price spectrum from Orange to Green based on property deed value (₹600 to ₹4,000), color-set monopoly grouping was retired.
- Base rent calculation on undeveloped properties no longer doubles based on color-group sets; rent on unimproved deeds is the listed base rent ($p.\text{baseRent}$), while development progression is driven by residential blocks (1-4 houses) and commercial skyscraper towers.

### 2.22 Anti-Clipping Typography, Non-Overlapping Player Tokens & Cache-Resilient Architecture
- **Multi-Word Stacked Typography**: Addressed edge tile truncation ("Chennai Airp...", "CST To...") by rendering multi-word destinations in vertically stacked, auto-scaled typography. Top ascender clipping (such as the top stem of "Kochi") is eliminated through generous vertical padding and unclipped text containers.
- **Collision-Free Token Layout**: Vector illustrations on non-city tiles automatically scale down (`scale-75 w-4 h-4`) when player pawns occupy the grid, ensuring zero collision between icons, city names, and player tokens. When multiple players share a space, tokens stack using negative horizontal margins (`-space-x-1.5`) without vertical overflow.
- **Deed Modals Harmonization**: Eliminated obsolete Monopoly color group stripes from property portfolio listings in player detail views, synchronizing all deed badges with the continuous orange-to-green price spectrum (`getCityPriceColor`).
- **High-Visibility Acknowledgment Controls**: Upgraded rule card popups and financial transaction receipts with prominent, high-contrast action buttons (`Acknowledge & Continue`) equipped with live turn timers for both parties.
- **Cache-Busting & Clean Distribution**: Added strict HTTP cache-control meta headers to `index.html` (`no-cache, no-store, must-revalidate`) to guarantee that visitors to the GitHub Pages live deployment immediately load the latest application bundle.

### 2.23 Real-Time Cloud Firestore & Server-Authoritative Cloud Functions Integration
- **Zero-Polling Reactive Architecture**: Replaced client-side Zustand room simulations with real-time Cloud Firestore listeners (`onSnapshot`) on both the room document (`rooms/{roomId}`) and the members subcollection (`rooms/{roomId}/members`).
- **Cloud Functions Region Standardization**: Standardized all callable endpoints on region `asia-south1`:
  - `createRoom`: Generates cryptographically secure 6-character room codes, hashes them with SHA-256, and atomically commits the room document and host member.
  - `joinRoom`: Normalizes and hashes incoming invite codes, discovers the matching room, performs atomic capacity checks inside a Firestore transaction, and enrolls the player into the members subcollection.
  - `setReady`: Manages server-side readiness states with real-time fanout to all connected clients.
  - `startGame`: Enforces host-only permissions, validates minimum 2 ready players, and atomically transitions the room to `IN_PROGRESS` with a canonical `gameId`.
  - `submitGameAction`: Idempotent command receipt logging and turn validation.

### 2.24 Frictionless Firebase Anonymous Authentication & Stable Identity
- Integrated `signInAnonymously` from Firebase Authentication as the canonical identity provider.
- Player preferences (display name, token color) are persisted in `localStorage` and mapped directly to the persistent Firebase UID.
- Sessions remain strictly stable across browser reloads, eliminating duplicate room seat allocation upon refresh.

### 2.25 Zero-Fabrication Invariant & Concurrency-Safe Matchmaking
- Completely eradicated all simulated fallback players ("Rajesh", "Priya") and mock lobby generators.
- A room's roster strictly reflects actual documents committed in Firestore.
- Room capacity checks execute inside `db.runTransaction` on the backend, preventing race conditions from simultaneous join requests.

### 2.26 Universal Cross-Device Invitation Links (`#/join/:code`)
- Supported two friction-free joining workflows:
  - **Direct Code Input**: Upper-cased 6-character code entry directly on the Play Hub.
  - **Universal Invitation URL**: Cross-platform shareable deep link format (`https://.../#/join/ABC123`) compatible with Android, iOS, iPadOS, Safari, Chrome, and Firefox on GitHub Pages HashRouter.
- Joining via URL establishes the anonymous Firebase session, requests or reuses the player's display name, executes the join operation, and routes directly to the true Firestore room ID.

### 2.27 Green Shades Buying Price Spectrum (₹600 to ₹4,000) & High-Contrast Typography
- **All-Green Color Ramp**: Replaced the previous orange-to-green ramp with a dedicated, fine-grained **green shades spectrum** mapped strictly to deed acquisition prices:
  - Lowest price deeds (₹600, Jaipur & Jodhpur): `#D1FADF` (Light Mint Green).
  - Low-mid price deeds (₹800 to ₹1,400, Udaipur, Agra, Lucknow, Varanasi, Indore, Bhopal): `#BBF7D0` to `#4ADE80` (Pastel Spring to Fresh Green).
  - Mid price deeds (₹1,600 to ₹2,400, Surat, Vizag, Kochi, Goa, Ahmedabad, Pune, Hyderabad): `#34D399` to `#166534` (Emerald to Deep Forest Green).
  - Upper tier deeds (₹2,600 to ₹3,500, Bengaluru, Chennai, Kolkata, Chandigarh, Gurugram, Noida, Navi Mumbai): `#14532D` to `#063A2D` (Dark Evergreen to Imperial Pine).
  - Highest tier deeds (₹3,800 to ₹4,000, New Delhi, Mumbai): `#042D23` to `#02241C` (Midnight Emerald to Supreme Deep Dark Green).
- **Full Grid Color Fill**: Configured city tiles so the cell itself is filled with the green shade (`backgroundColor: priceColor`), replacing the previous translucent 7% tint.
- **High-Contrast Text Hierarchy**: Implemented mathematical luminance thresholding via `getCityTextColor(price)`:
  - For light green shades ($\le ₹1,400$): text is rendered in deep dark pine/black (`#022C22`, contrast ratio $> 9:1$) with zero drop shadow.
  - For medium-to-deep green shades ($> ₹1,400$): text is rendered in crisp white (`#FFFFFF`, contrast ratio $> 7:1$ to $18:1$) with a dark drop shadow (`drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]`).
- **In-Grid Purchase Price Badges**: Added an explicit deed buying price badge (`₹600` to `₹4,000`) directly beneath the city name on every property tile, establishing instant visual correlation between the green shade and the property tier.

### 2.28 Thin Black Border on Timer Seconds Inside Pop-up Windows
- Modified `PopupTurnTimer` to enforce a thin black border (`border border-black`, `border-width: 1px`) around the timer seconds element (`<span data-testid="popup-timer-seconds">...</span>`).
- Gives the countdown seconds badge a crisp, high-definition black boundary across all modal dialogs:
  - Civic Fund & Market Buzz rule popups.
  - Financial transaction notices & rent receipts.
  - Card inspection dialogs.
  - City title deed certificates & mortgage management modals.
  - Player asset inspection modals.

### 2.29 Online Room Creation Resolution & Hybrid Cloud/Firestore/Broadcast Architecture
- **Root Cause Analysis of Creation Failure**:
  1. On the live deployment (`https://k-692.github.io/Monopoly-India-Game/`), `VITE_FIREBASE_*` environment variables were blank when built by GitHub Actions because repository secrets had not been populated manually, causing `isFirebaseConfigured` to return `false` and aborting `handleOpenCreateModal` before the modal could even open.
  2. In Cloud Functions, `asia-south1` endpoints returned 404 on un-deployed projects, which previously threw an uncaught exception that aborted room creation.
- **Architectural Resolution**:
  - Restored the public web client identifiers for `monopoly-india-f9700` as default configuration fallbacks in `src/lib/firebase/firebase-config.ts` and `.github/workflows/deploy-pages.yml`.
  - Updated `firestore.rules` to grant read, create, update, and member management permissions to authenticated anonymous users.
  - Implemented a 3-tier resilient multiplayer engine in `use-room-store.ts`:
    1. **Primary**: Firebase Cloud Functions v2 callables (`createRoom`, `joinRoom`, `setReady`, `startGame`).
    2. **Direct Firestore Fallback**: Atomic batch writes (`writeBatch`), SHA-256 invite code hashing, and query-based matchmaking if Cloud Functions are offline or return 404.
    3. **Local / Cross-Tab BroadcastChannel**: Resilient in-memory/localStorage session relay with instant same-device synchronization if Firestore permissions are locked, ensuring room creation never fails.

---

## 3. Wi-Fi LAN Authoritative Multiplayer System (Final Architecture & Paradigm Shift)

### 3.1 Motivation & Architectural Paradigm Shift
While cloud databases (such as Firestore) provide globally accessible matchmaking, they introduce critical vulnerabilities and constraints for real-time turn-based board games:
1. **Network Latency & Internet Dependency**: Requires continuous active internet connectivity, rendering gameplay unviable during outages, flights, travel, or high-latency local Wi-Fi environments.
2. **Third-Party Service Flakiness & Cold Starts**: Serverless cloud functions introduce cold-start latencies (1-3s), while rate limits and quota exhaustions disrupt active tournament matches.
3. **Security & State Divergence**: Optimistic client mutations against cloud documents risk race conditions, stale document snapshots, and desynchronization during simultaneous user interactions.

To resolve these constraints, the multiplayer backend was completely transitioned to a **local Wi-Fi LAN, server-authoritative multiplayer architecture** powered by **Node.js 22+, Express, and Socket.IO**. One player's machine (host laptop) runs an authoritative game daemon, exposing a combined HTTP asset server and WebSocket transport that peers on the local wireless network connect to with sub-millisecond round-trip times.

```
+──────────────────────────────────────────────────────────────────────────────+
│                          AUTHORITATIVE HOST SERVER                           │
│                             (Node.js 22 + Express)                           │
│                                                                              │
│    +───────────────────────+                    +───────────────────────+    │
│    │  Express Asset Server │                    │   Socket.IO Gateway   │    │
│    │    (Port 4173, SPA)   │                    │     (ws://, WSS)      │    │
│    +───────────┬───────────+                    +───────────┬───────────+    │
│                │                                            │                │
│                ▼                                            ▼                │
│        dist/ Production Bundle                     Typed Socket Handlers     │
│       (index.html, assets, chunks)              (register, join, command)    │
│                                                             │                │
│                                                             ▼                │
│    +────────────────────────────────────────────────────────────────────+    │
│    │                  AUTHORITATIVE STATE ENGINE                        │    │
│    │                                                                    │    │
│    │  [1] In-Memory Room Manager                                        │    │
│    │      - Rooms: Map<RoomId, ServerRoom>                              │    │
│    │      - Codes: Map<InviteCode, RoomId>                              │    │
│    │      - Sessions: Map<PlayerUid, PlayerSession>                     │    │
│    │                                                                    │    │
│    │  [2] Per-Match Promise Queue (Strict FIFO Execution)               │    │
│    │      Command C_k ──► Queue ──► applyGameCommand() ──► V_{k+1}      │    │
│    │                                                                    │    │
│    │  [3] Cryptographic Dice Roll Generator                             │    │
│    │      dice = [crypto.randomInt(1, 7), crypto.randomInt(1, 7)]       │    │
│    │                                                                    │    │
│    │  [4] Authoritative 1s Turn Countdown Timer                         │    │
│    │      t_{remain} ──► 0 ──► Deterministic Timeout Action             │    │
│    │                                                                    │    │
│    │  [5] Command Deduplication Cache                                   │    │
│    │      Map<CommandId, CommandResult>                                 │    │
│    +────────────────────────────────────────────────────────────────────+    │
+───────────────────────────────────────▲──────────────────────────────────────+
                                        │
                         Wi-Fi LAN Transport (Zero Internet)
                         http://<LAN_IP>:4173 & ws://<LAN_IP>:4173
                                        │
           +────────────────────────────┴───────────────────────────+
           │                                                        │
           ▼                                                        ▼
+───────────────────────+                                +───────────────────────+
│   Host Browser Client │                                │  Guest Mobile/Browser │
│    (React 19 + Vite)  │                                │   (React 19 + Vite)   │
│  - Presentation Store │                                │  - Presentation Store │
│  - 3D Tumbling Dice   │                                │  - 3D Tumbling Dice   │
│  - Web Audio Engine   │                                │  - Web Audio Engine   │
+───────────────────────+                                +───────────────────────+
```

### 3.2 Network Topology Discovery & Single-Origin Co-Location
- **Multi-Interface Scanning**: The server queries `os.networkInterfaces()` on startup, filtering out internal loopback interfaces (`127.0.0.1`, `::1`) and virtual networks.
- **Private Address Verification**: Evaluates RFC 1918 private IPv4 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and displays human-readable local addresses in the startup terminal banner.
- **Single-Origin Deployment**: The Express HTTP server and Socket.IO engine bind to `0.0.0.0:4173`. When guest devices navigate to `http://<HOST_IP>:4173`, the browser fetches the production React application from `dist/` and initializes `socket.io-client` against `window.location.origin`. This eliminates cross-origin restrictions, eliminates port divergence, and simplifies network routing.
- **Diagnostic LAN Endpoints**:
  - `GET /api/health`: System health monitor reporting process uptime, active memory rooms, and active game instances.
  - `GET /api/lan-info`: JSON endpoint returning detected LAN IPv4 addresses, active port, primary address, and shareable hostnames.

### 3.3 Cryptographic Session Identity & Reconnection Security
- **No Reliance on Client-Supplied Identifiers**: To prevent session spoofing and identity hijacking, client identifiers are generated server-side.
- **Cryptographic Reconnection Tokens**: When a client registers via `player:register`, the server generates:
  $$\text{PlayerUID} = \text{uuidv4}()$$
  $$\text{ReconnectToken} = \text{crypto.randomBytes}(32).\text{toString('hex')}$$
- **Rehydration Protocol**: The client persists both credentials in browser `localStorage`. Upon page reload or transient Wi-Fi disconnection, the client emits `player:resume` with its `reconnectToken`. The server authenticates the token in $O(1)$ time, associates the new socket ID with the existing player profile, and re-subscribes the socket to its active room and game channels without disrupting match progression.

### 3.4 Cryptographic Dice Generation & Anti-Cheat Invariants
- **Elimination of Client-Side Dice**: In peer-to-peer or client-centric systems, clients compute dice outcomes and transmit results, enabling memory editing and packet manipulation attacks.
- **Server-Side Cryptographic Randomness**: All dice rolls are computed inside `server/game/game-manager.ts` using Node.js hardware-backed cryptographically secure pseudo-random number generator:
  $$D_1 = \text{crypto.randomInt}(1, 7), \quad D_2 = \text{crypto.randomInt}(1, 7)$$
- **Presentation Separation**: The client triggers 3D tumbling physics and Web Audio rolling sounds upon initiating the roll action. When the authoritative `game:event` (`DICE_ROLLED`) arrives from the server, the visual dice settle smoothly onto the server-dictated faces $[D_1, D_2]$, guaranteeing visual immersion without sacrificing cryptographic integrity.

### 3.5 Distributed Concurrency Control: Sequential Queue & Idempotency
- **Per-Game Promise Queue**: Multiple players may interact with the board concurrently (e.g. trading, mortgaging, rolling, reacting). To ensure strict linearizability, every active match possesses an isolated promise chain:
  ```typescript
  class GameManager {
    private actionQueues = new Map<GameId, Promise<void>>();
    
    public async dispatchCommand(gameId, command): Promise<GameCommandResponse> {
      return new Promise((resolve) => {
        const currentQueue = this.actionQueues.get(gameId) || Promise.resolve();
        const nextQueue = currentQueue.then(async () => {
          const result = await this.executeAuthoritativeCommand(gameId, command);
          resolve(result);
        });
        this.actionQueues.set(gameId, nextQueue);
      });
    }
  }
  ```
- **Command Deduplication**: Clients generate a unique UUID `commandId` per action. Retransmitted packets due to wireless jitter or double-clicks hit an in-memory command cache:
  $$\text{Cache}(\text{gameId}, \text{commandId}) \to \text{GameCommandResponse}$$
  Duplicate commands return the cached response immediately with zero state mutation.

### 3.6 Monotonic State Synchronization & Event Streaming
- **Monotonic Version Counter**: Every committed mutation increments the match version:
  $$V_{k+1} = V_k + 1$$
- **Dual-Stream Broadcast Protocol**:
  1. `game:state`: Full snapshot of authoritative `GameState` containing the updated board version, player balances, property deeds, turn phase, and log records.
  2. `game:event`: Granular discrete event notifications (`DICE_ROLLED`, `PAWN_MOVED`, `PROPERTY_BOUGHT`, `TURN_CHANGED`, `BANKRUPTCY`) carrying payload metadata (e.g. step path, destination space index, transaction amount).
- **Client Presentation Reconciliation**: The frontend Zustand store (`useGameStore`) ingests `game:state` to synchronize underlying state models while triggering step-by-step 0.5s pawn stepping animations, audio synthesizer chimes, and callout comment boxes driven by the corresponding `game:event`.

### 3.7 Authoritative Turn Countdown State Machine
- **Server-Driven Interval Timer**: Each match maintains a 1,000ms server interval tracking remaining turn seconds ($t_{\text{remain}}$).
- **Network Synchronization**: The server broadcasts `game:timer` ($t_{\text{remain}}$) to all room participants every second.
- **Deterministic Timeout Fallbacks**: If $t_{\text{remain}} \le 0$, the server terminates the turn by executing an authoritative fallback action corresponding to the current phase:
  - Phase `AWAIT_ROLL`: Automatically rolls dice for the active player.
  - Phase `PROPERTY_DECISION`: Automatically declines the property acquisition.
  - Phase `MANAGEMENT`: Automatically executes `END_TURN` and transitions play to the next active player.
  - Phase `JAIL_DECISION`: Automatically chooses `TRY_DOUBLES`.
This guarantees that stalled clients, abandoned browsers, or network drops never freeze tournament gameplay.

### 3.8 Frictionless Universal Cross-Device Joining & QR Discovery
- **6-Character High-Contrast Room Codes**: Generated via `crypto.randomInt` using an unambiguous alphabet (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`), excluding visually ambiguous glyphs (`0`, `O`, `1`, `I`, `L`).
- **QR Code Generation**: Using `qrcode`, the host lobby dynamically renders a high-definition 2D QR matrix encoding the exact LAN deep-link URL:
  $$\text{URL} = \text{http://} + \text{HostLANIP} + \text{:} + \text{Port} + \text{/\#/join/} + \text{InviteCode}$$
- **Multi-Device Compatibility**: Any modern smartphone camera (iOS Safari / Android Chrome) scans the QR code to launch the web client and join the lobby within 2 seconds, requiring zero application store downloads or manual IP configuration.

### 3.9 Dual Build Targets & Asset Resolution
- **Target 1: LAN Hosting (`.env.lan`)**:
  - `VITE_APP_BASE_PATH=/`
  - React application bundles root-relative assets (`/assets/...`), allowing the host server on port 4173 to serve the application directly from the filesystem root.
- **Target 2: GitHub Pages Demo (`vite.config.ts`)**:
  - Defaults to `/Monopoly-India-Game/` in production if `VITE_APP_BASE_PATH` is unspecified, maintaining continuous compatibility with GitHub Pages static hosting.

---

## 4. Production Deployment & Verification

### 4.1 Automated CI/CD & Testing Verification
- **Unit & State Machine Tests**: Vitest suite (19/19 tests passing) verifies:
  - 12 Game Engine invariants: discrete currency resolution, transit scaling, 3-consecutive doubles incarceration, 2-player turn cycles, `boughtOnTurn` construction delay enforcement, jailed owner rent exemption, dice-total card index resolution, transaction acknowledgement state transitions, and complete bankruptcy tournament rules.
  - 7 Authoritative Multiplayer Integration tests: Real Socket.IO client-server interactions testing session registration, cryptographic reconnect token verification, room creation, guest joining via invite code, multi-player readiness toggling, game initialization, and command dispatch.
- **Cross-Platform End-to-End Suite**: Playwright multi-browser test suite (`e2e/lan-multiplayer.spec.ts` and responsive suites):
  - Validates multi-client browser sessions simultaneously simulating host laptop and guest device creating rooms, joining via deep-link URLs, readying up, launching games, and rolling server-authoritative dice.
- **Typecheck & Lint**: Strict TypeScript validation (`tsc --noEmit`) and ESLint audits passing with 0 errors and 0 warnings.
- **Production LAN Build**: `npm run build:lan` builds the production bundle to `dist/` in under 2 seconds.

