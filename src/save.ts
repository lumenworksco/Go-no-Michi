import type { Color } from './engine/board';
import type { GameSettings } from './ui/Setup';
import { load, save } from './store';

export interface SavedGame {
  settings: GameSettings;
  human: Color;
  /** 着手の交点。パスは -1 */
  moves: number[];
}

const KEY = 'gonomichi:save';
const REC = 'gonomichi:record';

export const loadSavedGame = (): SavedGame | null => {
  const g = load<SavedGame | null>(KEY, null);
  return g && g.settings && Array.isArray(g.moves) ? g : null;
};
export const storeSavedGame = (g: SavedGame) => save(KEY, g);
export const clearSavedGame = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 消せなくても続行 */
  }
};

export interface Record3 {
  win: number;
  lose: number;
  draw: number;
}
export const loadRecord = (): Record3 => ({ win: 0, lose: 0, draw: 0, ...load<Partial<Record3>>(REC, {}) });
export function addRecord(r: 'win' | 'lose' | 'draw') {
  const rec = loadRecord();
  rec[r]++;
  save(REC, rec);
}
