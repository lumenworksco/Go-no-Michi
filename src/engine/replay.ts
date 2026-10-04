// 読みこんだ棋譜（ParsedSgf）を、一手ずつの局面の列にする。再生（きふを みる）用。
import { BLACK, WHITE, type Color } from './board';
import { newGame, passMove, playMove, type GameState } from './game';
import type { ParsedSgf } from './sgfParse';

export interface ReplaySnap {
  state: GameState;
  /** この局面に至った着手の交点（パスは -1、開始局面は -2） */
  move: number;
  /** 着手した色（開始局面では BLACK とする） */
  color: Color;
}

export interface Replay {
  snaps: ReplaySnap[];
  /** 打てない手のところで再生を打ち切ったとき、その着手が何手目か（1 始まり）。最後まで進めたら null。 */
  stoppedAt: number | null;
}

export function buildReplay(g: ParsedSgf): Replay {
  const base = newGame(g.size, g.komi, 0);
  const board = base.board.slice();
  for (const p of g.setupBlack) board[p] = BLACK;
  for (const p of g.setupWhite) board[p] = WHITE;
  let s: GameState = { ...base, board, toPlay: g.moves[0]?.color ?? (g.setupBlack.length > 0 ? WHITE : BLACK) };
  const snaps: ReplaySnap[] = [{ state: s, move: -2, color: BLACK }];
  let stoppedAt: number | null = null;
  for (let i = 0; i < g.moves.length; i++) {
    const { color, point } = g.moves[i];
    // 着手の色は棋譜の指定にしたがう（置き碁・連続して同じ色、などがありうる）。コウの禁止は見ない。
    const before = { ...s, toPlay: color, ko: -1, passes: 0 };
    if (point < 0) {
      s = passMove(before);
    } else {
      const r = playMove(before, point);
      if (!r.ok) {
        stoppedAt = i + 1;
        break;
      }
      s = r.state;
    }
    snaps.push({ state: s, move: point, color });
  }
  return { snaps, stoppedAt };
}
