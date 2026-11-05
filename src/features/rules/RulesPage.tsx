import React, { useState } from 'react';
import {
  BookOpen,
  Building2,
  Train,
  Gift,
  Flame,
  KeyRound,
  ShieldAlert,
  Coins,
  Trophy,
  Clock,
} from 'lucide-react';
import { CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '@/domain/board-config';

export const RulesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'civic' | 'market' | 'bankruptcy'>('overview');

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 pb-20">
        {/* Header Banner */}
      <div className="bg-gradient-to-r from-indian-terracotta-600 via-amber-700 to-stone-900 rounded-2xl p-6 text-white shadow-lg border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-widest">
            <BookOpen className="w-4 h-4" />
            <span>Official Rulebook</span>
          </div>
          <h1 className="font-serif font-black text-2xl sm:text-3xl text-white mt-1">
            Indian Monopoly Rules & Guide
          </h1>
          <p className="text-amber-100/90 text-sm max-w-xl mt-1">
            Complete rulebook covering property acquisition, 12 Civic Fund rules, 12 Market Buzz cards, jail regulations, mortgage mechanics, and bankruptcy victory conditions.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm p-2 rounded-xl border border-white/10 shrink-0">
          <Trophy className="w-8 h-8 text-amber-400" />
          <div className="text-xs">
            <span className="font-black text-white block">Victory Rule</span>
            <span className="text-amber-200">Last Solvent Tycoon Wins</span>
          </div>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-indian-terracotta-500 text-white shadow-md'
              : 'bg-white dark:bg-indian-navy-800 text-indian-navy-700 dark:text-indian-parchment-200 hover:bg-indian-parchment-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Core Game Flow</span>
        </button>

        <button
          onClick={() => setActiveTab('civic')}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'civic'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-white dark:bg-indian-navy-800 text-indian-navy-700 dark:text-indian-parchment-200 hover:bg-indian-parchment-200'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Civic Fund (12 Rules)</span>
        </button>

        <button
          onClick={() => setActiveTab('market')}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'market'
              ? 'bg-teal-700 text-white shadow-md'
              : 'bg-white dark:bg-indian-navy-800 text-indian-navy-700 dark:text-indian-parchment-200 hover:bg-indian-parchment-200'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Market Buzz (12 Rules)</span>
        </button>

        <button
          onClick={() => setActiveTab('bankruptcy')}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'bankruptcy'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white dark:bg-indian-navy-800 text-indian-navy-700 dark:text-indian-parchment-200 hover:bg-indian-parchment-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Bankruptcy & Jail</span>
        </button>
      </div>

      {/* Tab 1: Core Game Flow */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card: Starting Cash & Board Layout */}
          <div className="bg-white dark:bg-indian-navy-900 p-5 rounded-2xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-indian-terracotta-600 dark:text-indian-terracotta-400">
              <Coins className="w-5 h-5" />
              <h3 className="font-serif font-black text-base">Capital & Board Setup</h3>
            </div>
            <ul className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside">
              <li><strong>Starting Capital:</strong> Every player receives ₹15,000 cash from the Reserve Bank upon game start.</li>
              <li><strong>START Salary:</strong> Passing or landing on START yields ₹2,000 in salary.</li>
              <li><strong>40 Spaces:</strong> 24 premier Indian cities, 4 Transit hubs (CST Mumbai, Howrah, Chennai & Delhi Airports), 2 Utilities (Urja Grid, Jal Board), Taxes, Civic Fund, Market Buzz, and Rest/Jail.</li>
              <li><strong>Sides:</strong> Symmetrically arranged with 6 major cities and civic/market squares per perimeter side.</li>
            </ul>
          </div>

          {/* Card: Buying & Development Rules */}
          <div className="bg-white dark:bg-indian-navy-900 p-5 rounded-2xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Building2 className="w-5 h-5" />
              <h3 className="font-serif font-black text-base">Acquisition & Building Rules</h3>
            </div>
            <ul className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside">
              <li><strong>Buying Deeds:</strong> Landing on an unowned city prompts a pointed action box to purchase the deed for the listed price.</li>
              <li><strong>Subsequent Turn Rule:</strong> A player cannot build a house on the same turn they purchase a city. Building is allowed only on subsequent rounds when the owner visits their city again.</li>
              <li><strong>Development Progression:</strong> Construct up to 4 Residential Blocks, then upgrade to a prestigious Skyscraper Commercial Tower.</li>
              <li><strong>Deed Grids:</strong> Owned cities show the owner token and any built houses/towers directly on the grid tile.</li>
            </ul>
          </div>

          {/* Card: Transit & Utilities */}
          <div className="bg-white dark:bg-indian-navy-900 p-5 rounded-2xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Train className="w-5 h-5" />
              <h3 className="font-serif font-black text-base">Transits & Public Utilities</h3>
            </div>
            <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <p><strong>Transit Rent:</strong> Rent scales dynamically based on how many transits the owner holds:</p>
              <div className="grid grid-cols-4 gap-1 text-center font-mono font-bold text-xs bg-indian-parchment-100 dark:bg-indian-navy-800 p-2 rounded-lg">
                <div>1: ₹250</div>
                <div>2: ₹500</div>
                <div>3: ₹1,000</div>
                <div>4: ₹2,000</div>
              </div>
              <p><strong>Utilities:</strong> Rent is determined by rolling dice: 4× dice roll if 1 utility owned, or 10× dice roll if both Urja Grid and Jal Board are owned.</p>
            </div>
          </div>

          {/* Card: Turn Clock & Acknowledgments */}
          <div className="bg-white dark:bg-indian-navy-900 p-5 rounded-2xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
              <h3 className="font-serif font-black text-base">Turn Timer & Notifications</h3>
            </div>
            <ul className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside">
              <li><strong>Authoritative Timer:</strong> Turns have a 30-second live countdown displayed across player badges and popup dialogs.</li>
              <li><strong>Transaction & Card Notices:</strong> Any rent, tax, reward receipt, or card rule event generates a smooth floating notification in the bottom-left corner with a 3-second auto-dismiss and manual acknowledge button.</li>
              <li><strong>Non-Blocking Gameplay:</strong> Notifications appear in the bottom-left corner with zero screen-blocking dialogs, allowing uninterrupted game flow.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Civic Fund (12 Rules) */}
      {activeTab === 'civic' && (
        <div className="bg-white dark:bg-indian-navy-900 p-5 rounded-2xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-indian-parchment-300 dark:border-indian-navy-700 pb-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Gift className="w-6 h-6 text-amber-600" />
              <div>
                <h3 className="font-serif font-black text-lg">Civic Fund — 12 Official Rules</h3>
                <span className="text-xs text-gray-500">The total rolled on the two dice determines the active rule index</span>
              </div>
            </div>
            <span className="text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full border border-amber-300">
              Community Treasury
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CIVIC_FUND_CARDS.map((card, idx) => (
              <div
                key={card.id}
                className="p-3 rounded-xl bg-gradient-to-br from-amber-50/50 via-white to-amber-100/30 dark:from-indian-navy-850 dark:to-indian-navy-950 border border-amber-300/60 shadow-2xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 rounded-full bg-amber-700 text-white text-[10px] font-black flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {card.amount && (
                    <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                      ₹{card.amount.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <h4 className="font-serif font-black text-xs text-indian-navy-900 dark:text-amber-100">
                  {card.title}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Market Buzz (12 Rules) */}
      {activeTab === 'market' && (
        <div className="bg-white dark:bg-indian-navy-900 p-5 rounded-2xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-indian-parchment-300 dark:border-indian-navy-700 pb-3">
            <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
              <Flame className="w-6 h-6 text-teal-600" />
              <div>
                <h3 className="font-serif font-black text-lg">Market Buzz — 12 Official Rules</h3>
                <span className="text-xs text-gray-500">Triggered dynamically via dice sum upon landing on Market Buzz</span>
              </div>
            </div>
            <span className="text-xs font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 px-3 py-1 rounded-full border border-teal-300">
              Fortune & Chance
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MARKET_BUZZ_CARDS.map((card, idx) => (
              <div
                key={card.id}
                className="p-3 rounded-xl bg-gradient-to-br from-teal-50/50 via-white to-teal-100/30 dark:from-indian-navy-850 dark:to-indian-navy-950 border border-teal-300/60 shadow-2xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 rounded-full bg-teal-700 text-white text-[10px] font-black flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {card.amount && (
                    <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                      ₹{card.amount.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <h4 className="font-serif font-black text-xs text-indian-navy-900 dark:text-teal-100">
                  {card.title}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Bankruptcy & Special Jail Rules */}
      {activeTab === 'bankruptcy' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strict Bankruptcy Rules */}
          <div className="bg-white dark:bg-indian-navy-900 p-5 rounded-2xl border border-red-300 dark:border-red-900/60 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-serif font-black text-base">Complete Bankruptcy Invariant</h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Under official tournament rules, the game ends when a player is <strong>completely bankrupt</strong>:
            </p>
            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/80 text-xs text-red-900 dark:text-red-200 space-y-2">
              <p>
                <strong>1. Trigger Condition:</strong> A player’s cash balance reaches <strong>₹0</strong> AND they have <strong>no unmortgaged properties</strong> remaining to raise capital.
              </p>
              <p>
                <strong>2. Liquidation:</strong> All remaining property deeds held by the bankrupt player are forfeited back to the Reserve Bank.
              </p>
              <p>
                <strong>3. Victory:</strong> When only one solvent player remains in the game, the match concludes instantly with full victory honor!
              </p>
            </div>
          </div>

          {/* Special Jail Regulations */}
          <div className="bg-white dark:bg-indian-navy-900 p-5 rounded-2xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <KeyRound className="w-5 h-5" />
              <h3 className="font-serif font-black text-base">Central Jail Regulations</h3>
            </div>
            <ul className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside">
              <li><strong>Zero Income While Incarcerated:</strong> In strict accordance with the updated rules, a player currently in Jail <strong>CANNOT earn rent</strong> from other players landing on their cities, nor collect cash awards from player contributions.</li>
              <li><strong>Ways to Exit Jail:</strong>
                <ul className="list-circle list-inside ml-4 mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <li>Pay ₹500 statutory bail to the Bank on your turn.</li>
                  <li>Roll doubles on any of your 3 turn attempts.</li>
                  <li>Redeem a &quot;Special Legal Exemption&quot; Get Out of Jail Free card.</li>
                </ul>
              </li>
              <li><strong>Visiting Status:</strong> Landing on the Jail space normally through dice roll is treated as standard &quot;Just Visiting&quot; with no penalty.</li>
            </ul>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

