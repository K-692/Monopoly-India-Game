import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Trophy,
  Sliders,
  PlayCircle,
  Coins,
  Building2,
  Flame,
  ShieldAlert,
  Landmark,
  AlertTriangle,
  Crown,
  Users,
  CheckCircle2,
  ChevronRight,
  Search,
  Keyboard,
} from 'lucide-react';
import { GAME_RULES_SECTIONS } from '@/domain/game-rules-guide';
import { CIVIC_FUND_CARDS, MARKET_BUZZ_CARDS, getCardFinancialEffect } from '@/domain/board-config';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icon mapper helper
const renderSectionIcon = (iconName: string, className = 'w-4 h-4') => {
  switch (iconName) {
    case 'Keyboard':
      return <Keyboard className={className} />;
    case 'Trophy':
      return <Trophy className={className} />;
    case 'Sliders':
      return <Sliders className={className} />;
    case 'PlayCircle':
      return <PlayCircle className={className} />;
    case 'Coins':
      return <Coins className={className} />;
    case 'Building2':
      return <Building2 className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'ShieldAlert':
      return <ShieldAlert className={className} />;
    case 'Landmark':
      return <Landmark className={className} />;
    case 'AlertTriangle':
      return <AlertTriangle className={className} />;
    case 'Crown':
      return <Crown className={className} />;
    case 'Users':
      return <Users className={className} />;
    default:
      return <BookOpen className={className} />;
  }
};

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeSectionId, setActiveSectionId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cardDeckTab, setCardDeckTab] = useState<'civic' | 'market'>('civic');

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

  // Filter sections by search query
  const filteredSections = GAME_RULES_SECTIONS.filter((section) => {
    if (!searchQuery.trim()) {
      if (activeSectionId === 'all') return true;
      return section.id === activeSectionId;
    }
    const q = searchQuery.toLowerCase();
    const matchesTitle = section.title.toLowerCase().includes(q);
    const matchesSummary = section.summary.toLowerCase().includes(q);
    const matchesPoints = section.items.some((item) =>
      item.subtitle.toLowerCase().includes(q) ||
      item.points.some((p) => p.toLowerCase().includes(q))
    );
    return matchesTitle || matchesSummary || matchesPoints;
  });

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
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[92vh] flex flex-col bg-indian-parchment-100 dark:bg-indian-navy-900 border border-indian-parchment-300 dark:border-indian-navy-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-indian-terracotta-600 via-amber-700 to-stone-900 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="rules-modal-title" className="font-serif font-black text-base sm:text-lg text-white leading-tight truncate">
                Official Rulebook & Strategy Reference
              </h2>
              <p className="text-[11px] text-amber-200/90 hidden sm:block truncate">
                Authoritative 11-section ruleset: Net Worth victory, turn pacing, property tariffs & debt resolution.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Rules"
            className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/40 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Quick Navigation Bar */}
        <div className="px-3 sm:px-5 py-2.5 bg-white/80 dark:bg-indian-navy-950/80 border-b border-indian-parchment-300 dark:border-indian-navy-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          {/* Section Pills (Scrollable horizontally) */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveSectionId('all');
                setSearchQuery('');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                activeSectionId === 'all' && !searchQuery
                  ? 'bg-indian-terracotta-500 text-white shadow-xs'
                  : 'bg-indian-parchment-200 dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-300'
              }`}
            >
              All 11 Sections
            </button>
            {GAME_RULES_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setActiveSectionId(sec.id);
                  setSearchQuery('');
                }}
                className={`px-2 py-1 rounded-lg font-medium shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
                  activeSectionId === sec.id && !searchQuery
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'bg-indian-parchment-200 dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-300'
                }`}
              >
                <span>{sec.number}.</span>
                <span>{sec.title}</span>
              </button>
            ))}
          </div>

          {/* Quick Filter Search */}
          <div className="relative shrink-0 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 rounded-lg text-xs bg-indian-parchment-100 dark:bg-indian-navy-900 border border-indian-parchment-300 dark:border-indian-navy-700 text-indian-navy-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 custom-scrollbar">
          {filteredSections.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm font-semibold">No rules matched your search &quot;{searchQuery}&quot;</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs font-bold text-amber-600 hover:underline cursor-pointer"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            filteredSections.map((section) => (
              <div
                key={section.id}
                id={`rule-section-${section.id}`}
                className="bg-white dark:bg-indian-navy-850 rounded-xl border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs overflow-hidden transition-all"
              >
                {/* Section Header Card */}
                <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50/40 dark:from-indian-navy-800 dark:to-indian-navy-850 border-b border-indian-parchment-200 dark:border-indian-navy-700/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-300/40">
                      {renderSectionIcon(section.icon, 'w-3.5 h-3.5')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                          § {section.number}
                        </span>
                        <h3 className="font-serif font-black text-sm sm:text-base text-indian-navy-900 dark:text-white">
                          {section.title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                        {section.summary}
                      </p>
                    </div>
                  </div>
                  {section.badge && (
                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800 shrink-0">
                      {section.badge}
                    </span>
                  )}
                </div>

                {/* Section Content Items */}
                <div className="p-4 space-y-3.5 text-xs text-gray-700 dark:text-gray-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {section.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-indian-parchment-50/60 dark:bg-indian-navy-900/60 border border-indian-parchment-200 dark:border-indian-navy-800 space-y-1.5"
                      >
                        <h4 className="font-bold text-xs text-indian-navy-900 dark:text-amber-200 flex items-center gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{item.subtitle}</span>
                        </h4>
                        <ul className="space-y-1 pl-4 list-disc text-[11.5px] leading-relaxed">
                          {item.points.map((pt, pIdx) => (
                            <li key={pIdx}>{pt}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Special Interactive Decks Subview for Section 6 (Cards & Events) */}
                  {section.id === 'cards-events' && (
                    <div className="mt-3 pt-3 border-t border-indian-parchment-200 dark:border-indian-navy-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Complete 24-Card Reference Index:
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCardDeckTab('civic')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              cardDeckTab === 'civic'
                                ? 'bg-amber-600 text-white'
                                : 'bg-gray-100 dark:bg-indian-navy-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            Civic Fund ({CIVIC_FUND_CARDS.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setCardDeckTab('market')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              cardDeckTab === 'market'
                                ? 'bg-teal-700 text-white'
                                : 'bg-gray-100 dark:bg-indian-navy-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            Market Buzz ({MARKET_BUZZ_CARDS.length})
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {(cardDeckTab === 'civic' ? CIVIC_FUND_CARDS : MARKET_BUZZ_CARDS).map((card, idx) => {
                          const isFestivalTravel = card.id === 'mb_fest_travel';
                          return (
                            <div
                              key={card.id}
                              className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                                isFestivalTravel
                                  ? 'bg-amber-100/80 dark:bg-amber-950/50 border-amber-500 ring-1 ring-amber-400'
                                  : 'bg-white dark:bg-indian-navy-900 border-indian-parchment-200 dark:border-indian-navy-800'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="w-4 h-4 rounded-full bg-stone-700 text-white text-[9px] font-bold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                {card.amount && card.actionType !== 'MOVE_RELATIVE' && (() => {
                                  const effect = getCardFinancialEffect(card);
                                  if (effect === 'LOSS') {
                                    return (
                                      <span className="font-mono font-bold text-[10px] text-red-600 dark:text-red-400">
                                        - ₹{Math.abs(card.amount).toLocaleString('en-IN')}
                                      </span>
                                    );
                                  }
                                  if (effect === 'GAIN') {
                                    return (
                                      <span className="font-mono font-bold text-[10px] text-emerald-600 dark:text-emerald-400">
                                        + ₹{card.amount.toLocaleString('en-IN')}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="font-mono font-bold text-[10px] text-stone-600 dark:text-stone-300">
                                      ₹{card.amount.toLocaleString('en-IN')}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="font-bold text-[11px] text-indian-navy-900 dark:text-white">
                                {card.title}
                              </div>
                              <p className="text-[10.5px] text-gray-600 dark:text-gray-300 leading-tight">
                                {card.description}
                              </p>
                              {isFestivalTravel && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-600 text-white">
                                  Go to START & Collect Salary
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2.5 bg-white dark:bg-indian-navy-950 border-t border-indian-parchment-300 dark:border-indian-navy-800 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[11px]">Server-Authoritative Rules Active</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-bold bg-indian-terracotta-500 hover:bg-indian-terracotta-600 text-white shadow-2xs transition-colors cursor-pointer text-xs"
          >
            Close Rules
          </button>
        </div>
      </div>
    </div>
  );
};
