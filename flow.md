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

### 2.3 Pointed Comment Box (Contextual Action Callout)
- Positioned dynamically adjacent to the active player's space on the perimeter grid with an authentic pointer triangle pointing at the tile.
- **Affordability Gating**:
  - Purchase prompt is displayed only when player has sufficient funds (`cash >= price`). If balance is insufficient, the prompt is suppressed and an `"Insufficient balance to purchase this property."` toast is triggered.
  - Construction prompt is displayed only when player has sufficient funds (`cash >= buildingCost`). If balance is insufficient, the prompt is suppressed and an `"Insufficient balance to build on this property."` toast is triggered.
  - Reacquisition prompt is displayed when an owner visits their mortgaged property with sufficient funds (`cash >= mortgagePayout`).

---

## 3. Mathematical Models & Financial State Formulations

### 3.1 Dice Dynamics, Single-Roll Invariant & Jail Incarceration
- **Strict Single-Roll Invariant**:
  - If a player rolls doubles (e.g. 2,2 or 6,6) during their turn, they do **not** receive another chance to roll. Only one roll is allowed per turn.
  - Upon resolving board landing effects and property decisions, ending the turn strictly advances play to the next player.
- **Jail Try Double Window (Turns 1, 2, and 3)**:
  - An incarcerated player may attempt to roll doubles on their first three eligible turns ($N_{\text{jail}} \in \{0, 1, 2\}$).
  - **Success Case**: If $d_1 = d_2$, the player is released immediately ($\text{inJail} = \text{false}$), moves forward by $d_1 + d_2$, and **does not receive an extra turn**. Flag `escapedJailThisTurn = true` prevents the standard doubles re-roll invariant.
  - **Failure Case**: If $d_1 \ne d_2$, the player remains in jail, incrementing $N_{\text{jail}} \leftarrow N_{\text{jail}} + 1$. The player does not move and their turn ends immediately.
- **Automatic 4th Eligible Turn Release**:
  - If a player fails all 3 double attempts ($N_{\text{jail}} \ge 3$), the engine automatically releases them at the beginning of their 4th eligible turn ($\text{inJail} \leftarrow \text{false}, N_{\text{jail}} \leftarrow 0$) without requiring a Try Double roll. The player proceeds to roll and move normally.

