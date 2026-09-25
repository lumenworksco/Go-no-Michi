import { BLACK, WHITE } from './board';
import type { GameState } from './game';
import { newGame } from './game';

/** X=黒, O=白, .=空 の図から盤面を作る（テスト・詰碁データ用）。 */
export function parseBoard(rows: string[]): { size: number; board: Uint8Array } {
  const size = rows.length;
  const board = new Uint8Array(size * size);
  rows.forEach((row, y) => {
    const cells = row.replace(/\s/g, '');
    if (cells.length !== size) throw new Error(`行 ${y} の長さが ${size} ではありません: "${row}"`);
    for (let x = 0; x < size; x++) {
      const ch = cells[x];
      board[y * size + x] = ch === 'X' ? BLACK : ch === 'O' ? WHITE : 0;
    }
  });
  return { size, board };
}

export function stateFrom(rows: string[], toPlay: 1 | 2 = BLACK, komi = 6.5): GameState {
  const { size, board } = parseBoard(rows);
  const s = newGame(size, komi);
  return { ...s, board, toPlay };
}

export const at = (size: number, x: number, y: number) => y * size + x;
