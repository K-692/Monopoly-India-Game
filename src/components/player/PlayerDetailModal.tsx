import React from 'react';
import { createPortal } from 'react-dom';
import { PlayerState, PropertyState } from '@/domain/game-types';
import { BOARD_SPACES } from '@/domain/board-config';
import { X, Wallet, TrendingUp, MapPin, ShieldAlert, Home, Building2, Landmark, Train, Plane, Zap, Droplets } from 'lucide-react';
import { calculateRent } from '@/domain/ruleset';
import { PopupTurnTimer } from '@/components/feedback/PopupTurnTimer';
import { getCityPriceColor } from '@/domain/city-colors';

interface PlayerDetailModalProps {
  player: PlayerState | null;
  properties: Record<number, PropertyState>;
  onClose: () => void;
  activePlayerName?: string;
  activePlayerColor?: string;
  turnTimeRemaining?: number;
  isMyTurn?: boolean;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  properties,
  onClose,
  activePlayerName,
  activePlayerColor,
  turnTimeRemaining = 30,
  isMyTurn = false,
}) => {
  if (!player) return null;

  const currentSpace = BOARD_SPACES[player.position];

  // Properties owned by this player
  const ownedProps = Object.entries(properties)
    .filter(([_, prop]) => prop.ownerUid === player.uid)
    .map(([idx, prop]) => {
      const spaceIdx = Number(idx);
      const space = BOARD_SPACES[spaceIdx];
      const rent = calculateRent(spaceIdx, properties, 7);
      return {
        spaceIndex: spaceIdx,
        space,
        state: prop,
        rent,
      };
    });

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm sm:max-w-md rounded-2xl bg-white dark:bg-indian-navy-900 border-2 border-indian-parchment-400 dark:border-indian-navy-700 shadow-2xl overflow-hidden flex flex-col animate-scale-in text-indian-navy-950 dark:text-white"
      >
        {/* Header Strip with Player Token Color */}
        <div
          style={{ backgroundColor: player.colorToken }}
          className="w-full h-3 sm:h-3.5 shrink-0"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-indian-parchment-200 dark:border-indian-navy-800">
          <div className="flex items-center gap-2.5">
            <div
              style={{ backgroundColor: player.colorToken }}
              className="w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white font-black text-sm shrink-0"
            >
              {player.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-serif font-black text-base sm:text-lg text-indian-navy-950 dark:text-white leading-tight">
                {player.displayName}
              </h3>
              <span className="text-[10px] text-gray-500 font-medium">
                Player Profile & Financial Statement
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PopupTurnTimer
              activePlayerName={activePlayerName}
              activePlayerColor={activePlayerColor}
              timeRemaining={turnTimeRemaining}
              isMyTurn={isMyTurn}
            />
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-indian-navy-800 dark:hover:bg-indian-navy-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-300 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 space-y-3 overflow-y-auto max-h-[70vh] custom-scrollbar text-xs">
          {/* Financial Overview Cards */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mb-0.5">
                <Wallet className="w-3.5 h-3.5" />
                <span>Liquid Cash</span>
              </div>
              <span className="font-black text-base sm:text-lg text-emerald-800 dark:text-emerald-300">
                ₹{player.cash.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-medium mb-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Total Net Worth</span>
              </div>
              <span className="font-black text-base sm:text-lg text-amber-800 dark:text-amber-300">
                ₹{player.netWorth.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Position and Status Details */}
          <div className="p-2.5 rounded-xl bg-indian-parchment-100 dark:bg-indian-navy-950/80 border border-indian-parchment-300 dark:border-indian-navy-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                <MapPin className="w-3.5 h-3.5 text-indian-terracotta-500" />
                <span>Current Board Space</span>
              </span>
              <span className="font-bold">
                #{player.position} {currentSpace?.name}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                <span>Jail Status</span>
              </span>
              {player.inJail ? (
                <span className="font-bold text-red-600 dark:text-red-400">
                  In Jail (Turn {player.jailTurns}/3)
                </span>
              ) : (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  Free to Move
                </span>
              )}
            </div>

            {player.jailFreeCards > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Get Out of Jail Cards</span>
                <span className="font-bold text-amber-600">
                  {player.jailFreeCards} card{player.jailFreeCards > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Owned Cities & Properties Portfolio */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Property Portfolio ({ownedProps.length})
              </h4>
            </div>

            {ownedProps.length === 0 ? (
              <div className="p-3 text-center rounded-xl bg-gray-50 dark:bg-indian-navy-950/50 border border-dashed border-gray-300 dark:border-gray-800 text-gray-400 text-xs">
                No cities or properties owned yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {ownedProps.map(({ spaceIndex, space, state, rent }) => {
                  const isCity = space.type === 'PROPERTY';
                  const isTransit = space.type === 'TRANSIT';
                  const isUtility = space.type === 'UTILITY';
                  const cityPrice = 'price' in space ? (space as { price: number }).price : 0;
                  const priceColor = isCity ? getCityPriceColor(cityPrice) : '#F97316';

                  return (
                    <div
                      key={spaceIndex}
                      className="p-2 rounded-xl bg-white dark:bg-indian-navy-950 border border-indian-parchment-300 dark:border-indian-navy-800 flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Dynamic Deed Icon with City Price Spectrum or Transit/Utility Theme */}
                        <div
                          style={{
                            borderColor: isCity ? priceColor : isTransit ? '#0284C7' : '#F59E0B',
                            backgroundColor: isCity ? `${priceColor}1A` : isTransit ? '#0284C71A' : '#F59E0B1A',
                            color: isCity ? priceColor : isTransit ? '#0284C7' : '#F59E0B',
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                        >
                          {isTransit ? (
                            space.name.toLowerCase().includes('airport') ? (
                              <Plane className="w-3.5 h-3.5" />
                            ) : (
                              <Train className="w-3.5 h-3.5" />
                            )
                          ) : isUtility ? (
                            space.name.toLowerCase().includes('power') ? (
                              <Zap className="w-3.5 h-3.5" />
                            ) : (
                              <Droplets className="w-3.5 h-3.5" />
                            )
                          ) : (
                            <Landmark className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs block truncate text-indian-navy-950 dark:text-white">
                            {space.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            {state.buildings === 5 ? (
                              <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                                <Building2 className="w-3 h-3" /> Tower
                              </span>
                            ) : state.buildings > 0 ? (
                              <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
                                <Home className="w-3 h-3" /> {state.buildings} House{state.buildings > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span>Undeveloped</span>
                            )}
                            {state.isMortgaged && (
                              <span className="font-bold text-red-600"> • Mortgaged</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-gray-400 block">Rent</span>
                        <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                          ₹{rent.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-gray-50 dark:bg-indian-navy-950 border-t border-indian-parchment-200 dark:border-indian-navy-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold text-xs bg-gray-200 hover:bg-gray-300 dark:bg-indian-navy-800 dark:hover:bg-indian-navy-700 text-indian-navy-950 dark:text-white transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