### 3.2 Distinct Airport Visiting Rent Scaling
Airport transit charges scale distinctly higher than railways to reflect high-value aviation infrastructure:
$$\text{Rent}_{\text{airport}}(k) = \begin{cases} 
₹1,000 & \text{if } k = 1 \\
₹2,500 & \text{if } k = 2 
\end{cases}$$
Where $k$ is the number of airports owned by the same proprietor (Chennai Airport #25 and IGI Airport #35). In contrast, railways (CST Mumbai #5 and Howrah #15) scale at ₹250 and ₹500 respectively. Rent collection is nullified if the owner is in jail, the airport is mortgaged, or the owner is disqualified.

### 3.3 Mortgage Valuation Model with Development Recovery
To prevent exploits while fairly crediting invested capital:
$$V_{\text{mortgage}}(S, P) = \min\left(P_{\text{base}}, \left\lfloor 0.5 \times P_{\text{base}} + 0.5 \times \sum_{i=1}^{B} C_{\text{build}}\right\rfloor\right)$$
Where:
- $P_{\text{base}}$ is the property's initial purchase price.
- $B$ is the number of houses built ($B \in [0, 5]$ where 5 represents a Commercial Tower).
- $C_{\text{build}}$ is the building cost per unit.
- **Asset Integrity**: Physical developments are **not demolished** upon mortgaging. They remain physically attached to the deed.
- **Exact Reacquisition Cost**:
  $$C_{\text{reacquire}} = V_{\text{payout\_received}}$$
  The redemption cost strictly equals the exact mortgage proceeds credited when the property was mortgaged.

### 3.4 Mandatory Financial Resolution & Blocked Property Invariant
When a financial obligation $D$ (rent, tax, or fine) exceeds available liquid cash $C$:
1. The transaction pauses, entering state `pendingFinancialObligation`.
2. A non-bypassable **Financial Resolution Window** opens for the debtor.
3. The debtor must mortgage eligible properties to raise cash until $C \ge D$, then click `Pay Outstanding Debt` (`RESOLVE_OBLIGATION`).
4. **Surrender / Give Up (`GIVE_UP`)**:
   - If unable or unwilling to settle, debtor surrenders.
   - All remaining cash ($C$) is transferred to the creditor.
   - Debtor is marked $\text{isBankrupt} = \text{true}$ and $\text{isDisqualified} = \text{true}$.
   - All debtor properties transition to ownership state `BLOCKED`:
     $$\text{ownershipState}(p) \leftarrow \text{'BLOCKED'}$$
     Blocked properties remain permanently on the board, produce zero rent, and cannot be acquired, traded, or mortgaged.

### 3.5 Immutable Financial Ledger (`FinancialTransaction`)
Every balance modification atomically appends an immutable transaction record:
```typescript
export interface FinancialTransaction {
  transactionId: string;
  gameSessionId: string;
  playerUid: string;
  type: FinancialTransactionType;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  spaceIndex?: number;
  propertyName?: string;
  counterpartyUid?: string | null;
  counterpartyName?: string | null;
  description: string;
  timestamp: number;
  eventId?: string;
}
```
Records are synchronized across all clients and viewable in reverse-chronological order within the Player Profile statement.

---

## 4. UI/UX Transformation: Toast Notifications & Responsive Engineering

### 4.1 Non-Blocking Floating Toasts
- Replaced disruptive blocking acknowledgment modals with lightweight, non-blocking toast notifications positioned at the bottom-left corner of the viewport (`fixed bottom-4 left-4 z-50`).
- **Autonomic Dismissal**: Toasts automatically fade out after 3,000ms.
- **Manual Control**: Each toast features a subtle `×` dismiss button.
- **Per-Player Client Isolation**: Notifications for one player never block or hijack another player's viewport or interaction state.

### 4.2 Universal Device Layout Matrix
- Tested and verified across desktop monitors, iPads/tablets, and mobile phones.
- Center arena perspective preservation maintains 3D dice readability while preventing overlapping perimeter cells.

---

## 5. Architectural Migration: Zero-Cloud Authoritative LAN Server

### 5.1 Retirement of Firebase / Firestore
All cloud dependencies (Firebase Auth, Cloud Firestore, Realtime Database, Cloud Functions) have been completely removed:
- Deleted unused Firebase client SDKs (`src/lib/firebase/`), configuration manifests (`firebase.json`, `.firebaserc`, `firestore.rules`), and GitHub action deployments.
- Removed `firebase` npm dependency.

### 5.2 Standalone Node.js & Socket.IO Architecture
- **In-Memory Authoritative Engine**: Matches run entirely on an authoritative Node.js process using pure functional state reducers (`engine.ts`).
- **Cryptographic Reconnection Tokens**: Resumed sessions verify ephemeral cryptographically generated tokens, guaranteeing zero identity spoofing across network drops.
- **QR Code Discovery**: Automatic LAN IP resolution generates instant 2D QR matrices for frictionless mobile browser onboarding.

---

## 6. Verification, Test Coverage & Benchmark Results

### 6.1 Test Suite Summary
- **Unit & Invariant Suite (`engine.test.ts`)**: 24 tests passing:
  - 1st, 2nd, and 3rd jail escape double attempts with extra turn suppression.
  - Incarcerated failed attempts maintaining zero movement.
  - 4th turn automatic release without Try Double requirement.
  - Insufficient cash rejection for property purchases and building.
  - Mortgage valuation formula with house recovery and capped bounds.
  - Exact payout reacquisition without penalty.
  - Financial resolution debt handling, surrender, and `BLOCKED` deed retention.
  - Transaction ledger accuracy.
- **Integration Suite (`multiplayer-integration.test.ts`)**: 7 tests passing covering real socket connections, room creation, join, ready toggling, and command execution.
- **Production Build**: Verified with Vite production build completing in 2.16s with zero TypeScript compilation errors.
