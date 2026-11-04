<div align="center">
  <img src="public/assets/game_logo.png" alt="Indian Monopoly Logo" width="180" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);" />
  
  # 🇮🇳 Indian Monopoly — Online Multiplayer Board Game

  [![CI](https://github.com/K-692/Monopoly-India-Game/actions/workflows/ci.yml/badge.svg)](https://github.com/K-692/Monopoly-India-Game/actions/workflows/ci.yml)
  [![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-success.svg)](https://k-692.github.io/Monopoly-India-Game/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4+-38b2ac.svg)](https://tailwindcss.com/)
  [![Vite](https://img.shields.io/badge/Vite-6.0+-646cff.svg)](https://vite.dev/)

  **Play instantly in your browser:**  
  ### 🎮 [https://k-692.github.io/Monopoly-India-Game/](https://k-692.github.io/Monopoly-India-Game/)
</div>

---

> **About the Project:**  
> Indian Monopoly is a modern, high-performance, zero-scroll online multiplayer property trading board game. Built with React 19, TypeScript, Tailwind CSS, and Cloud Firestore, it features 24 premier Indian metropolitan cities (strictly 6 per side), 4 intercity transit hubs with authentic vector illustrations, 12 Civic Fund and 12 Market Buzz canonical rules indexed symmetrically in the center, 3D tumbling dice, pointed comment boxes for buying/building, in-grid city landmarks, authoritative live turn timers on all popups, and strict tournament bankruptcy rules.

---

## 🎯 How to Play

### 1. Game Objective
The objective of Indian Monopoly is to accumulate wealth, acquire high-yield Indian metropolitan properties, develop residential blocks and commercial towers, and bankrupt your rivals. **The game concludes immediately when opponents become completely bankrupt — possessing ₹0 cash and no unmortgaged properties to raise capital.** The last solvent tycoon is crowned victorious!

### 2. Turn Sequence
1. **Roll the Dice**:
   - The active player rolls two dice featuring 3D tumbling physics and perspective animations.
   - The combined total is displayed directly beneath the dice arena (e.g. `🎲 Rolled: 8`).
   - Rolling doubles gives you an immediate extra turn! (Rolling doubles 3 consecutive times sends you directly to Central Jail).
2. **Move Around the 40-Space Board**:
   - Your token advances clockwise across the board.
   - Passing or landing on **START** awards you a **₹2,000** salary reward from the Reserve Bank.
3. **Resolve Destination Space**:
   - **Unowned Property**: An in-board pointed callout box appears near your grid space offering to purchase the deed for the listed price.
   - **Owned Property**: Pay the owner the calculated rent. (If the owner is currently incarcerated in Central Jail, **no rent is collected**).
   - **Civic Fund / Market Buzz**: The dice sum rolled determines which numbered rule (#1 to #12) is executed from the dual indexed center panels.
   - **Statutory Taxes**: Pay ₹2,000 at GST Checkpost or ₹1,000 at Infrastructure Wealth Levy.
   - **Rest House / Just Visiting**: Safe rest zones with no penalty.
4. **End Turn**:
   - Manage your properties, inspect deeds, mortgage unimproved spaces for quick liquidity, and press **END TURN** to pass play to the next tycoon. Each turn features a 30-second live countdown timer.

---

### 3. Buying, Building & Development Rules
- **Acquiring Cities**:
  - Landing on an unowned city prompts a pointed comment box. You can purchase the property deed or decline.
  - Upon purchase, the grid space is branded with your player token color and displays your ownership badge.
- **Next-Turn Construction Constraint**:
  - You **cannot build a house on the same turn** you acquire a city.
  - Construction is unlocked on subsequent rounds when you visit your city again with sufficient funds.
  - Upgrade through 4 Residential Blocks, then construct a prestigious **Skyscraper Commercial Tower** for maximum rental yield.
- **Transits & Public Utilities**:
  - **4 Transit Hubs** (CST Mumbai, Howrah Railway, Chennai Airport, New Delhi Airport): Rent scales exponentially with the number of transits owned (₹250 ➔ ₹500 ➔ ₹1,000 ➔ ₹2,000).
  - **2 Utilities** (Urja Power Grid, Jal Board Authority): Rent is 4× dice roll for 1 utility, or 10× dice roll if both are held.

---

### 4. Canonical 1..12 Indexed Rule Decks

#### 🏛️ Civic Fund (12 Community Treasury Rules)
| No. | Rule Title | Card Instruction |
|:---:|:---|:---|
| **1** | Bank Interest | Receive ₹500 from the Reserve Bank. |
| **2** | Tax Refund | Receive ₹700 statutory tax refund. |
| **3** | Education Expense | Pay ₹400 for community education development. |
| **4** | Festival Gathering | Pay ₹200 to every other active solvent player. |
| **5** | Development Grant | Receive ₹100 for each house and ₹300 for each commercial tower owned. |
| **6** | Municipal Maintenance | Pay ₹250 for every property deed you own. |
| **7** | Community Grant | Receive ₹1,000 from the community development fund. |
| **8** | Road Repair Contribution | Pay ₹1,000 municipal road repair contribution. |
| **9** | Special Legal Exemption | Keep this Get Out of Jail Free card until used or traded. |
| **10** | Civic Investigation | Go directly to Jail. Do not collect START salary. |
| **11** | Legal Settlement | Receive ₹1,500 legal settlement from the bank. |
| **12** | Utility Expenses | Pay ₹600 for municipal water and electricity expenses. |

#### 📈 Market Buzz (12 Fortune & Chance Rules)
| No. | Rule Title | Card Instruction |
|:---:|:---|:---|
| **1** | Startup Grant | Receive ₹800 innovation grant from the bank. |
| **2** | Festival Travel | Advance to START and collect ₹2,000 salary. |
| **3** | Business Conference | Advance to Delhi – Connaught Place. Collect START salary if passed. |
| **4** | Railway Expansion | Advance to the next Transit hub. Pay 2× transit rent if owned; buy or auction if unowned. |
| **5** | Road Diversion | Move backwards 3 spaces and resolve destination tile. |
| **6** | Highway Toll | Pay ₹300 highway toll to the Reserve Bank. |
| **7** | Property Maintenance | Pay ₹250 for each house and ₹750 for each commercial tower owned. |
| **8** | Successful Tender | Receive ₹1,200 tender award from the bank. |
| **9** | Regulatory Violation | Go directly to Jail. Do not collect START salary. |
| **10** | Transit Dividend | Receive ₹400 for each Transit hub you own. |
| **11** | Emergency Procurement | Pay ₹700 emergency procurement charge to the bank. |
| **12** | Mumbai Investment Trip | Advance to Mumbai – Marine Drive. Collect START salary if passed. |

---

### 5. Central Jail Rules & Zero-Rent Invariant
- **Entering Jail**: Landing on "Go To Jail", rolling 3 consecutive doubles, or drawing rule #10 from Civic Fund / #9 from Market Buzz sends you to Central Jail.
- **Zero Income Incarceration**: While in jail, **you earn ₹0 in rent** from opponents landing on your properties and collect ₹0 from player cash redistributions.
- **Exiting Jail**:
  1. Pay the ₹500 statutory bail fee on your turn.
  2. Roll doubles on any of your 3 turn attempts.
  3. Redeem a "Special Legal Exemption" Get Out of Jail Free card.

---

### 6. Universal Mortgages & Complete Bankruptcy
- **Mortgaging**: Any player can mortgage any of their unimproved properties on their turn to raise liquid capital (mortgage value is 50% of deed price). Mortgaged properties collect ₹0 rent until redeemed for mortgage value + 10% interest.
- **Complete Bankruptcy & Victory**:
  - A player is declared completely bankrupt when their cash reaches **₹0** and they have **no unmortgaged properties** left to raise funds.
  - All properties of the bankrupt player are liquidated back to the Reserve Bank.
  - When all opponents are eliminated and only 1 solvent player remains, the game concludes instantly with full celebration!

---

## 🔐 Security & GitHub Secrets Configuration

This repository strictly contains **no hardcoded secrets or API keys**. All sensitive credentials are resolved via Vite environment variables and GitHub Actions repository secrets.

### How to Add Firebase Secrets to GitHub Actions:
To deploy your own live version via GitHub Pages with full Firebase sync:
1. Navigate to your repository on GitHub:  
   `https://github.com/K-692/Monopoly-India-Game`
2. Click **Settings** ➔ **Secrets and variables** ➔ **Actions**.
3. Click the green **New repository secret** button.
4. Add the following secrets corresponding to your Firebase project:

| Secret Name | Value Description |
|:---|:---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain (`<project-id>.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket URL |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics Measurement ID (Optional) |

Once added, any push to `main` triggers `.github/workflows/deploy-pages.yml` to securely build and deploy your app to GitHub Pages with zero exposed secrets!

---

## 💻 Local Development & Testing

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Running Locally
```bash
# 1. Clone repository
git clone https://github.com/K-692/Monopoly-India-Game.git
cd Monopoly-India-Game

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Verification Commands
```bash
# Run unit & engine tests
npm test

# Run production build
npm run build
```

---

## 🤝 How to Contribute

We warmly welcome contributions from developers, game designers, and open-source enthusiasts!

1. **Fork the Repository**: Click the **Fork** button at the top right of this page.
2. **Clone your fork**:
   ```bash
   git clone https://github.com/<your-username>/Monopoly-India-Game.git
   cd Monopoly-India-Game
   ```
3. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Make Your Changes**:
   - Write clean, type-safe TypeScript code.
   - Maintain the zero-scroll layout principles and responsive designs.
   - Preserve comments for clarity.
5. **Run the Test Suite**:
   ```bash
   npm test
   npm run build
   ```
   Ensure all tests pass cleanly with zero warnings or errors.
6. **Commit & Push**:
   ```bash
   git commit -m "feat: add amazing feature"
   git push origin feature/amazing-feature
   ```
7. **Submit a Pull Request**: Open a PR with a clear summary of your enhancements, rationale, and screenshots if UI changes are included.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for complete details.
