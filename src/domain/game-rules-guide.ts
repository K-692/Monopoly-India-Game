/**
 * Indian Monopoly - Comprehensive Authoritative In-Game Rules Guide
 *
 * Sourced directly from authoritative game engine implementation, constants,
 * and multiplayer rulesets. Used by the in-game Rules Modal (?) to present
 * complete, structured, and accurate guidance to players.
 */

import {
  STARTING_CASH_MIN,
  STARTING_CASH_MAX,
  STARTING_CASH_STEP,
  STARTING_CASH_DEFAULT,
  PASS_START_REWARD_OPTIONS,
  DEFAULT_HOST_RULES,
} from './ruleset';

export interface RuleSectionItem {
  subtitle: string;
  points: string[];
}

export interface RuleSection {
  id: string;
  number: number;
  title: string;
  badge?: string;
  icon: string;
  summary: string;
  items: RuleSectionItem[];
}

export type GameRulesSection = RuleSection;

export const GAME_RULES_SECTIONS: RuleSection[] = [
  {
    id: 'objective',
    number: 1,
    title: 'Objective of the Game',
    badge: 'Victory & Net Worth',
    icon: 'Trophy',
    summary:
      'Build a dominant commercial empire across India, manage liquidity, and finish with the highest authoritative Net Worth.',
    items: [
      {
        subtitle: 'Core Objective',
        points: [
          'Acquire iconic Indian cities, transit hubs, and public utilities across the 40-tile perimeter board.',
          'Develop monopolized city groups with Houses and Commercial Towers to collect escalating tariffs from visiting opponents.',
          'Prudently manage available cash balance to survive economic downturns, tax checkposts, and market volatility.',
        ],
      },
      {
        subtitle: 'Cash Balance vs. Net Worth Distinction',
        points: [
          'Balance (Liquid Cash): The immediately available liquid currency in hand. Used for purchasing deeds, building upgrades, paying rent, and settling debts. Displayed in permanent emerald green at all times.',
          'NET WORTH (Enterprise Value): The authoritative measure of total player wealth: NET WORTH = Cash Balance + Total Owned Asset Value - Outstanding Liabilities.',
          'Total Owned Asset Value includes the full face-value purchase price of all owned cities, railways, and airports, plus 100% of all invested building and tower expenditures. For properties in mortgage, their mortgage value is counted. Bank-owned or unowned properties count as ₹0.',
          'Outstanding Liabilities includes any unfulfilled remaining debt from pending financial obligations.',
        ],
      },
      {
        subtitle: 'Deciding the Champion',
        points: [
          'When the match terminates (upon opponent surrender, disqualification through debt timeout, or game completion), the player with the highest total Net Worth is crowned champion.',
          'Tie-Breaker 1: If Net Worth is identical, the player with the higher Cash Balance wins.',
          'Tie-Breaker 2: If both Net Worth and Cash Balance tie, the winner is determined by player UID order.',
        ],
      },
    ],
  },
  {
    id: 'setup',
    number: 2,
    title: 'Game Setup',
    badge: 'Room Configuration',
    icon: 'Sliders',
    summary:
      'Host-configurable match parameters including Starting Capital, Salary, and Computer Players (CPUs).',
    items: [
      {
        subtitle: 'Room Creation & Seating',
        points: [
          'The host creates a room via Online Multiplayer or local LAN Multiplayer and distributes the unique Room ID.',
          'Rooms support 2 to 6 players total, combining human players and autonomous computer opponents.',
          'Randomized Match Turn Order: At the start of every new match, the entire player order is randomized using a cryptographically secure, unbiased Fisher–Yates shuffle. Player order does not simply follow room join order.',
        ],
      },
      {
        subtitle: 'Configurable Starting Capital',
        points: [
          `Host adjusts starting cash using an interactive slider from ₹${STARTING_CASH_MIN.toLocaleString('en-IN')} to ₹${STARTING_CASH_MAX.toLocaleString('en-IN')} in steps of ₹${STARTING_CASH_STEP.toLocaleString('en-IN')} (default ₹${STARTING_CASH_DEFAULT.toLocaleString('en-IN')}).`,
          'All participants begin with identical cash allocations credited before the first turn.',
        ],
      },
      {
        subtitle: 'Start Crossing Money Options',
        points: [
          `Host configures the salary received when crossing START with selectable options: ${PASS_START_REWARD_OPTIONS.map((amt) => `₹${amt.toLocaleString('en-IN')}`).join(', ')} (default ₹${DEFAULT_HOST_RULES.passStartReward.toLocaleString('en-IN')}).`,
        ],
      },
      {
        subtitle: 'Autonomous Computer Players (CPUs)',
        points: [
          'The host can add between 0 and 3 computer-controlled players (CPUs) when creating the room.',
          'CPU names are fully customizable (e.g., CPU1, CPU2, or personalized names).',
          'Computer players participate in the exact same game session, obeying identical authoritative engine rules, financial formulas, and turn sequencing as human players.',
        ],
      },
    ],
  },
  {
    id: 'turn-sequence',
    number: 3,
    title: 'Turn Sequence',
    badge: 'Turn Flow & Timing',
    icon: 'PlayCircle',
    summary:
      'A structured, synchronized sequence ensuring every player completes all actions before control transfers.',
    items: [
      {
        subtitle: 'Rolling the Dice',
        points: [
          'The active player rolls two independent, cryptographically fair 6-sided dice generating an authoritative total between 2 and 12.',
          'One Unified Dice Engine: Both humans and CPUs use the identical unbiased Web Crypto rejection-sampling algorithm. Out-of-range random bytes are rejected, eliminating modulo bias. Client animations are visual and never alter server results.',
          'Single Roll Rule: Rolling doubles does NOT grant an extra roll or turn. Exactly one roll is taken per turn.',
        ],
      },
      {
        subtitle: 'Movement & Board Animation',
        points: [
          'The player token animates smoothly step-by-step around the 40 perimeter tiles.',
          'The turn countdown timer is automatically PAUSED during movement animation so walking time is never penalized.',
        ],
      },
      {
        subtitle: 'Tile Resolution & Action Phases',
        points: [
          'Upon arriving at the destination space, the engine executes tile-specific mechanics (purchases, tariffs, draws, or fines).',
          'When reaching an actionable phase (e.g. Property Decision), the timer resets to the full 30-second duration.',
        ],
      },
      {
        subtitle: 'Mandatory Resolution of Turn Decisions',
        points: [
          'Unresolved mandatory gameplay popups (Buy Property, Reacquire from Bank, or Build Development) MUST be explicitly resolved before ending your turn.',
          'Generic End Turn commands and Spacebar shortcuts are strictly rejected while a decision popup is active.',
          'When a legal building opportunity exists, the player must either click Build or explicitly click Done (or press N) to skip construction.',
          'Automatic timeout handling resolves decisions if the turn timer expires, but players cannot manually bypass decisions.',
        ],
      },
      {
        subtitle: 'Turn Completion & Handoff',
        points: [
          'A turn is officially complete only after movement, rent exchanges, card popups, and financial settlements conclude.',
          'Between consecutive CPU turns, the game engine enforces a mandatory 2-second visual handoff delay for clear pacing.',
          'As soon as a CPU has executed its required decisions, it immediately concludes its turn without waiting for the timer to elapse.',
        ],
      },
    ],
  },
  {
    id: 'start-salary',
    number: 4,
    title: 'START and Salary',
    badge: 'Space #0 Economy',
    icon: 'Coins',
    summary:
      'Collect starting salary by passing or landing on Space #0 or drawing Festival Travel Market Buzz.',
    items: [
      {
        subtitle: 'Crossing or Landing on START',
        points: [
          'Every time a player passes or lands on Space #0 (START) in clockwise direction, they receive their statutory salary.',
          'The amount credited matches the host-configured salary (₹1,000, ₹2,000, or ₹3,000; default ₹2,000).',
          'Salary is credited immediately upon crossing and logged in the player transaction ledger.',
        ],
      },
      {
        subtitle: 'Festival Travel Market Buzz',
        points: [
          'Drawing the Festival Travel Market Buzz card displays: "Go to START and collect the starting money."',
          'The player token moves directly to Space #0 and is credited with exactly one salary payout.',
          'No duplicate or compounding salary is credited for this directive.',
        ],
      },
    ],
  },
  {
    id: 'properties-ownership',
    number: 5,
    title: 'Properties and Ownership',
    badge: 'Deeds & Development',
    icon: 'Building2',
    summary:
      '22 Indian Cities, 4 Transit Hubs, and 2 Public Utilities with tiered rental tariffs and upgrade ladders.',
    items: [
      {
        subtitle: 'Acquisition & Purchase',
        points: [
          'Landing on an unowned property permits the player to purchase the deed at face value.',
          'If the player cannot afford the deed price, the purchase prompt is suppressed and an "Insufficient balance" notice is displayed.',
        ],
      },
      {
        subtitle: 'Rent and Tariffs',
        points: [
          'Visiting opponents must pay rent directly to the property deed owner.',
          'Full Monopoly Bonus: Owning all cities in a color group doubles the base unimproved rent on all cities in that group.',
          'Rent is waived if the owner is currently in Central Jail or if the property has been sold to the Reserve Bank.',
        ],
      },
      {
        subtitle: 'Transit Hubs & Utilities',
        points: [
          'Airports (Spaces #15 & #35 - Chhatrapati Shivaji & Indira Gandhi): ₹1,000 rent for 1 airport; ₹2,500 rent for both airports.',
          'Railways (Spaces #5 & #25 - CST Mumbai & Howrah Station): ₹250 rent for 1 railway; ₹500 rent for both railways.',
          'Public Utilities (Spaces #12 & #28 - Urja Power Grid & Jal Board): Rent equals 4× dice roll for 1 utility; 10× dice roll if both are owned.',
        ],
      },
      {
        subtitle: 'Houses and Commercial Towers',
        points: [
          'Once a player holds a complete color group monopoly, they may construct houses on those cities.',
          'Construction is permitted starting from subsequent rounds when revisiting your owned property.',
          'Dynamic Construction Cost: The cost to build each house or commercial tower strictly equals the tariff of that resulting tier (House #1 = 1-house tariff, House #2 = 2-house tariff, House #3 = 3-house tariff, House #4 = 4-house tariff, Commercial Tower = tower tariff).',
          'Up to 4 Houses may be built per city; the 5th tier upgrade crowns the property with a Commercial Sky Tower.',
        ],
      },
    ],
  },
  {
    id: 'cards-events',
    number: 6,
    title: 'Market Buzz and Special Cards',
    badge: '22 Dynamic Cards',
    icon: 'Flame',
    summary:
      '11 Civic Fund and 11 Market Buzz event cards triggered by dice totals (2–12), affecting capital, navigation, and jail exemptions.',
    items: [
      {
        subtitle: 'Civic Fund (Community Treasury - 11 Cards, Rules #2 to #12)',
        points: [
          'Landing on Civic Fund spaces triggers one of 11 authentic canonical cards mapped directly to the two-dice roll total (totals 2 through 12).',
          'Features tax refunds, educational grants, festival gatherings, municipal dividends, and legal settlements.',
          'Includes the coveted non-tradable "Get Out of Jail Free" Bail Key card (Rule #9).',
        ],
      },
      {
        subtitle: 'Market Buzz (Fortune & Chance - 11 Cards, Rules #2 to #12)',
        points: [
          'Landing on Market Buzz spaces triggers dynamic economic events matching the two-dice roll total (totals 2 through 12).',
          'Features festival travels, railway expansions, successful tenders, transit dividends, and procurement expenses.',
          'Contains "Festival Travel: Go to START and collect the starting money" (Rule #2).',
        ],
      },
    ],
  },
  {
    id: 'taxes-special-tiles',
    number: 7,
    title: 'Taxes, Fees and Special Tiles',
    badge: 'Checkposts & Rest',
    icon: 'ShieldAlert',
    summary:
      'GST Checkpost, Infrastructure Wealth Levy, Rest House, and Central Jail rules.',
    items: [
      {
        subtitle: 'Statutory Taxes',
        points: [
          'GST Checkpost (Space #8): Statutory fee of ₹500 paid to the Reserve Bank.',
          'Infrastructure Wealth Levy (Space #37): Statutory capital levy of ₹500 paid to the Reserve Bank.',
        ],
      },
      {
        subtitle: 'Rest House (Space #20)',
        points: [
          'A neutral safe haven space equivalent to "Free Parking" / "Just Visiting".',
          'Players resting here incur no fees, debts, or penalties.',
        ],
      },
      {
        subtitle: 'Central Jail & Police Checkpoint (Spaces #10 & #30)',
        points: [
          'Landing on Police Checkpoint (Space #30), drawing a Go-to-Jail card, or rolling 3 consecutive doubles sends the player directly to Central Jail (Space #10).',
          'Central Jail Notification: Whenever any human or CPU player is sent to Central Jail, a real-time notification alert is displayed at the geometric center of the game board, directly covering both dice, for all participants.',
          'While in jail, players cannot collect rent from opponents or claim cash rewards.',
          'Escape Option 1: Pay statutory bail of ₹500 on any eligible jail turn.',
          'Escape Option 2: Use an active "Get Out of Jail Free" card if held.',
          'Escape Option 3: Attempt "Try Double" (roll identical dice faces) on turns 1, 2, or 3. If doubles are rolled, the player escapes immediately and moves by that roll (no extra turn).',
          'Automatic 4th Turn Release: If all 3 double attempts fail, the player is automatically released on their 4th jail turn without paying bail or rolling doubles.',
        ],
      },
    ],
  },
  {
    id: 'sell-to-bank',
    number: 8,
    title: 'Selling Properties to the Bank',
    badge: 'Liquidation Mechanics',
    icon: 'Landmark',
    summary:
      'Sell developable cities for Original Price + 50% tariff (reacquire for Original Price + 10% tariff) or non-cities at deed price, preserving all built structures.',
    items: [
      {
        subtitle: 'Sale and Reacquisition Pricing Formulas',
        points: [
          'City Sale Price = Original City Purchase Price + 50% of Current Tariff: The Reserve Bank pays the full deed purchase price plus 50% of the current tariff based on the existing development level (0 houses: base rent; 1-4 houses: corresponding house rent; Commercial Tower: tower rent).',
          'City Reacquisition Price = Original City Purchase Price + 10% of Current Tariff: When an eligible player lands on a bank-owned city, reacquisition costs the original deed purchase price plus only 10% of the current tariff based on preserved developments.',
          'Non-City Assets (Railways, Airports, Utilities): Both selling to the Bank and reacquiring from the Bank cost exactly 100% of the original deed purchase price (space.price). Tariff percentages are not applied to non-city assets.',
        ],
      },
      {
        subtitle: 'Turn Restrictions & Dedicated Interface',
        points: [
          'Voluntary Sell to Bank is permitted ONLY during the active owner\'s turn through the dedicated Sell Properties to Bank interface or the S keyboard shortcut.',
          'Sell-to-Bank actions are never embedded directly on individual board grid tiles or property cards.',
          'Financial Resolution Exception: When a debtor enters debt resolution for an outstanding financial obligation, they may liquidate eligible properties via the emergency resolution interface even outside normal turn actions.',
        ],
      },
      {
        subtitle: 'Building Preservation & Bank Inventory',
        points: [
          'Ownership is transferred immediately to the Reserve Bank; the property becomes unowned and generates zero rent.',
          'Built structures (Houses and Commercial Towers) are NOT demolished—they remain preserved on the deed during bank ownership.',
          'Any player who subsequently lands on the space may acquire the property from the bank at the authoritative reacquisition price, inheriting all existing buildings intact!',
        ],
      },
    ],
  },
  {
    id: 'debt-bankruptcy',
    number: 9,
    title: 'Debt and Bankruptcy',
    badge: '120s Emergency Window',
    icon: 'AlertTriangle',
    summary:
      'Authoritative 120-second emergency resolution window with Adjust Payouts and read-only Board Inspection.',
    items: [
      {
        subtitle: 'Entering Financial Debt',
        points: [
          'When an obligation (rent, statutory tax, or card penalty) exceeds available cash, the player enters debt resolution.',
          'The server starts an authoritative 120-second countdown timer that synchronizes across all players and survives network reconnections.',
        ],
      },
      {
        subtitle: 'Adjust Payouts (Sell to Bank)',
        points: [
          'Debtors can open the Sell-to-Bank interface to liquidate properties and raise the required settlement funds.',
          'Properties are sorted in ascending order of maximum potential tariff, protecting high-earning assets from hasty sale.',
        ],
      },
      {
        subtitle: 'Board Inspection Mode',
        points: [
          'Players can click "Check Board" to inspect the full board, opponent assets, and deed values in full quality without blur.',
          'A prominent "Return to Sell to Bank" button allows returning directly to debt resolution without losing countdown progress.',
        ],
      },
      {
        subtitle: 'Bankruptcy & Elimination',
        points: [
          'If the 120-second timer reaches 0 or the debtor clicks "Give Up", the player is eliminated immediately.',
          'The match terminates instantly, and the winner is decided by Net Worth among remaining players.',
        ],
      },
    ],
  },
  {
    id: 'winning',
    number: 10,
    title: 'Winning the Game',
    badge: 'Highest Net Worth',
    icon: 'Crown',
    summary:
      'Authoritative Net Worth formula, endgame triggers, and strict tie-breaking sequence.',
    items: [
      {
        subtitle: 'Endgame Triggers',
        points: [
          'A match concludes upon opponent surrender, debt timer expiration, or scheduled turn limit completion.',
          'The game engine immediately tallies authoritative Net Worth for all remaining non-bankrupt players.',
        ],
      },
      {
        subtitle: 'Authoritative Net Worth Formula',
        points: [
          'NET WORTH = Cash Balance + Total Owned Asset Value - Outstanding Liabilities.',
          'Total Owned Asset Value = sum of unmortgaged deed prices + mortgaged deed payout values + 100% of all constructed building/tower costs.',
          'Outstanding Liabilities = unpaid debt from active financial obligations.',
        ],
      },
      {
        subtitle: 'Tie-Breaking Protocol',
        points: [
          'The highest Net Worth player is declared champion.',
          'Live Dynamic Rankings: All player cards in the left panel display real-time sequential rank badges (#1 to #N). When Net Worth values are tied, ties are broken strictly by original room-joining order (the earlier joined player receives the better rank).',
          'Tie-Breaker 1: Highest remaining Cash Balance.',
          'Tie-Breaker 2: Lowest Player UID order.',
        ],
      },
    ],
  },
  {
    id: 'multiplayer-cpu',
    number: 11,
    title: 'Multiplayer and CPU Rules',
    badge: 'Multi-Agent Parity',
    icon: 'Users',
    summary:
      'Autonomous CPUs running on the authoritative engine with 2-second pacing and automatic turn handoff.',
    items: [
      {
        subtitle: 'Multi-Agent Parity',
        points: [
          'Computer-controlled players (CPUs) run on the identical server-authoritative engine as human players.',
          'No separate CPU logic, cheat shortcuts, or artificial balance adjustments exist.',
        ],
      },
      {
        subtitle: '2-Second CPU Turn Pacing',
        points: [
          'To ensure realistic visual observation for human players, a consistent 2-second handoff pause occurs between consecutive CPU turns.',
          'Human player turns alert the active player with an audible notification sound.',
        ],
      },
      {
        subtitle: 'Automatic Turn Completion',
        points: [
          'As soon as a CPU finishes its movement, card resolution, and property purchase/decline actions, it automatically concludes its turn.',
          'CPUs never stall or wait for the 30-second turn timer to expire.',
        ],
      },
      {
        subtitle: 'LAN & Online Multiplayer',
        points: [
          'Rooms operate seamlessly across local Wi-Fi/LAN networks and online WebSockets.',
          'Game state, player balances, net worth, and timers remain 100% synchronized in real time.',
        ],
      },
    ],
  },
  {
    id: 'keyboard-shortcuts',
    number: 12,
    title: 'Keyboard Shortcuts',
    badge: 'Controls & Accessibility',
    icon: 'Keyboard',
    summary:
      'Fast, context-sensitive keyboard controls for seamless and responsive gameplay without needing mouse clicks.',
    items: [
      {
        subtitle: 'Context-Sensitive Key Mapping',
        points: [
          'SPACE: Context-sensitive primary action — rolls dice during AWAIT_ROLL, tries doubles while in Central Jail (JAIL_DECISION), or ends your turn when eligible during MANAGEMENT and TURN_END. Spacebar is strictly disabled while an unresolved purchase, reacquisition, or build opportunity exists.',
          'ENTER: Context-sensitive positive confirmation — accepts property purchase prompt, unmortgages/reacquires properties from Bank, executes House/Tower development when building prompt is active, or pays Central Jail bail.',
          'S: Opens Sell to Bank interface (voluntary mortgage) to liquidate properties for cash when eligible.',
          'N: Context-sensitive negative action — declines property purchases, declines reacquisition, explicitly skips construction using the exact same action as the Done button, or closes supported modals (voluntary mortgage and card popups).',
        ],
      },
      {
        subtitle: 'Safety & Pacing Rules',
        points: [
          'Only the currently active local human player can invoke keyboard controls. Computer players never receive local key actions.',
          'Keyboard shortcuts are automatically suppressed while typing in input fields, textareas, selects, or search inputs.',
          'Key-repeat is ignored to prevent accidental multiple rolls or rapid unintended actions.',
          'Action priority: Active modals take precedence over general background turn actions.',
        ],
      },
    ],
  },
];

