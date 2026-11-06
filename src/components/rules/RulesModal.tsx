import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Building2,
  Plane,
  Gift,
  Flame,
  KeyRound,
  ShieldAlert,
  Coins,
  Trophy,
  Clock,
  History,
  Landmark,
} from 'lucide-react';
import { CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS } from '@/domain/board-config';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'civic' | 'market' | 'mortgage' | 'jail'>('overview');

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
                Authoritative rules for Jail bail, Sell to Bank, Airport rents, and Financial Resolution.
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

        {/* Tab Navigation Bar */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 px-3 sm:px-4 py-2 bg-white/70 dark:bg-indian-navy-950/70 border-b border-indian-parchment-300 dark:border-indian-navy-800 shrink-0 select-none overflow-x-auto">
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
            onClick={() => setActiveTab('jail')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'jail'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 dark:hover:bg-indian-navy-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span>Jail & Try Double</span>
          </button>

          <button
            onClick={() => setActiveTab('mortgage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'mortgage'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200 dark:hover:bg-indian-navy-800'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 shrink-0" />
            <span>Sell to Bank & Surrender</span>
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
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {/* Tab 1: Core Game Flow */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-indian-terracotta-600 dark:text-indian-terracotta-400">
                  <Coins className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Capital & Balance Rules</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Starting Capital:</strong> Every player receives ₹20,000 cash from the Reserve Bank.</li>
                  <li><strong>START Reward:</strong> Passing or landing on START yields ₹3,000 immediately upon crossing.</li>
                  <li><strong>Single Roll Invariant:</strong> If a player rolls doubles (e.g. 2,2 or 6,6), they do <strong>not</strong> receive an extra turn. Only one roll is allowed per turn.</li>
                  <li><strong>Balance Validation:</strong> If a player lands on an unowned city with insufficient funds, the purchase popup is hidden and an &quot;Insufficient balance to purchase this property&quot; notification is shown.</li>
                  <li><strong>Construction Validation:</strong> If funds are insufficient to build, the confirmation popup is hidden and &quot;Insufficient balance to build on this property&quot; is shown.</li>
                </ul>
              </div>

              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Plane className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Transit & Airport Visiting Charges</h3>
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-300 space-y-2">
                  <p><strong>Airport Rent (Distinct & Higher):</strong> Visiting players landing on an airport owned by another player pay higher rent:</p>
                  <div className="grid grid-cols-2 gap-2 text-center font-mono font-bold text-xs bg-indian-parchment-200 dark:bg-indian-navy-800 p-2 rounded-lg">
                    <div>1 Airport: ₹1,000</div>
                    <div>2 Airports: ₹2,500</div>
                  </div>
                  <p><strong>Railway Rent:</strong> CST Mumbai & Howrah Station:</p>
                  <div className="grid grid-cols-2 gap-2 text-center font-mono font-bold text-xs bg-indian-parchment-200 dark:bg-indian-navy-800 p-2 rounded-lg">
                    <div>1 Railway: ₹250</div>
                    <div>2 Railways: ₹500</div>
                  </div>
                  <p className="text-[11px] text-gray-500">Rent is waived if the owner is in jail, property is mortgaged, or owner is disqualified.</p>
                </div>
              </div>

              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Building2 className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Acquisition & Building Rules</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Single-Line City Displays:</strong> City names appear on a single line without prices cluttering board tiles.</li>
                  <li><strong>Subsequent Turn Rule:</strong> Construction is allowed starting from the next round when visiting your property.</li>
                  <li><strong>Development Progression:</strong> Up to 4 Houses, then upgraded to a Commercial Tower.</li>
                </ul>
              </div>

              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <History className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Transaction Ledger & Notifications</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Non-Blocking Toasts:</strong> Floating notifications appear in the bottom-left corner with auto-dismiss after 3 seconds. No manual acknowledge clicks needed.</li>
                  <li><strong>Ledger History:</strong> Full financial history with credits, debits, counterparties, and timestamps accessible in Player Profile.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 2: Jail & Try Double */}
          {activeTab === 'jail' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-red-300 dark:border-red-900/60 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <KeyRound className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Try Double Mechanics</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                  <li><strong>Attempts 1, 2, and 3:</strong> A jailed player can attempt to roll doubles on each of their first three eligible turns.</li>
                  <li><strong>Successful Double:</strong> Rolling doubles releases the player immediately and advances the pawn by the dice roll.</li>
                  <li><strong>No Extra Turn on Escape:</strong> Rolling doubles to escape jail <strong>never grants an additional turn</strong>. The escape roll is strictly the movement for that turn.</li>
                  <li><strong>Failed Attempt:</strong> If non-doubles are rolled, the player remains in jail and <strong>does not move</strong>. Turn ends immediately.</li>
                </ul>
              </div>

              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-amber-300 dark:border-amber-900/60 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Automatic 4th Turn Release</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                  <li><strong>Automatic Freedom:</strong> If a player fails all 3 double attempts, they are <strong>automatically released on their 4th eligible turn</strong> without needing to roll Try Double.</li>
                  <li><strong>Seamless Progression:</strong> The player is released at turn start and proceeds to roll normally.</li>
                  <li><strong>Alternative Options:</strong> At any eligible jail turn, a player may use an available Bail Key, pay standard statutory bail (₹500), or attempt to roll doubles.</li>
                  <li><strong>Zero Income in Jail:</strong> Players in Jail cannot collect rent or cash rewards.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 3: Sell to Bank & Surrender */}
          {activeTab === 'mortgage' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-blue-300 dark:border-blue-900/60 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Landmark className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Sell to Bank Mechanics</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                  <li><strong>Payout Formula:</strong> The bank pays 50% of the property purchase price plus 50% of any building expenditures.</li>
                  <li><strong>Ownership Removed Immediately:</strong> The selling player loses ownership instantly; the property becomes unowned and available in the bank.</li>
                  <li><strong>Buildings Preserved:</strong> Houses and Commercial Towers remain intact on the city and are not demolished or refunded.</li>
                  <li><strong>Acquisition by Any Player:</strong> Any player who subsequently lands on the property can acquire it for the <strong>exact payout amount</strong> the bank previously paid. Built houses are inherited!</li>
                  <li><strong>No Rent in Bank:</strong> Until reacquired by a player, the property generates zero rent.</li>
                </ul>
              </div>

              <div className="bg-white dark:bg-indian-navy-850 p-4 rounded-xl border border-red-300 dark:border-red-900/60 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-4 h-4" />
                  <h3 className="font-serif font-black text-sm">Financial Resolution & Immediate Game Over</h3>
                </div>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                  <li><strong>120-Second Resolution Timer:</strong> When debt exceeds cash, a 120-second pause window begins. The timer is managed by the server and persists across views and reconnections.</li>
                  <li><strong>Sell to Bank to Settle:</strong> Players can sell eligible properties to the bank to raise cash and pay obligations.</li>
                  <li><strong>Immediate Match Termination:</strong> If a player surrenders or the 120-second timer expires (disqualification), the game ends immediately!</li>
                  <li><strong>Winner Determination:</strong> The match winner is decided among the remaining eligible players by highest cash balance (tie-broken by net worth).</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 4: Civic Fund (12 Rules) */}
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

          {/* Tab 5: Market Buzz (12 Rules) */}
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
