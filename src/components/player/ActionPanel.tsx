import React from 'react';
import { BOARD_SPACES } from '@/domain/board-config';
import { GameActionType, GameState, PropertyDefinition } from '@/domain/game-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dices, Check, X, Hammer, ArrowRight, IndianRupee, Building2, MapPin, ShieldAlert, KeyRound } from 'lucide-react';
import { GROUP_COLOR_MAP } from '../board/board-layout-utils';
import { GAME_CONSTANTS } from '@/domain/ruleset';

interface ActionPanelProps {
  gameState: GameState;
  selectedSpaceIndex: number | null;
  onDispatch: (type: GameActionType, payload?: Record<string, unknown>) => void;
  isRolling: boolean;
  userUid?: string;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  gameState,
  selectedSpaceIndex,
  onDispatch,
  isRolling,
  userUid,
}) => {
  const activePlayer = gameState.players.find((p) => p.uid === gameState.currentPlayerUid);
  const isMyTurn = !userUid || userUid === gameState.currentPlayerUid || userUid.startsWith('guest_') || userUid === 'player_1';

  // Identify "My" player state
  const myPlayer =
    gameState.players.find((p) => p.uid === userUid) ||
    gameState.players.find((p) => p.uid === 'player_human') ||
    gameState.players.find((p) => p.uid === gameState.currentPlayerUid) ||
    gameState.players[0];

  const myOwnedProps = myPlayer
    ? Object.entries(gameState.properties)
        .filter(([_, prop]) => prop.ownerUid === myPlayer.uid)
        .map(([idx, prop]) => ({
          spaceIndex: Number(idx),
          space: BOARD_SPACES[Number(idx)],
          state: prop,
        }))
    : [];

  const myCurrentSpace = myPlayer ? BOARD_SPACES[myPlayer.position] : null;

  // Selected space details
  const selectedSpace = selectedSpaceIndex !== null ? BOARD_SPACES[selectedSpaceIndex] : null;
  const selectedPropState = selectedSpaceIndex !== null ? gameState.properties[selectedSpaceIndex] : null;
  const isOwner = selectedPropState && activePlayer && selectedPropState.ownerUid === activePlayer.uid;

  return (
    <div className="flex flex-col gap-2.5 w-full select-none">
      {/* 1. TOP: Current Turn Action Card & Roll The Dice */}
      <Card className="p-3 border-indian-terracotta-300 shadow-md">
        <div className="flex items-center justify-between pb-1.5 border-b border-indian-parchment-300 dark:border-indian-navy-700">
          <div>
            <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider">
              Game Actions
            </h3>
            <span className="text-[10px] text-gray-500 font-medium">
              Phase: {gameState.phase}
            </span>
          </div>

          <Badge variant={isMyTurn ? 'terracotta' : 'neutral'} className="text-[10px]">
            {isMyTurn ? 'Your Turn' : 'Waiting'}
          </Badge>
        </div>

        {/* Action Controls */}
        <div className="mt-2.5 flex flex-col gap-2">
          {/* Phase 1: Awaiting Roll */}
          {gameState.phase === 'AWAIT_ROLL' && (
            <Button
              size="lg"
              variant="primary"
              disabled={!isMyTurn || isRolling}
              isLoading={isRolling}
              onClick={() => onDispatch('ROLL_DICE')}
              className="w-full text-sm font-bold shadow-md flex items-center justify-center gap-2 bg-gradient-to-r from-indian-terracotta-500 to-indian-terracotta-600 hover:from-indian-terracotta-600 hover:to-indian-terracotta-700 py-3"
            >
              <Dices className="w-4 h-4" />
              <span>Roll The Dice</span>
            </Button>
          )}

          {/* Phase: Jail Decision */}
          {gameState.phase === 'JAIL_DECISION' && (
            <div className="flex flex-col gap-1.5">
              <Button
                variant="primary"
                disabled={!isMyTurn || (activePlayer?.cash ?? 0) < GAME_CONSTANTS.JAIL_BAIL}
                onClick={() => onDispatch('PAY_BAIL')}
                className="w-full text-xs font-bold py-2"
              >
                Pay Bail (₹500)
              </Button>
              <Button
                variant="outline"
                disabled={!isMyTurn}
                onClick={() => onDispatch('TRY_DOUBLES')}
                className="w-full text-xs font-bold py-2"
              >
                Try For Doubles
              </Button>
              {(activePlayer?.jailFreeCards ?? 0) > 0 && (
                <Button
                  variant="secondary"
                  disabled={!isMyTurn}
                  onClick={() => onDispatch('USE_JAIL_CARD')}
                  className="w-full text-xs font-bold py-2"
                >
                  Use Get Out of Jail Card
                </Button>
              )}
            </div>
          )}

          {/* Phase 2: Property Decision (Unowned property landed on) */}
          {gameState.phase === 'PROPERTY_DECISION' && gameState.pendingAction?.spaceIndex !== undefined && (
            <div className="flex flex-col gap-1.5">
              {(() => {
                const landingSpace = BOARD_SPACES[gameState.pendingAction.spaceIndex];
                const price = 'price' in landingSpace ? landingSpace.price : 0;
                const canAfford = (activePlayer?.cash ?? 0) >= price;

                return (
                  <>
                    <Button
                      size="lg"
                      variant="primary"
                      disabled={!isMyTurn || !canAfford}
                      onClick={() => onDispatch('BUY_PROPERTY', { spaceIndex: landingSpace.spaceIndex })}
                      className="w-full font-bold flex items-center justify-center gap-2 py-2.5 text-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Buy for ₹{price.toLocaleString('en-IN')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!isMyTurn}
                      onClick={() => onDispatch('DECLINE_PROPERTY')}
                      className="w-full text-xs font-semibold flex items-center justify-center gap-1.5 py-1.5"
                    >
                      <X className="w-3.5 h-3.5 text-gray-500" />
                      <span>Decline Property</span>
                    </Button>
                  </>
                );
              })()}
            </div>
          )}

          {/* Phase 3: Management / Turn End */}
          {(gameState.phase === 'MANAGEMENT' || gameState.phase === 'TURN_END') && (
            <Button
              size="lg"
              variant="secondary"
              disabled={!isMyTurn}
              onClick={() => onDispatch('END_TURN')}
              className="w-full font-bold flex items-center justify-center gap-2 bg-indian-navy-700 hover:bg-indian-navy-800 py-2.5 text-xs"
            >
              <span>End Turn</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* 2. MY INFO: Placed directly below "Roll The Dice" in the right panel */}
      {myPlayer && (
        <Card className="p-3 border-indian-gold-500/70 bg-gradient-to-br from-amber-50/50 to-white dark:from-indian-navy-900 dark:to-indian-navy-800 shadow-sm">
          <div className="flex items-center justify-between pb-1.5 border-b border-indian-parchment-300 dark:border-indian-navy-700">
            <div className="flex items-center gap-1.5">
              <div
                style={{ backgroundColor: myPlayer.colorToken }}
                className="w-5 h-5 rounded-full border border-white text-white font-black text-[9px] flex items-center justify-center shadow-2xs"
              >
                {myPlayer.displayName.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-xs font-extrabold text-indian-navy-900 dark:text-white truncate">
                My Info ({myPlayer.displayName})
              </h3>
            </div>

            <Badge variant="gold" className="text-[9px] py-0 px-1.5">
              You
            </Badge>
          </div>

          {/* Financial Breakdown */}
          <div className="grid grid-cols-2 gap-2 mt-2 p-2 rounded-lg bg-white/90 dark:bg-indian-navy-950/60 border border-indian-parchment-300 dark:border-indian-navy-800">
            <div>
              <span className="text-[10px] text-gray-500 font-medium block">Liquid Cash</span>
              <div className="flex items-center text-sm font-black text-emerald-700 dark:text-emerald-400">
                <IndianRupee className="w-3.5 h-3.5 -mr-0.5" />
                <span>{myPlayer.cash.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-gray-500 font-medium block">Total Net Worth</span>
              <span className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-200">
                ₹{myPlayer.netWorth.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Position & Status */}
          <div className="mt-2 space-y-1 text-[10px]">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-indian-terracotta-500" />
                Location:
              </span>
              <span className="font-bold text-indian-navy-900 dark:text-white truncate max-w-[140px]">
                {myCurrentSpace?.name || 'Board'} (#{myPlayer.position})
              </span>
            </div>

            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-600" />
                Status:
              </span>
              <span>
                {myPlayer.inJail ? (
                  <strong className="text-red-600">In Jail ({myPlayer.jailTurns}/3)</strong>
                ) : (
                  <span className="text-emerald-600 font-semibold">Free to Move</span>
                )}
              </span>
            </div>

            {myPlayer.jailFreeCards > 0 && (
              <div className="flex items-center gap-1 text-teal-700 text-[10px] font-semibold">
                <KeyRound className="w-3 h-3" />
                <span>{myPlayer.jailFreeCards} Get Out of Jail Free Card(s)</span>
              </div>
            )}
          </div>

          {/* My Properties Summary */}
          <div className="mt-2 pt-1.5 border-t border-indian-parchment-300 dark:border-indian-navy-700">
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-indian-terracotta-500" />
                My Portfolio:
              </span>
              <span>{myOwnedProps.length} Properties</span>
            </div>

            {myOwnedProps.length === 0 ? (
              <span className="text-[10px] text-gray-400 italic block">No properties purchased yet.</span>
            ) : (
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-0.5">
                {myOwnedProps.map(({ spaceIndex, space, state }) => {
                  const groupColor = 'group' in space && space.group ? GROUP_COLOR_MAP[space.group] : '#888888';
                  return (
                    <span
                      key={spaceIndex}
                      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md border bg-white dark:bg-indian-navy-900 shadow-2xs font-medium"
                      style={{ borderLeftColor: groupColor, borderLeftWidth: '3px' }}
                    >
                      <span className="truncate max-w-[85px]">{space.name}</span>
                      {state.buildings > 0 && (
                        <span className="text-[8px] bg-amber-100 text-amber-800 px-0.5 rounded font-bold">
                          {state.buildings === 5 ? '🏢' : `🏠x${state.buildings}`}
                        </span>
                      )}
                      {state.isMortgaged && (
                        <span className="text-[8px] text-red-500 font-bold">[M]</span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 3. Selected Space Deed Inspector */}
      {selectedSpace && (
        <Card className="p-3 border-indian-parchment-300 dark:border-indian-navy-700 shadow-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-indian-parchment-200 dark:border-indian-navy-700">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Space #{selectedSpace.spaceIndex}
            </span>
            {selectedPropState?.ownerUid ? (
              <Badge variant="emerald" className="text-[9px]">
                Owned by {gameState.players.find((p) => p.uid === selectedPropState.ownerUid)?.displayName}
              </Badge>
            ) : 'price' in selectedSpace ? (
              <Badge variant="neutral" className="text-[9px]">
                Unowned
              </Badge>
            ) : null}
          </div>

          <div className="mt-1.5">
            {/* Color banner if property */}
            {selectedSpace.type === 'PROPERTY' && (
              <div
                className="h-1.5 rounded mb-1.5"
                style={{ backgroundColor: GROUP_COLOR_MAP[selectedSpace.group] }}
              />
            )}

            <h4 className="font-serif font-bold text-xs text-indian-navy-900 dark:text-white leading-tight">
              {selectedSpace.name}
            </h4>
            {'hindiName' in selectedSpace && selectedSpace.hindiName && (
              <span className="text-[10px] text-gray-500 font-medium block">
                {selectedSpace.hindiName}
              </span>
            )}

            {'price' in selectedSpace && (
              <div className="mt-1.5 text-[11px] flex justify-between py-0.5 border-t border-indian-parchment-200 dark:border-indian-navy-700">
                <span className="text-gray-600 dark:text-gray-400">Price:</span>
                <span className="font-bold text-indian-navy-900 dark:text-white">₹{selectedSpace.price}</span>
              </div>
            )}

            {selectedSpace.type === 'PROPERTY' && (
              <div className="mt-1 space-y-0.5 text-[10px] text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Base Rent:</span>
                  <span className="font-semibold text-indian-navy-800 dark:text-indian-parchment-200">
                    ₹{(selectedSpace as PropertyDefinition).baseRent}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>With 1 House:</span>
                  <span>₹{(selectedSpace as PropertyDefinition).rentHouse1}</span>
                </div>
                <div className="flex justify-between">
                  <span>With Tower:</span>
                  <span className="font-bold text-indian-terracotta-600">
                    ₹{(selectedSpace as PropertyDefinition).rentTower}
                  </span>
                </div>
              </div>
            )}

            {/* Development / Mortgage controls if owner */}
            {isOwner && selectedSpace.type === 'PROPERTY' && (
              <div className="mt-2 pt-1.5 border-t border-indian-parchment-200 dark:border-indian-navy-700 flex flex-col gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDispatch('BUILD', { spaceIndex: selectedSpace.spaceIndex })}
                  className="w-full text-[10px] py-1 flex items-center justify-center gap-1"
                >
                  <Hammer className="w-3 h-3 text-emerald-600" />
                  <span>Build House (₹{(selectedSpace as PropertyDefinition).buildingCost})</span>
                </Button>

                {!selectedPropState.isMortgaged ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDispatch('MORTGAGE', { spaceIndex: selectedSpace.spaceIndex })}
                    className="w-full text-[10px] py-1 text-red-600 hover:text-red-700"
                  >
                    Mortgage for ₹{selectedSpace.mortgageValue}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDispatch('UNMORTGAGE', { spaceIndex: selectedSpace.spaceIndex })}
                    className="w-full text-[10px] py-1 text-emerald-700"
                  >
                    Redeem Mortgage (₹{selectedSpace.unmortgageCost})
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