export const BUILDINGS_RULE_SECTION: GameRulesSection = {
  id: 'buildings-detail',
  number: 5,
  title: 'Buildings & Developments',
  badge: 'Construction',
  icon: 'Building2',
  summary:
    'Rules governing House and Commercial Tower construction, visiting-city eligibility, statutory costs, and bank preservation.',
  items: [
    {
      subtitle: 'Monopoly & Visiting-City Construction Rule',
      points: [
        'Complete Color Group Monopoly: A player must own all properties within a color group before constructing houses.',
        'Visiting City Requirement: In Indian Monopoly, construction is only permitted when actively landing on / visiting your owned monopoly city on a subsequent turn.',
        'No Remote Building: You cannot construct developments remotely on properties located elsewhere on the board.',
      ],
    },
    {
      subtitle: 'Building Tiers & Commercial Tower Upgrade',
      points: [
        'Houses: Construct up to 4 houses per city in sequential order (1, 2, 3, 4 houses).',
        'Commercial Sky Tower: The 5th tier upgrade replaces the 4 houses with a prestigious Commercial Tower, generating peak rent tariffs.',
        'Uniform Building Rule: Developments must be built evenly across the color group. You cannot build a second house on a city until all cities in that group have at least one house.',
      ],
    },
    {
      subtitle: 'Development Costs & Bank Preservation',
      points: [
        'Dynamic Construction Cost Equals Resulting Tariff: Construction cost is not fixed. A new House or Commercial Tower costs the tariff of that resulting development level (1st house = one-house tariff; 2nd house = two-house tariff; 3rd house = three-house tariff; 4th house = four-house tariff; Commercial Tower = tower tariff).',
        'Selling to Bank: If sold to the Bank, you receive the original deed price plus 50% of the current tariff at the existing development level.',
        'Development Preservation: Reacquiring a mortgaged property from the Bank costs the original deed price plus 10% of the current tariff and preserves all existing houses and towers intact.',
      ],
    },
    {
      subtitle: 'Keyboard Controls for Building',
      points: [
        'ENTER: When the Build House/Tower interface is active on your landed property, press Enter to build development immediately.',
        'SPACE: Spacebar will NOT skip building or end your turn while an eligible construction opportunity is pending.',
        'N: Press N or click Done to skip building and end the current turn.',
      ],
    },
  ],
};

