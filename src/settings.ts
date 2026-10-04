// 対局の設定。localStorage から読むときは、こわれた値や古い形式の値をそのまま使わず、検査して捨てる。
import { BLACK, WHITE, type Color } from './engine/board';
import { maxHandicap } from './engine/game';
import { LEVELS, type Level } from './ai/mcts';
import { load } from './store';

export interface GameSettings {
  size: 9 | 13 | 19;
  mode: 'ai' | 'local';
  level: Level;
  /** 人間の色。random は開始時に決める */
  color: Color | 'random';
  handicap: number;
  komi: number;
}

export const DEFAULT_SETTINGS: GameSettings = { size: 9, mode: 'ai', level: 'shokyu', color: BLACK, handicap: 0, komi: 6.5 };

export const SETTINGS_KEY = 'gonomichi:settings';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 設定として完全に正しいときだけ返す。一つでもおかしければ null。 */
export function parseSettings(raw: unknown): GameSettings | null {
  if (!isObj(raw)) return null;
  const { size, mode, level, color, handicap, komi } = raw;
  if (size !== 9 && size !== 13 && size !== 19) return null;
  if (mode !== 'ai' && mode !== 'local') return null;
  if (typeof level !== 'string' || !Object.prototype.hasOwnProperty.call(LEVELS, level)) return null;
  if (color !== BLACK && color !== WHITE && color !== 'random') return null;
  if (typeof handicap !== 'number' || !Number.isInteger(handicap) || handicap < 0 || handicap === 1 || handicap > maxHandicap(size)) return null;
  if (typeof komi !== 'number' || !Number.isFinite(komi) || komi < 0 || komi > 30) return null;
  return { size, mode, level: level as Level, color, handicap, komi };
}

/** 保存された設定にデフォルトを重ねる。おかしければデフォルトに戻す。 */
export function loadSettings(): GameSettings {
  const stored = load<unknown>(SETTINGS_KEY, {});
  return parseSettings({ ...DEFAULT_SETTINGS, ...(isObj(stored) ? stored : {}) }) ?? { ...DEFAULT_SETTINGS };
}
