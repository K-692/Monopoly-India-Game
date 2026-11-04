import React from 'react';
import { BoardSpaceDefinition, GameActionType, PlayerState, PropertyDefinition, PropertyState } from '@/domain/game-types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Hammer, Landmark, ShieldAlert } from 'lucide-react';
import { GROUP_COLOR_MAP } from './board-layout-utils';

interface SpaceDeedInspectorProps {
  space: BoardSpaceDefinition | null;
  propertyState?: PropertyState | null;
  players: PlayerState[];
  isOwner?: boolean;
  onDispatch?: (type: GameActionType, payload?: Record<string, unknown>) => void;
}

export const SpaceDeedInspector: React.FC<SpaceDeedInspectorProps> = ({
  space,
  propertyState,
  players,
  isOwner = false,
  onDispatch,
}) => {
  if (!space) {
    return (
      <Card className="p-2 border-indian-parchment-300 dark:border-indian-navy-700 bg-white/70 dark:bg-indian-navy-900/70 text-center select-none shadow-xs overflow-hidden">
        <div className="flex flex-col items-center justify-center py-1 text-gray-400 dark:text-gray-500">
          <Landmark className="w-4 h-4 mb-0.5 stroke-1" />
          <span className="text-[9px] font-medium">Click any space to inspect deed details</span>
        </div>
      </Card>
    );
  }

  const owner = propertyState?.ownerUid
    ? players.find((p) => p.uid === propertyState.ownerUid)
    : null;

  const isProperty = space.type === 'PROPERTY';
  const isTransit = space.type === 'TRANSIT';
  const isUtility = space.type === 'UTILITY';
  const isTax = space.type === 'TAX';

  const groupColor = isProperty && 'group' in space ? GROUP_COLOR_MAP[space.group] : undefined;

  return (
    <Card className="p-2 border-indian-parchment-300 dark:border-indian-navy-700 shadow-sm bg-white dark:bg-indian-navy-900 select-none overflow-hidden space-y-1">
      {/* Header: Space Index & Ownership Status */}
      <div className="flex items-center justify-between pb-1 border-b border-indian-parchment-200 dark:border-indian-navy-700">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
          Space #{space.spaceIndex}
        </span>

        {owner ? (
          <span
            className="text-[8px] py-0.2 px-1.5 rounded-full font-bold shadow-2xs flex items-center gap-1 text-white"
            style={{ backgroundColor: owner.colorToken }}
          >
            {owner.displayName}
          </span>
        ) : 'price' in space ? (
          <Badge variant="neutral" className="text-[8px] py-0 px-1 font-semibold">
            Available
          </Badge>
        ) : (
          <Badge variant="neutral" className="text-[8px] py-0 px-1">
            {space.type}
          </Badge>
        )}
      </div>

      {/* Property Title & Color Bar */}
      <div>
        {groupColor && (
          <div
            className="h-1 rounded-full mb-1 shadow-2xs"
            style={{ backgroundColor: groupColor }}
          />
        )}

        <div className="flex items-center justify-between">
          <h4 className="font-serif font-black text-xs text-indian-navy-900 dark:text-white leading-tight truncate max-w-[130px]">
            {space.name}
          </h4>

          {isProperty && 'group' in space && (
            <span
              className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.2 rounded"
              style={{ backgroundColor: `${groupColor}20`, color: groupColor }}
            >
              {space.group}
            </span>
          )}
        </div>

        {/* Price Row */}
        {'price' in space && (
          <div className="mt-0.5 text-[10px] flex justify-between items-center py-0.2">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Price:</span>
            <span className="font-black text-emerald-700 dark:text-emerald-400">
              ₹{space.price.toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {/* Tax Amount Row */}
        {isTax && 'amount' in space && (
          <div className="mt-0.5 text-[10px] flex justify-between items-center py-0.2">
            <span className="text-red-600 font-medium flex items-center gap-0.5">
              <ShieldAlert className="w-2.5 h-2.5" /> Levy:
            </span>
            <span className="font-black text-red-600">
              ₹{space.amount.toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {/* Street Property Rent Schedule: 2-Column Compact Grid */}
        {isProperty && (
          <div className="mt-1 text-[8.5px] text-gray-600 dark:text-gray-300 bg-indian-parchment-50 dark:bg-indian-navy-950/60 p-1 rounded border border-indian-parchment-200 dark:border-indian-navy-800 grid grid-cols-2 gap-x-2 gap-y-0.5">
            <div className="flex justify-between">
              <span>Base Rent:</span>
              <span className="font-bold text-indian-navy-900 dark:text-indian-parchment-200">
                ₹{(space as PropertyDefinition).baseRent.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>3 Houses:</span>
              <span>₹{(space as PropertyDefinition).rentHouse3.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>1 House:</span>
              <span>₹{(space as PropertyDefinition).rentHouse1.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>4 Houses:</span>
              <span>₹{(space as PropertyDefinition).rentHouse4.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>2 Houses:</span>
              <span>₹{(space as PropertyDefinition).rentHouse2.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between font-bold text-indian-terracotta-600 dark:text-indian-terracotta-400">
              <span>Tower:</span>
              <span>₹{(space as PropertyDefinition).rentTower.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        {/* Transit Schedule: 2-Column Compact Grid */}
        {isTransit && (
          <div className="mt-1 text-[8.5px] text-gray-600 dark:text-gray-300 bg-indian-parchment-50 dark:bg-indian-navy-950/60 p-1 rounded border border-indian-parchment-200 dark:border-indian-navy-800 grid grid-cols-2 gap-x-2 gap-y-0.5">
            <div className="flex justify-between"><span>1 Gateway:</span><span>₹250</span></div>
            <div className="flex justify-between"><span>3 Gateways:</span><span>₹1,000</span></div>
            <div className="flex justify-between"><span>2 Gateways:</span><span>₹500</span></div>
            <div className="flex justify-between font-bold text-indian-terracotta-600"><span>4 Gateways:</span><span>₹2,000</span></div>
          </div>
        )}

        {/* Utility Schedule */}
        {isUtility && (
          <div className="mt-1 text-[8.5px] text-gray-600 dark:text-gray-300 bg-indian-parchment-50 dark:bg-indian-navy-950/60 p-1 rounded border border-indian-parchment-200 dark:border-indian-navy-800 flex justify-between">
            <span>1 Utility: 4× Dice</span>
            <span className="font-bold text-indian-terracotta-600">Both: 10× Dice</span>
          </div>
        )}

        {/* Mortgage / Building Management Controls (Visible to Owner) */}
        {isOwner && isProperty && propertyState && onDispatch && (
          <div className="mt-1 pt-1 border-t border-indian-parchment-200 dark:border-indian-navy-700 flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDispatch('BUILD', { spaceIndex: space.spaceIndex })}
              className="flex-1 text-[8.5px] py-0.5 flex items-center justify-center gap-0.5"
            >
              <Hammer className="w-2.5 h-2.5 text-emerald-600" />
              <span>
                Build (₹{(space as PropertyDefinition).buildingCost.toLocaleString('en-IN')})
              </span>
            </Button>

            {!propertyState.isMortgaged ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDispatch('MORTGAGE', { spaceIndex: space.spaceIndex })}
                className="text-[8.5px] py-0.5 text-red-600 hover:text-red-700"
              >
                Mortgage
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDispatch('UNMORTGAGE', { spaceIndex: space.spaceIndex })}
                className="text-[8.5px] py-0.5 text-emerald-700 border-emerald-300 bg-emerald-50"
              >
                Redeem
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
