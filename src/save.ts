import type { Color } from './engine/board';
import { parseSettings, type GameSettings } from './settings';
import { load, remove, save } from './store';

export interface SavedGame {
  settings: GameSettings;
  human: Color;
  /** 着手の交点。パスは -1 */
  moves: number[];
  /** まった・ヒントを使った（せいせきに入れない） */
  assisted?: boolean;
}

const KEY = 'gonomichi:save';
const REC = 'gonomichi:record';

/** 保存された対局として使える形か（設定が正しく、着手が盤の中に収まっているか）。 */
export function parseSavedGame(raw: unknown): SavedGame | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const g = raw as Partial<Record<keyof SavedGame, unknown>>;
  const settings = parseSettings(g.settings);
  if (!settings) return null;
  if (g.human !== 1 && g.human !== 2) return null;
  if (!Array.isArray(g.moves)) return null;
  const points = settings.size * settings.size;
  for (const m of g.moves) if (typeof m !== 'number' || !Number.isInteger(m) || m < -1 || m >= points) return null;
  if (g.assisted !== undefined && typeof g.assisted !== 'boolean') return null;
  return { settings, human: g.human, moves: g.moves as number[], ...(g.assisted ? { assisted: true } : {}) };
}

export const loadSavedGame = (): SavedGame | null => parseSavedGame(load<unknown>(KEY, null));
export const storeSavedGame = (g: SavedGame) => save(KEY, g);
export const clearSavedGame = () => remove(KEY);

/**
 * 対局の自動保存。終局したとき、または一手も打っていない（待ったで最初まで戻した）ときは
 * 保存を消す。そうしないと、戻した後も古い対局が「つづきから」に残ってしまう。
 */
export function persistProgress(game: SavedGame, finished: boolean) {
  if (finished || game.moves.length === 0) clearSavedGame();
  else storeSavedGame(game);
}

export interface Record3 {
  win: number;
  lose: number;
  draw: number;
}
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
export function loadRecord(): Record3 {
  const r = load<unknown>(REC, {}) as Partial<Record<keyof Record3, unknown>> | null;
  return { win: count(r?.win), lose: count(r?.lose), draw: count(r?.draw) };
}
export const resetRecord = () => remove(REC);
export function addRecord(r: 'win' | 'lose' | 'draw') {
  const rec = loadRecord();
  rec[r]++;
  save(REC, rec);
}

/** つめごの「せいかい」の記録。数のならび以外は捨てる。 */
export const SOLVED_KEY = 'gonomichi:tsumego';
export const loadSolved = (): number[] =>
  load<number[]>(SOLVED_KEY, [], (v): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x)));
export const storeSolved = (ids: number[]) => save(SOLVED_KEY, ids);
export const resetSolved = () => remove(SOLVED_KEY);
