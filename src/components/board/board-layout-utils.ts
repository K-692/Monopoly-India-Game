export interface GridCoord {
  row: number;
  col: number;
  orientation: 'bottom' | 'left' | 'top' | 'right' | 'corner';
}

export function getSpaceGridCoord(spaceIndex: number): GridCoord {
  if (spaceIndex === 0) return { row: 11, col: 11, orientation: 'corner' };
  if (spaceIndex > 0 && spaceIndex < 10) {
    return { row: 11, col: 11 - spaceIndex, orientation: 'bottom' };
  }
  if (spaceIndex === 10) return { row: 11, col: 1, orientation: 'corner' };
  if (spaceIndex > 10 && spaceIndex < 20) {
    return { row: 11 - (spaceIndex - 10), col: 1, orientation: 'left' };
  }
  if (spaceIndex === 20) return { row: 1, col: 1, orientation: 'corner' };
  if (spaceIndex > 20 && spaceIndex < 30) {
    return { row: 1, col: 1 + (spaceIndex - 20), orientation: 'top' };
  }
  if (spaceIndex === 30) return { row: 1, col: 11, orientation: 'corner' };
  // 31 to 39
  return { row: 1 + (spaceIndex - 30), col: 11, orientation: 'right' };
}

