import React from 'react';
import { BOARD_SPACES } from '@/domain/board-config';
import { GameActionType, GameState, PropertyDefinition } from '@/domain/game-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dices, Check, X, Hammer, ArrowRight } from 'lucide-react';
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

  // Selected space details
  const selectedSpace = selectedSpaceIndex !== null ? BOARD_SPACES[selectedSpaceIndex] : null;
  const selectedPropState = selectedSpaceIndex !== null ? gameState.properties[selectedSpaceIndex] : null;
  const isOwner = selectedPropState && activePlayer && selectedPropState.ownerUid === activePlayer.uid;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Current Turn Action Card */}
      <Card className="p-4 border-indian-terracotta-300 shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-indian-parchment-300">
          <div>
            <h3 className="text-xs font-bold text-indian-navy-800 uppercase tracking-wider">
              Available Actions
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
        <div className="mt-3 flex flex-col gap-2">
          {/* Phase 1: Awaiting Roll */}
          {gameState.phase === 'AWAIT_ROLL' && (
            <Button
              size="lg"
              variant="primary"
              disabled={!isMyTurn || isRolling}
              isLoading={isRolling}
              onClick={() => onDispatch('ROLL_DICE')}
              className="w-full text-base font-bold shadow-md flex items-center justify-center gap-2 bg-gradient-to-r from-indian-terracotta-500 to-indian-terracotta-600 hover:from-indian-terracotta-600 hover:to-indian-terracotta-700 py-3.5"
            >
              <Dices className="w-5 h-5" />
              <span>Roll The Dice</span>
            </Button>
          )}

          {/* Phase: Jail Decision */}
          {gameState.phase === 'JAIL_DECISION' && (
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                disabled={!isMyTurn || (activePlayer?.cash ?? 0) < GAME_CONSTANTS.JAIL_BAIL}
                onClick={() => onDispatch('PAY_BAIL')}
                className="w-full text-xs font-bold"
              >
                Pay Bail (₹500)
              </Button>
              <Button
                variant="outline"
                disabled={!isMyTurn}
                onClick={() => onDispatch('TRY_DOUBLES')}
                className="w-full text-xs font-bold"
              >
                Try For Doubles
              </Button>
              {(activePlayer?.jailFreeCards ?? 0) > 0 && (
                <Button
                  variant="secondary"
                  disabled={!isMyTurn}
                  onClick={() => onDispatch('USE_JAIL_CARD')}
                  className="w-full text-xs font-bold"
                >
                  Use Get Out of Jail Card
                </Button>
              )}
            </div>
          )}

          {/* Phase 2: Property Decision (Unowned property landed on) */}
          {gameState.phase === 'PROPERTY_DECISION' && gameState.pendingAction?.spaceIndex !== undefined && (
            <div className="flex flex-col gap-2">
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
                      className="w-full font-bold flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Buy for ₹{price.toLocaleString('en-IN')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!isMyTurn}
                      onClick={() => onDispatch('DECLINE_PROPERTY')}
                      className="w-full text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4 text-gray-500" />
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
              className="w-full font-bold flex items-center justify-center gap-2 bg-indian-navy-700 hover:bg-indian-navy-800"
            >
              <span>End Turn</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Selected Space Deed Details */}
      {selectedSpace && (
        <Card className="p-3 border-indian-parchment-300">
          <div className="flex items-center justify-between pb-2 border-b border-indian-parchment-200">
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

          <div className="mt-2">
            {/* Color banner if property */}
            {selectedSpace.type === 'PROPERTY' && (
              <div
                className="h-2 rounded mb-2"
                style={{ backgroundColor: GROUP_COLOR_MAP[selectedSpace.group] }}
              />
            )}

            <h4 className="font-serif font-bold text-sm text-indian-navy-900 leading-tight">
              {selectedSpace.name}
            </h4>
            {'hindiName' in selectedSpace && selectedSpace.hindiName && (
              <span className="text-[11px] text-gray-500 font-medium block">
                {selectedSpace.hindiName}
              </span>
            )}

            {'price' in selectedSpace && (
              <div className="mt-2 text-xs flex justify-between py-1 border-t border-indian-parchment-200">
                <span className="text-gray-600">Price:</span>
                <span className="font-bold text-indian-navy-900">₹{selectedSpace.price}</span>
              </div>
            )}

            {selectedSpace.type === 'PROPERTY' && (
              <div className="mt-1 space-y-0.5 text-[11px] text-gray-600">
                <div className="flex justify-between">
                  <span>Base Rent:</span>
                  <span className="font-semibold text-indian-navy-800">₹{(selectedSpace as PropertyDefinition).baseRent}</span>
                </div>
                <div className="flex justify-between">
                  <span>With 1 House:</span>
                  <span>₹{(selectedSpace as PropertyDefinition).rentHouse1}</span>
                </div>
                <div className="flex justify-between">
                  <span>With Tower:</span>
                  <span className="font-bold text-indian-terracotta-600">₹{(selectedSpace as PropertyDefinition).rentTower}</span>
                </div>
              </div>
            )}

            {/* Development / Mortgage controls if owner */}
            {isOwner && selectedSpace.type === 'PROPERTY' && (
              <div className="mt-3 pt-2 border-t border-indian-parchment-200 flex flex-col gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDispatch('BUILD', { spaceIndex: selectedSpace.spaceIndex })}
                  className="w-full text-xs flex items-center justify-center gap-1.5"
                >
                  <Hammer className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Build House (₹{(selectedSpace as PropertyDefinition).buildingCost})</span>
                </Button>

                {!selectedPropState.isMortgaged ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDispatch('MORTGAGE', { spaceIndex: selectedSpace.spaceIndex })}
                    className="w-full text-xs text-red-600 hover:text-red-700"
                  >
                    Mortgage for ₹{selectedSpace.mortgageValue}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDispatch('UNMORTGAGE', { spaceIndex: selectedSpace.spaceIndex })}
                    className="w-full text-xs text-emerald-700"
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