export interface RulesCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  sectionIds: string[];
}

export const RULES_CATEGORIES: RulesCategory[] = [
  {
    id: 'overview',
    name: 'Overview',
    icon: 'Trophy',
    description: 'Game objective, balance vs. net worth, and champion rules',
    sectionIds: ['objective'],
  },
  {
    id: 'setup-players',
    name: 'Setup & Players',
    icon: 'Users',
    description: 'Room slots, human readiness, starting cash, and computer players (CPUs)',
    sectionIds: ['setup', 'multiplayer-cpu'],
  },
  {
    id: 'turns-actions',
    name: 'Turns & Actions',
    icon: 'PlayCircle',
    description: 'Turn sequence, fair dice rolls, token movement, and START salary',
    sectionIds: ['turn-sequence', 'start-salary'],
  },
  {
    id: 'properties-rent',
    name: 'Properties & Rent',
    icon: 'Building2',
    description: 'City deeds, tariffs, monopolies, transit airports/railways, and utilities',
    sectionIds: ['properties-ownership'],
  },
  {
    id: 'buildings',
    name: 'Buildings',
    icon: 'Hammer',
    description: 'House and Commercial Tower construction, visiting-city rule, and limits',
    sectionIds: ['buildings-detail'],
  },
  {
    id: 'cards-special-tiles',
    name: 'Cards & Special Tiles',
    icon: 'Flame',
    description: 'Civic Fund, Market Buzz, Central Jail, Rest House, and taxes',
    sectionIds: ['cards-events', 'taxes-special-tiles'],
  },
  {
    id: 'finance-debt',
    name: 'Finance & Debt',
    icon: 'Landmark',
    description: 'Selling properties to the bank, 120s debt timer, and liquidation',
    sectionIds: ['sell-to-bank', 'debt-bankruptcy'],
  },
  {
    id: 'winning-rankings',
    name: 'Winning & Rankings',
    icon: 'Crown',
    description: 'Authoritative NET WORTH formula, sequential rank badges, and tie-breakers',
    sectionIds: ['winning'],
  },
  {
    id: 'keyboard-shortcuts',
    name: 'Keyboard Shortcuts',
    icon: 'Keyboard',
    description: 'Context-sensitive Spacebar, S, Enter, and N desktop keyboard controls',
    sectionIds: ['keyboard-shortcuts'],
  },
];
