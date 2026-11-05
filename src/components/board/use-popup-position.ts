/**
 * Indian Monopoly - Viewport & Collision-Aware Popup Positioning Engine
 *
 * Dynamically computes pixel-perfect placement for the City Purchase & Property Decision popup:
 * 1. Measures the exact DOM bounding rect of the target space grid cell.
 * 2. Measures the popup dimensions.
 * 3. Chooses the optimal orientation:
 *    - Bottom edge (spaces 0-10): Places popup above the bottom tile inside the lower board area.
 *    - Top edge (spaces 20-30): Places popup below the top tile.
 *    - Left edge (spaces 10-20): Places popup to the right of the tile.
 *    - Right edge (spaces 30-39): Places popup to the left of the tile.
 * 4. Strictly clamps the popup within viewport boundaries (MIN_MARGIN = 12px)
 *    ensuring it NEVER extends beyond the bottom browser margin or viewport bounds.
 * 5. Re-evaluates dynamically on resize, scroll, orientation changes, and layout shifts.
 */

import { useState, useEffect, useCallback, RefObject } from 'react';
import { getSpaceGridCoord } from './board-layout-utils';

export interface PopupPositionResult {
  style: React.CSSProperties;
  placement: 'top' | 'bottom' | 'left' | 'right';
  arrowStyle: React.CSSProperties;
  isReady: boolean;
}

export function usePopupPosition(
  spaceIndex: number,
  popupRef: RefObject<HTMLElement | null>,
  boardContainerRef?: RefObject<HTMLElement | null>
): PopupPositionResult {
  const [position, setPosition] = useState<PopupPositionResult>({
    style: { opacity: 0, position: 'fixed', pointerEvents: 'none' },
    placement: 'top',
    arrowStyle: {},
    isReady: false,
  });

  const calculatePosition = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Locate the DOM cell for this space index
    const cellElement = document.querySelector<HTMLElement>(
      `[data-space-index="${spaceIndex}"]`
    );

    const popupElement = popupRef.current;
    if (!cellElement || !popupElement) {
      return;
    }

    const cellRect = cellElement.getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();

    const popupWidth = popupRect.width || 280;
    const popupHeight = popupRect.height || 160;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const MIN_MARGIN = 12;
    const GAP = 12;

    const coord = getSpaceGridCoord(spaceIndex);
    let placement: 'top' | 'bottom' | 'left' | 'right' = 'top';
    let targetX = 0;
    let targetY = 0;

    // Determine primary orientation
    if (coord.orientation === 'bottom') {
      placement = 'top'; // Above the cell (into the lower board interior)
      targetX = cellRect.left + cellRect.width / 2 - popupWidth / 2;
      targetY = cellRect.top - popupHeight - GAP;
    } else if (coord.orientation === 'top') {
      placement = 'bottom'; // Below the cell
      targetX = cellRect.left + cellRect.width / 2 - popupWidth / 2;
      targetY = cellRect.bottom + GAP;
    } else if (coord.orientation === 'left') {
      placement = 'right'; // Right of the cell
      targetX = cellRect.right + GAP;
      targetY = cellRect.top + cellRect.height / 2 - popupHeight / 2;
    } else if (coord.orientation === 'right') {
      placement = 'left'; // Left of the cell
      targetX = cellRect.left - popupWidth - GAP;
      targetY = cellRect.top + cellRect.height / 2 - popupHeight / 2;
    } else {
      // Corners
      if (spaceIndex === 0) {
        // Bottom-Right Corner (START)
        placement = 'top';
        targetX = cellRect.left - popupWidth + 40;
        targetY = cellRect.top - popupHeight - GAP;
      } else if (spaceIndex === 10) {
        // Bottom-Left Corner (JAIL)
        placement = 'top';
        targetX = cellRect.right - 40;
        targetY = cellRect.top - popupHeight - GAP;
      } else if (spaceIndex === 20) {
        // Top-Left Corner (REST)
        placement = 'bottom';
        targetX = cellRect.right - 40;
        targetY = cellRect.bottom + GAP;
      } else {
        // Top-Right Corner (GO TO JAIL)
        placement = 'bottom';
        targetX = cellRect.left - popupWidth + 40;
        targetY = cellRect.bottom + GAP;
      }
    }

    // Secondary collision detection: if placement overflows viewport vertically, invert
    if (placement === 'top' && targetY < MIN_MARGIN) {
      if (cellRect.bottom + popupHeight + GAP <= viewportHeight - MIN_MARGIN) {
        placement = 'bottom';
        targetY = cellRect.bottom + GAP;
      }
    } else if (placement === 'bottom' && targetY + popupHeight > viewportHeight - MIN_MARGIN) {
      if (cellRect.top - popupHeight - GAP >= MIN_MARGIN) {
        placement = 'top';
        targetY = cellRect.top - popupHeight - GAP;
      }
    }

    // Viewport Boundary Clamping: Never allow popup to exceed viewport edges
    const clampedX = Math.max(
      MIN_MARGIN,
      Math.min(targetX, viewportWidth - popupWidth - MIN_MARGIN)
    );
    const clampedY = Math.max(
      MIN_MARGIN,
      Math.min(targetY, viewportHeight - popupHeight - MIN_MARGIN)
    );

    // Compute pointer arrow alignment pointing towards the cell center
    const cellCenterX = cellRect.left + cellRect.width / 2;
    const arrowX = Math.max(16, Math.min(cellCenterX - clampedX, popupWidth - 16));

    const arrowStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${arrowX}px`,
      transform: 'translateX(-50%)',
    };

    if (placement === 'top') {
      arrowStyle.bottom = '-8px';
    } else if (placement === 'bottom') {
      arrowStyle.top = '-8px';
    }

    setPosition({
      style: {
        position: 'fixed',
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        zIndex: 60,
        opacity: 1,
        pointerEvents: 'auto',
      },
      placement,
      arrowStyle,
      isReady: true,
    });
  }, [spaceIndex, popupRef]);

  useEffect(() => {
    // Initial calculation with double requestAnimationFrame to ensure DOM styles settled
    let rafId2 = 0;
    const rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        calculatePosition();
      });
    });

    const handleWindowChange = () => {
      calculatePosition();
    };

    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    window.addEventListener('orientationchange', handleWindowChange);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && boardContainerRef?.current) {
      resizeObserver = new ResizeObserver(() => {
        calculatePosition();
      });
      resizeObserver.observe(boardContainerRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('orientationchange', handleWindowChange);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [calculatePosition, boardContainerRef]);

  return position;
}
