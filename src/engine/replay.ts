// 読みこんだ棋譜（ParsedSgf）を、一手ずつの局面の列にする。再生（きふを みる）用。
import { BLACK, WHITE, type Color } from './board';
import { newGame, passMove, playMove, type GameState } from './game';
import type { ParsedSgf, SgfNode } from './sgfParse';

export interface ReplaySnap {
  state: GameState;
  /** この局面に至った着手の交点（パスは -1、開始局面は -2） */
  move: number;
  /** 着手した色（開始局面では BLACK とする） */
  color: Color;
}

export interface Replay {
  snaps: ReplaySnap[];
  /** snaps[i] に対応する木の節（line[0] は根）。変化の候補やコメントを調べるのに使う。 */
  line: SgfNode[];
  /** 打てない手のところで再生を打ち切ったとき、その着手が何手目か（1 始まり）。最後まで進めたら null。 */
  stoppedAt: number | null;
}

/**
 * 木をたどって一手ずつの局面の列にする。変化の分かれ目（節の番号 → 何番めの候補か）は choices で選ぶ。
 * 指定がなければ、いつも先頭（本筋）をたどる。
 */
export function buildReplay(g: ParsedSgf, choices: Readonly<Record<number, number>> = {}): Replay {
  const base = newGame(g.size, g.komi, 0);
  const board = base.board.slice();
  for (const p of g.setupBlack) board[p] = BLACK;
  for (const p of g.setupWhite) board[p] = WHITE;
  const firstMove = g.tree.children[0]?.move;
  let s: GameState = { ...base, board, toPlay: firstMove?.color ?? (g.setupBlack.length > 0 ? WHITE : BLACK) };
  const snaps: ReplaySnap[] = [{ state: s, move: -2, color: BLACK }];
  const line: SgfNode[] = [g.tree];
  let stoppedAt: number | null = null;
  let node = g.tree;
  for (let i = 0; ; i++) {
    const next = node.children[choices[i] ?? 0] ?? node.children[0];
    if (!next || !next.move) break;
    const { color, point } = next.move;
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
    line.push(next);
    node = next;
  }
  return { snaps, line, stoppedAt };
}
