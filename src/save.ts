import type { Color } from './engine/board';
import { parseSettings, type GameSettings } from './settings';
import { load, remove, save } from './store';

export interface SavedGame {
  /** この保存の名前（ほかの保存と区別する）。 */
  id: string;
  /** 最後に保存した時刻（ミリ秒）。新しい順に並べるのに使う。 */
  updatedAt: number;
  settings: GameSettings;
  human: Color;
  /** 着手の交点。パスは -1 */
  moves: number[];
  /** まった・ヒントを使った（せいせきに入れない） */
  assisted?: boolean;
}

/** 新しい対局に付ける保存の名前。 */
export const newSaveId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** 同時に残しておける対局の数。あふれたら、いちばん古い保存から消える。 */
export const MAX_SAVES = 5;

const KEY = 'gonomichi:saves';
/** 保存が 1 つだけだった古い版の置き場所。見つかれば、新しい形に移す。 */
const LEGACY_KEY = 'gonomichi:save';
const REC = 'gonomichi:record';

/** 保存された対局として使える形か（設定が正しく、着手が盤の中に収まっているか）。id と時刻が無い古い形も受けつける。 */
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
  const id = typeof g.id === 'string' && g.id ? g.id : newSaveId();
  const updatedAt = typeof g.updatedAt === 'number' && Number.isFinite(g.updatedAt) ? g.updatedAt : 0;
  return { id, updatedAt, settings, human: g.human, moves: g.moves as number[], ...(g.assisted ? { assisted: true } : {}) };
}

const writeSaves = (list: SavedGame[]) => save(KEY, list);

/** 保存されている対局を、新しい順に返す。こわれたものは捨てる。 */
export function loadSavedGames(): SavedGame[] {
  const raw = load<unknown>(KEY, []);
  const list = (Array.isArray(raw) ? raw : []).map(parseSavedGame).filter((g): g is SavedGame => g !== null);
  // 古い版の「保存が 1 つ」を取りこむ
  const legacy = parseSavedGame(load<unknown>(LEGACY_KEY, null));
  if (legacy) {
    list.push({ ...legacy, updatedAt: legacy.updatedAt || Date.now() });
    writeSaves(list);
  }
  remove(LEGACY_KEY); // 読めなかったもの（こわれたデータ）も、ここで片づける
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 保存を追加・更新する（同じ id は上書き）。数が MAX_SAVES をこえたら、いちばん古いものを消す。 */
export function storeSavedGame(g: SavedGame) {
  const list = loadSavedGames().filter((x) => x.id !== g.id);
  list.push({ ...g, updatedAt: Date.now() });
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  writeSaves(list.slice(0, MAX_SAVES));
}

export function deleteSavedGame(id: string) {
  writeSaves(loadSavedGames().filter((x) => x.id !== id));
}

/**
 * 対局の自動保存。終局したとき、または一手もない（待ったで最初まで戻した）ときは、その保存を消す。
 * そうしないと、戻した後も古い対局が「つづきから」に残ってしまう。
 */
export function persistProgress(game: SavedGame, finished: boolean) {
  if (finished || game.moves.length === 0) deleteSavedGame(game.id);
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
