// 画面の指定と、戻る・進むの履歴から読み戻した状態の検査。
import type { SavedGame } from './save';
import type { GameSettings } from './settings';
import { PUZZLES, type Puzzle } from './tsumego/problems';

export type Route =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'rules' }
  | { name: 'settings' }
  | { name: 'game'; settings: GameSettings; run: number; resume?: SavedGame | null }
  | { name: 'tsumegoList' }
  | { name: 'tsumego'; puzzle: Puzzle };

export const HOME: Route = { name: 'home' };

/**
 * 履歴から読み戻した状態を、安全な画面指定にそろえる。
 * 対局画面は戻る・進むでは復元しない。進むボタンで古い対局の状態（保存より前の手数）が
 * よみがえって、新しい保存を上書きしてしまうのを防ぐため。対局へは、ホームの「つづきから」と
 * 設定画面の「はじめる」からだけ入る。
 */
export function routeFromHistory(state: unknown): Route {
  if (typeof state === 'object' && state !== null) {
    const r = state as { name?: unknown; puzzle?: { id?: unknown } };
    if (r.name === 'setup' || r.name === 'rules' || r.name === 'settings' || r.name === 'tsumegoList') return { name: r.name };
    if (r.name === 'tsumego') {
      const puzzle = PUZZLES.find((p) => p.id === r.puzzle?.id);
      if (puzzle) return { name: 'tsumego', puzzle };
    }
  }
  return HOME;
}
