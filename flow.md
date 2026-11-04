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

---

## 3. Production Deployment & Verification

### 3.1 Automated CI/CD & Testing Verification
- **Unit & State Machine Tests**: Vitest suite (11/11 tests passing) verifies discrete currency resolution, transit scaling, 3-consecutive doubles incarceration, 2-player turn cycles, `boughtOnTurn` construction delay enforcement, jailed owner rent exemption, dice-total card index resolution, and transaction acknowledgement state transitions.
- **Cross-Platform End-to-End Suite**: Playwright multi-worker browser verification validates navigation, practice match launching, dice rolling, sound synthesis toggles, and responsive layouts across Chromium, WebKit, and mobile viewport simulations.
- **Production Build**: Verified with `npm run build` (`tsc -b && vite build`) with zero TypeScript errors.
- **GitHub Pages Deployment**:
  - **Live URL**: `https://k-692.github.io/Monopoly-India-Game/`
  - **Routing Paradigm**: HTML5 HashRouter (`/#/`, `/#/practice`, `/#/room/:roomId`).
  - **Automated CI/CD**: Fully configured via `.github/workflows/deploy-pages.yml` with automated builds and artifact uploads on every push to `main`.
