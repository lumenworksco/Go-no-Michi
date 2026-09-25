// 棋譜（SGF）の書き出し。moves は着手の交点（パスは -1）。
import { BLACK, WHITE, type Color } from './board';
import { handicapPositions } from './game';

const L = 'abcdefghijklmnopqrst';
const pt = (size: number, idx: number) => L[idx % size] + L[Math.floor(idx / size)];

export interface SgfInput {
  size: number;
  komi: number;
  handicap: number;
  /** 最初に打つ色（置き碁なら白） */
  first: Color;
  moves: number[];
  /** 例: 'B+3.5', 'W+R', '0' */
  result?: string;
  blackName?: string;
  whiteName?: string;
}

export function toSgf(g: SgfInput): string {
  const head = [`GM[1]`, `FF[4]`, `CA[UTF-8]`, `AP[GoNoMichi]`, `SZ[${g.size}]`, `KM[${g.komi}]`, `RU[Japanese]`];
  if (g.blackName) head.push(`PB[${g.blackName}]`);
  if (g.whiteName) head.push(`PW[${g.whiteName}]`);
  if (g.handicap >= 2) {
    head.push(`HA[${g.handicap}]`, ...handicapPositions(g.size, g.handicap).map((i) => `AB[${pt(g.size, i)}]`));
  }
  if (g.result) head.push(`RE[${g.result}]`);
  let color: Color = g.first;
  const nodes = g.moves.map((m) => {
    const c = color === BLACK ? 'B' : 'W';
    color = color === BLACK ? WHITE : BLACK;
    return `;${c}[${m < 0 ? '' : pt(g.size, m)}]`;
  });
  return `(;${head.join('')}${nodes.join('')})`;
}
