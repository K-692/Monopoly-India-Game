import React from 'react';
import { createPortal } from 'react-dom';
import { BoardSpaceDefinition, GameActionType, PlayerState, PropertyDefinition, PropertyState } from '@/domain/game-types';
import { X, Landmark, Home, Building2, ShieldAlert } from 'lucide-react';
import { PopupTurnTimer } from '@/components/feedback/PopupTurnTimer';
import { calculateMortgageValue, getPropertyNoun } from '@/domain/ruleset';
import { cn } from '@/lib/utils/cn';

interface CityDeedModalProps {
  space: BoardSpaceDefinition | null;
  propertyState?: PropertyState | null;
  players: PlayerState[];
  isMyTurn?: boolean;
  currentUserUid?: string;
  turnNumber?: number;
  onClose: () => void;
  onDispatch?: (type: GameActionType, payload?: Record<string, unknown>) => void;
  activePlayerName?: string;
  activePlayerColor?: string;
  turnTimeRemaining?: number;
}

export const CityDeedModal: React.FC<CityDeedModalProps> = ({
  space,
  propertyState,
  players,
  isMyTurn = false,
  currentUserUid,
  turnNumber: _turnNumber,
  onClose,
  onDispatch,
  activePlayerName,
  activePlayerColor,
  turnTimeRemaining = 30,
}) => {
  if (!space) return null;

  const owner = propertyState?.ownerUid
    ? players.find((p) => p.uid === propertyState.ownerUid)
    : null;

  const isOwner = currentUserUid && propertyState?.ownerUid === currentUserUid;
  const isProperty = space.type === 'PROPERTY';
  const isTransit = space.type === 'TRANSIT';
  const isUtility = space.type === 'UTILITY';
  const isTax = space.type === 'TAX';
  const isAirport = space.spaceIndex === 25 || space.spaceIndex === 35;
  const noun = getPropertyNoun(space);

  const mortgageVal = calculateMortgageValue(space.spaceIndex, propertyState || undefined);
  const reacquisitionCost =
    propertyState?.mortgagePayout && propertyState.mortgagePayout > 0
      ? propertyState.mortgagePayout
      : mortgageVal;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm sm:max-w-md rounded-2xl bg-white dark:bg-indian-navy-900 border-2 border-indian-parchment-400 dark:border-indian-navy-700 shadow-2xl overflow-hidden flex flex-col animate-scale-in text-indian-navy-950 dark:text-white"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-indian-parchment-200 dark:border-indian-navy-800">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Space #{space.spaceIndex} • {space.type}
              </span>
            </div>
            <h3 className="font-serif font-black text-base sm:text-lg text-indian-navy-950 dark:text-white leading-tight">
              {space.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <PopupTurnTimer
              activePlayerName={activePlayerName}
              activePlayerColor={activePlayerColor}
              timeRemaining={turnTimeRemaining}
              isMyTurn={Boolean(isMyTurn)}
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
          {/* Ownership & Status Bar */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-indian-parchment-100 dark:bg-indian-navy-950/80 border border-indian-parchment-300 dark:border-indian-navy-800">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">{noun} Owner</span>
                {owner ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      style={{ backgroundColor: owner.colorToken }}
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                    />
                    <span className="font-bold text-xs">{owner.displayName}</span>
                  </div>
                ) : 'price' in space ? (
                  <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    Unowned (Available from Bank)
                  </span>
                ) : (
                  <span className="font-bold text-xs text-gray-600">Public Institution</span>
                )}
              </div>
            </div>

            {propertyState?.isMortgaged ? (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 font-black text-[10px] border border-red-300">
                MORTGAGED
              </span>
            ) : propertyState && propertyState.buildings > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-black text-[10px] border border-amber-300">
                {propertyState.buildings === 5 ? '🏢 Commercial Tower' : `🏠 ${propertyState.buildings} Houses`}
              </span>
            ) : null}
          </div>

          {/* Pricing & Mortgage Metrics */}
          {'price' in space && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium block">Price</span>
                <span className="font-black text-sm text-emerald-800 dark:text-emerald-300">
                  ₹{space.price.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium block">Mortgage</span>
                <span className="font-black text-sm text-amber-800 dark:text-amber-300">
                  ₹{mortgageVal.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium block">Reacquire</span>
                <span className="font-black text-sm text-blue-800 dark:text-blue-300">
                  ₹{reacquisitionCost.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Property Rent Schedule */}
          {isProperty && (
            <div className="rounded-xl border border-indian-parchment-300 dark:border-indian-navy-800 overflow-hidden">
              <div className="bg-indian-parchment-200 dark:bg-indian-navy-800/80 px-3 py-1.5 font-bold text-[10px] text-gray-700 dark:text-gray-300 uppercase tracking-wider flex justify-between">
                <span>Rent Schedule</span>
                <span>Tariff</span>
              </div>
              <div className="divide-y divide-indian-parchment-200 dark:divide-indian-navy-800 font-medium text-xs">
                <div className={cn("px-3 py-1.5 flex justify-between", propertyState?.buildings === 0 && "bg-amber-100/60 dark:bg-amber-950/40 font-bold")}>
                  <span>Base Rent (Undeveloped)</span>
                  <span>₹{(space as PropertyDefinition).baseRent.toLocaleString('en-IN')}</span>
                </div>
                <div className={cn("px-3 py-1.5 flex justify-between", propertyState?.buildings === 1 && "bg-amber-100/60 dark:bg-amber-950/40 font-bold")}>
                  <span className="flex items-center gap-1"><Home className="w-3.5 h-3.5 text-emerald-600" /> With 1 House</span>
                  <span>₹{(space as PropertyDefinition).rentHouse1.toLocaleString('en-IN')}</span>
                </div>
                <div className={cn("px-3 py-1.5 flex justify-between", propertyState?.buildings === 2 && "bg-amber-100/60 dark:bg-amber-950/40 font-bold")}>
                  <span className="flex items-center gap-1"><Home className="w-3.5 h-3.5 text-emerald-600" /> With 2 Houses</span>
                  <span>₹{(space as PropertyDefinition).rentHouse2.toLocaleString('en-IN')}</span>
                </div>
                <div className={cn("px-3 py-1.5 flex justify-between", propertyState?.buildings === 3 && "bg-amber-100/60 dark:bg-amber-950/40 font-bold")}>
                  <span className="flex items-center gap-1"><Home className="w-3.5 h-3.5 text-emerald-600" /> With 3 Houses</span>
                  <span>₹{(space as PropertyDefinition).rentHouse3.toLocaleString('en-IN')}</span>
                </div>
                <div className={cn("px-3 py-1.5 flex justify-between", propertyState?.buildings === 4 && "bg-amber-100/60 dark:bg-amber-950/40 font-bold")}>
                  <span className="flex items-center gap-1"><Home className="w-3.5 h-3.5 text-emerald-600" /> With 4 Houses</span>
                  <span>₹{(space as PropertyDefinition).rentHouse4.toLocaleString('en-IN')}</span>
                </div>
                <div className={cn("px-3 py-1.5 flex justify-between", propertyState?.buildings === 5 && "bg-amber-100/60 dark:bg-amber-950/40 font-bold")}>
                  <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-amber-600" /> With Commercial Tower</span>
                  <span className="text-amber-700 dark:text-amber-400 font-black">₹{(space as PropertyDefinition).rentTower.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="bg-indian-parchment-100 dark:bg-indian-navy-950 px-3 py-1.5 text-[10px] text-gray-500 flex justify-between">
                <span>Construction Cost:</span>
                <span className="font-bold text-indian-navy-950 dark:text-white">₹{(space as PropertyDefinition).buildingCost.toLocaleString('en-IN')} per unit</span>
              </div>
            </div>
          )}

          {/* Transit Rent Schedule */}
          {isTransit && (
            <div className="rounded-xl border border-indian-parchment-300 dark:border-indian-navy-800 overflow-hidden text-xs">
              <div className="bg-indian-parchment-200 dark:bg-indian-navy-800/80 px-3 py-1.5 font-bold text-[10px] text-gray-700 dark:text-gray-300 uppercase tracking-wider flex justify-between">
                <span>{isAirport ? 'Airports Owned' : 'Railways Owned'}</span>
                <span>Visiting Charge</span>
              </div>
              <div className="divide-y divide-indian-parchment-200 dark:divide-indian-navy-800 font-medium">
                {isAirport ? (
                  <>
                    <div className="px-3 py-1.5 flex justify-between"><span>1 Airport Owned</span><span>₹1,000</span></div>
                    <div className="px-3 py-1.5 flex justify-between"><span>2 Airports Owned (Both)</span><span>₹2,500</span></div>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-1.5 flex justify-between"><span>1 Railway Owned</span><span>₹250</span></div>
                    <div className="px-3 py-1.5 flex justify-between"><span>2 Railways Owned (Both)</span><span>₹500</span></div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Utility Schedule */}
          {isUtility && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs space-y-1">
              <span className="font-bold text-blue-900 dark:text-blue-300 block">National Public Utility Grid</span>
              <p className="text-gray-600 dark:text-gray-300">
                • If 1 Utility is owned: Rent is <strong>4× Dice Roll Total</strong>.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                • If both Utilities are owned: Rent is <strong>10× Dice Roll Total</strong>.
              </p>
            </div>
          )}

          {/* Tax Information */}
          {isTax && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>Statutory Government Checkpost</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Every player who lands on this space must pay a statutory levy of <strong>₹{space.amount.toLocaleString('en-IN')}</strong> to the municipal treasury.
              </p>
            </div>
          )}

          {/* Mortgage Action Button for Owner (Reacquisition requires physically landing on the city) */}
          {isOwner && onDispatch && propertyState?.ownershipState !== 'BLOCKED' && (
            <div className="pt-2">
              {!propertyState?.isMortgaged ? (
                <button
                  type="button"
                  onClick={() => {
                    onDispatch('MORTGAGE', { spaceIndex: space.spaceIndex });
                    onClose();
                  }}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Mortgage {noun} (Receive ₹{mortgageVal.toLocaleString('en-IN')})</span>
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-center">
                  <p className="text-xs text-amber-900 dark:text-amber-200 font-bold leading-tight">
                    {noun} is currently mortgaged.
                  </p>
                  <p className="text-[10.5px] text-amber-700 dark:text-amber-300/80 mt-1 leading-normal">
                    To reacquire for ₹{reacquisitionCost.toLocaleString('en-IN')}, you must physically land on this {noun.toLowerCase()} again during your turn.
                  </p>
                </div>
              )}
            </div>
          )}
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
