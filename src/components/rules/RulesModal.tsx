import React, { useState, useEffect, useMemo } from 'react';
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
  Hammer,
  RotateCcw,
} from 'lucide-react';
import {
  GAME_RULES_SECTIONS,
  RULES_CATEGORIES,
  BUILDINGS_RULE_SECTION,
  RuleSection,
  RuleSectionItem,
} from '@/domain/game-rules-guide';
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
    case 'Hammer':
      return <Hammer className={className} />;
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
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
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

  // Determine sections matching current category filter
  const categorySections: RuleSection[] = useMemo(() => {
    if (activeCategoryId === 'all') {
      return GAME_RULES_SECTIONS;
    }

    if (activeCategoryId === 'buildings') {
      return [BUILDINGS_RULE_SECTION];
    }

    const cat = RULES_CATEGORIES.find((c) => c.id === activeCategoryId);
    if (!cat) return GAME_RULES_SECTIONS;

    return GAME_RULES_SECTIONS.filter((sec) => cat.sectionIds.includes(sec.id));
  }, [activeCategoryId]);

  // Filter sections by search query if present across all rule content
  const displayedSections: RuleSection[] = useMemo(() => {
    if (!searchQuery.trim()) {
      return categorySections;
    }
    const q = searchQuery.toLowerCase();
    const allCandidateSections: RuleSection[] = [
      ...GAME_RULES_SECTIONS,
      BUILDINGS_RULE_SECTION,
    ];
    return allCandidateSections.filter((section: RuleSection) => {
      const matchesTitle = section.title.toLowerCase().includes(q);
      const matchesSummary = section.summary.toLowerCase().includes(q);
      const matchesPoints = section.items.some(
        (item: RuleSectionItem) =>
          item.subtitle.toLowerCase().includes(q) ||
          item.points.some((p: string) => p.toLowerCase().includes(q))
      );
      return matchesTitle || matchesSummary || matchesPoints;
    });
  }, [categorySections, searchQuery]);

  const activeCategory = useMemo(() => {
    if (activeCategoryId === 'all') return null;
    return RULES_CATEGORIES.find((c) => c.id === activeCategoryId) || null;
  }, [activeCategoryId]);

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
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[92vh] flex flex-col bg-indian-parchment-100 dark:bg-indian-navy-900 border border-indian-parchment-300 dark:border-indian-navy-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
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
                Structured reference guide: Net Worth victory, turn pacing, property tariffs, building developments & debt resolution.
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

        {/* Mobile / Small Screen Horizontally Scrollable Category Bar */}
        <div
          data-testid="rules-mobile-navigation"
          className="md:hidden px-3 py-2 bg-white/80 dark:bg-indian-navy-950/80 border-b border-indian-parchment-300 dark:border-indian-navy-800 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              setActiveCategoryId('all');
              setSearchQuery('');
            }}
            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
              activeCategoryId === 'all' && !searchQuery
                ? 'bg-indian-terracotta-500 text-white shadow-xs'
                : 'bg-indian-parchment-200 dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-300'
            }`}
          >
            All 12 Sections
          </button>
          {RULES_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategoryId(cat.id);
                setSearchQuery('');
              }}
              className={`px-2.5 py-1 rounded-lg font-medium shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeCategoryId === cat.id && !searchQuery
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'bg-indian-parchment-200 dark:bg-indian-navy-800 text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-300'
              }`}
            >
              {renderSectionIcon(cat.icon, 'w-3 h-3')}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Main Body with Desktop Sidebar Navigation + Content Pane */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Desktop Compact Side Navigation */}
          <div
            data-testid="rules-desktop-navigation"
            className="w-56 shrink-0 border-r border-indian-parchment-300 dark:border-indian-navy-800 bg-white/60 dark:bg-indian-navy-950/60 p-2.5 hidden md:flex flex-col justify-between overflow-y-auto custom-scrollbar"
          >
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Rule Categories
              </div>
              <button
                type="button"
                data-testid="nav-cat-all"
                onClick={() => {
                  setActiveCategoryId('all');
                  setSearchQuery('');
                }}
                className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeCategoryId === 'all' && !searchQuery
                    ? 'bg-indian-terracotta-500 text-white shadow-xs font-black'
                    : 'text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200/80 dark:hover:bg-indian-navy-800'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>All 12 Sections</span>
              </button>

              {RULES_CATEGORIES.map((cat, idx) => {
                const isActive = activeCategoryId === cat.id && !searchQuery;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`nav-cat-${cat.id}`}
                    onClick={() => {
                      setActiveCategoryId(cat.id);
                      setSearchQuery('');
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-xs font-bold'
                        : 'text-indian-navy-800 dark:text-indian-parchment-200 hover:bg-indian-parchment-200/80 dark:hover:bg-indian-navy-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0">{renderSectionIcon(cat.icon, 'w-3.5 h-3.5')}</span>
                      <span className="truncate">{cat.name}</span>
                    </div>
                    <span className="text-[10px] opacity-70 font-mono">0{idx + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Return to Overview Button */}
            <div className="pt-2 border-t border-indian-parchment-300 dark:border-indian-navy-800">
              <button
                type="button"
                data-testid="return-to-overview-btn"
                onClick={() => {
                  setActiveCategoryId('overview');
                  setSearchQuery('');
                }}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Return to Overview</span>
              </button>
            </div>
          </div>

          {/* Right Content Pane */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            {/* Search and Category Breadcrumb Header */}
            <div className="px-3 sm:px-5 py-2.5 bg-white/80 dark:bg-indian-navy-950/80 border-b border-indian-parchment-300 dark:border-indian-navy-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0 flex items-center gap-2">
                {activeCategory ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
                      {renderSectionIcon(activeCategory.icon, 'w-3.5 h-3.5')}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-indian-navy-900 dark:text-white truncate">
                        {activeCategory.name}
                      </h3>
                      <p className="text-[10.5px] text-gray-500 dark:text-gray-400 hidden sm:block truncate">
                        {activeCategory.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-indian-navy-900 dark:text-white truncate">
                    Showing All Rules
                  </div>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative shrink-0 w-44 sm:w-60">
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

            {/* Rules Content List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 custom-scrollbar">
              {displayedSections.length === 0 ? (
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
                displayedSections.map((section) => (
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
          </div>
        </div>

        {/* Modal Footer */}
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
