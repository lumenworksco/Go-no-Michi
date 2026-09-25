// 遊び方の図。呼吸点は緑の点、コウで打てない点は赤い四角で示す。
import { parseBoard } from './engine/testutil';

const P = (x: number, y: number) => y * 9 + x;

function pad(rows: string[]) {
  return parseBoard(Array.from({ length: 9 }, (_, y) => (rows[y] ?? '').padEnd(9, '.'))).board;
}

export interface Diagram {
  board: Uint8Array;
  dots?: number[];
  ko?: number;
  last?: number;
}

export const DIAGRAMS: Record<string, Diagram> = {
  liberty: { board: pad(['', '', '..X']), dots: [P(1, 2), P(2, 1), P(3, 2), P(2, 3)] },
  // 白1子に呼吸点が1つだけ残った形（(1,3) に黒が打つと取れる）
  capture: { board: pad(['', '.X', 'XOX']), dots: [P(1, 3)] },
  // 黒が (2,1) で白1子を取った直後。白は (1,1) にすぐ取り返せない
  ko: { board: pad(['.XO', 'X.XO', '.XO']), ko: P(1, 1), last: P(2, 1) },
};
