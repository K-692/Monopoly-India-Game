import React, { useState, useEffect } from 'react';
import {
  X,
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

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'civic' | 'market' | 'bankruptcy'>('overview');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-indian-parchment-100 dark:bg-indian-navy-900 border border-indian-parchment-300 dark:border-indian-navy-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indian-terracotta-600 via-amber-700 to-stone-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 id="rules-modal-title" className="font-serif font-black text-lg sm:text-xl text-white leading-tight">
                Official Rulebook & Strategy Guide
              </h2>
              <p className="text-xs text-amber-200/90 hidden sm:block">
                All 40 spaces, 12 Civic Fund rules, 12 Market Buzz cards, and tournament invariants.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Rules"
            className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/40 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Bar (Grid on Mobile, Flex on Desktop) */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 px-3 sm:px-4 py-2 bg-white/70 dark:bg-indian-navy-950/70 border-b border-indian-parchment-300 dark:border-indian-navy-800 shrink-0 select-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-indian-terracotta-500 text-white shadow-xs'
                : 'text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 dark:hover:bg-indian-navy-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>Core Game Flow</span>
          </button>

          <button
            onClick={() => setActiveTab('civic')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'civic'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 dark:hover:bg-indian-navy-800'
            }`}
          >
            <Gift className="w-3.5 h-3.5 shrink-0" />
            <span>Civic Fund (12 Rules)</span>
          </button>

          <button
            onClick={() => setActiveTab('market')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'market'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 dark:hover:bg-indian-navy-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span>Market Buzz (12 Rules)</span>
          </button>

          <button
            onClick={() => setActiveTab('bankruptcy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'bankruptcy'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 dark:hover:bg-indian-navy-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Bankruptcy & Jail</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {/* Tab 1: Core Game Flow */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-indian-terracotta-600 dark:text-indian-terracotta-400">
                  <Coins className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Capital & Board Setup</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Starting Capital:</strong> Every player receives ₹15,000 cash from the Reserve Bank upon game start.</li>
                  <li><strong>START Salary:</strong> Passing or landing on START yields ₹2,000 in salary.</li>
                  <li><strong>40 Spaces:</strong> 24 Indian cities (6 per side), 4 Transit hubs (CST Mumbai, Howrah, Chennai & IGI Delhi), 2 Utilities (Urja Grid, Jal Board), Taxes, Civic Fund, Market Buzz, and Rest/Jail.</li>
                </ul>
              </div>

              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Building2 className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Acquisition & Building Rules</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Buying Deeds:</strong> Landing on an unowned city prompts a purchase decision for the listed price.</li>
                  <li><strong>Subsequent Turn Rule:</strong> A player cannot build a house on the same turn they purchase a city. Building is allowed only on subsequent rounds when the owner visits again.</li>
                  <li><strong>Progression:</strong> Up to 4 Residential Blocks, then upgrade to a Commercial Tower.</li>
                </ul>
              </div>

              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Train className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Transits & Public Utilities</h3>
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-300 space-y-2">
                  <p><strong>Transit Rent:</strong> Rent scales dynamically based on total transit hubs owned:</p>
                  <div className="grid grid-cols-4 gap-1 text-center font-mono font-bold text-xs bg-indian-parchment-200 dark:bg-indian-navy-800 p-2 rounded-lg">
                    <div>1: ₹250</div>
                    <div>2: ₹500</div>
                    <div>3: ₹1,000</div>
                    <div>4: ₹2,000</div>
                  </div>
                  <p><strong>Utilities:</strong> 4× dice roll if 1 utility owned; 10× dice roll if both Urja Grid and Jal Board are owned.</p>
                </div>
              </div>

              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Turn Timer & Tournament Victory</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Authoritative Timer:</strong> 30-second live countdown per turn with automatic turn resolution upon expiration.</li>
                  <li><strong>Victory Condition:</strong> Last solvent tycoon with cash or unmortgaged assets wins the match.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 2: Civic Fund (12 Rules) */}
          {activeTab === 'civic' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-indian-parchment-300 dark:border-indian-navy-700 pb-2">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  The dice roll total determines the active rule index (1 to 12):
                </span>
                <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300">
                  Community Treasury
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {CIVIC_FUND_CARDS.map((card, idx) => (
                  <div
                    key={card.id}
                    className="p-3 rounded-xl bg-white dark:bg-indian-navy-850 border border-amber-300/60 shadow-2xs space-y-1"
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
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-indian-parchment-300 dark:border-indian-navy-700 pb-2">
                <span className="text-xs font-bold text-teal-800 dark:text-teal-300">
                  Triggered dynamically via dice sum upon landing on Market Buzz:
                </span>
                <span className="text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded-full border border-teal-300">
                  Fortune & Chance
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {MARKET_BUZZ_CARDS.map((card, idx) => (
                  <div
                    key={card.id}
                    className="p-3 rounded-xl bg-white dark:bg-indian-navy-850 border border-teal-300/60 shadow-2xs space-y-1"
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

          {/* Tab 4: Bankruptcy & Jail */}
          {activeTab === 'bankruptcy' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-red-300 dark:border-red-900/60 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Complete Bankruptcy Invariant</h3>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900/80 text-xs text-red-900 dark:text-red-200 space-y-1.5">
                  <p><strong>1. Trigger:</strong> Cash balance reaches ₹0 AND player has no unmortgaged properties remaining.</p>
                  <p><strong>2. Liquidation:</strong> All remaining deeds are forfeited to the Reserve Bank.</p>
                  <p><strong>3. Victory:</strong> The sole remaining solvent player is declared victor.</p>
                </div>
              </div>

              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <KeyRound className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Central Jail Regulations</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Zero Income in Jail:</strong> Players in Jail <strong>CANNOT earn rent</strong> or cash awards.</li>
                  <li><strong>Exit Options:</strong> Pay ₹500 statutory bail, roll doubles on your turn, or redeem a Get Out of Jail Free card.</li>
                  <li><strong>Just Visiting:</strong> Normal movement landing on Jail incurs zero penalty.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white dark:bg-indian-navy-950 border-t border-indian-parchment-300 dark:border-indian-navy-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Tournament Rules Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indian-terracotta-500 hover:bg-indian-terracotta-600 text-white transition-colors cursor-pointer"
          >
            Close Rules
          </button>
        </div>
      </div>
    </div>
  );
};
