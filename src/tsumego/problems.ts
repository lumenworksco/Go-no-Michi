// 詰碁の問題。すべて「黒先、白を取れ」。図は左上隅の 6×5（黒の外壁つき）。
// 出題の正しさは problems.test.ts が全幅探索で証明する（何手で取れるか・他に手が無いか）。
import { BLACK } from '../engine/board';
import { newGame, type GameState } from '../engine/game';
import { parseBoard } from '../engine/testutil';
import type { SolveSpec, Window } from './solver';

export interface Puzzle {
  id: number;
  /** 何手で取れるか（黒の手数） */
  moves: 1 | 2 | 3;
  rows: string[];
  /** 取る対象の白石（x, y） */
  target: [number, number];
}

/** 打てる範囲（外壁を除く）。 */
export const WINDOW: Window = { x0: 0, y0: 0, x1: 4, y1: 3 };
/** 表示する範囲（外壁を含む）。 */
export const CROP: Window = { x0: 0, y0: 0, x1: 5, y1: 4 };
export const PUZZLE_BOARD_SIZE = 9;

// id は保存された進捗（解決済み）と対応するので、一度決めたら変えない。表示の「第N問」は並び順。
const LIST: Puzzle[] = [
  { id: 1, moves: 1, rows: ['.X...X', 'XOX..X', '.....X', '.....X', 'XXXXXX'], target: [1, 1] },
  { id: 2, moves: 1, rows: ['.XX..X', 'XOOX.X', '..X..X', '.....X', 'XXXXXX'], target: [1, 1] },
  { id: 18, moves: 1, rows: ['XXOOXX','.XXOXX','X....X','XXX..X','XXXXXX'], target: [2,0] },
  { id: 19, moves: 1, rows: ['XX..XX','..XXXX','XOX..X','XOOX.X','XXXXXX'], target: [1,2] },
  { id: 20, moves: 1, rows: ['.XOOOX','XX.OOX','.XXXOX','XXXXXX','XXXXXX'], target: [2,0] },
  { id: 21, moves: 1, rows: ['X.XXXX','OXX.XX','OOOOXX','XXOOOX','XXXXXX'], target: [0,1] },
  { id: 3, moves: 2, rows: ['...OOX', 'XXOOXX', 'XXX.XX', 'XXX.XX', 'XXXXXX'], target: [3, 0] },
  { id: 4, moves: 2, rows: ['XXXOXX', 'XXOOOX', '..O.OX', 'XXX.XX', 'XXXXXX'], target: [3, 0] },
  { id: 5, moves: 2, rows: ['X.OOOX', 'X..OOX', '.X.XXX', 'X.XX.X', 'XXXXXX'], target: [2, 0] },
  { id: 11, moves: 2, rows: ['.OX..X', 'XOXXXX', 'OOXX.X', 'O..X.X', 'XXXXXX'], target: [1, 0] },
  { id: 12, moves: 2, rows: ['X...XX', 'XX...X', 'XOOX.X', '..OXXX', 'XXXXXX'], target: [1, 2] },
  { id: 23, moves: 2, rows: ['.OOX.X','.XO.XX','X.X.XX','X.XX.X','XXXXXX'], target: [1,0] },
  { id: 24, moves: 2, rows: ['XX.OXX','.XXO.X','XOOOXX','XXXOOX','XXXXXX'], target: [3,0] },
  { id: 26, moves: 2, rows: ['.OOXXX','OOXX.X','XOX.XX','XOOOXX','XXXXXX'], target: [1,0] },
  { id: 27, moves: 2, rows: ['.OXXXX','OOX.XX','X.X..X','XX.X.X','XXXXXX'], target: [1,0] },
  { id: 28, moves: 2, rows: ['X....X','XXXOXX','.OOOXX','OOOXXX','XXXXXX'], target: [3,1] },
  { id: 30, moves: 2, rows: ['...XXX','.X.OOX','....OX','X.XOOX','XXXXXX'], target: [3,1] },
  { id: 6, moves: 3, rows: ['XOXXXX', '.OXXXX', '.OX..X', '.OX..X', 'XXXXXX'], target: [1, 0] },
  { id: 7, moves: 3, rows: ['....OX', 'XOOOOX', '.XXXXX', 'XX.XXX', 'XXXXXX'], target: [4, 0] },
  { id: 8, moves: 3, rows: ['XXXXXX', '..OO.X', 'X.XO.X', 'XXXOOX', 'XXXXXX'], target: [2, 1] },
  { id: 9, moves: 3, rows: ['.XXOOX', '..XO.X', '...OOX', 'XX..OX', 'XXXXXX'], target: [3, 0] },
  { id: 10, moves: 3, rows: ['X.XX.X', '..X.XX', 'XOOX.X', '.O.X.X', 'XXXXXX'], target: [1, 2] },
  { id: 13, moves: 3, rows: ['OOOOXX', '.XXO.X', '.X...X', 'XX.X.X', 'XXXXXX'], target: [0, 0] },
  { id: 14, moves: 3, rows: ['XX.OOX', 'XXX.OX', 'X....X', 'X..X.X', 'XXXXXX'], target: [3, 0] },
  { id: 15, moves: 3, rows: ['OOOXXX', 'O.OO.X', '..XX.X', 'XX..XX', 'XXXXXX'], target: [0, 0] },
  { id: 16, moves: 3, rows: ['X.O..X', 'XOOOXX', 'XXXOOX', '....XX', 'XXXXXX'], target: [2, 0] },
  { id: 17, moves: 3, rows: ['.OX.XX','XOOX.X','XX..XX','....XX','XXXXXX'], target: [1,0] },
  { id: 22, moves: 3, rows: ['..XX.X','OOOX.X','XX...X','.X..XX','XXXXXX'], target: [0,1] },
  { id: 25, moves: 3, rows: ['..XX.X','XOO.XX','XOX.XX','...X.X','XXXXXX'], target: [1,1] },
  { id: 29, moves: 3, rows: ['XX...X','..XXXX','..OO.X','OOOOOX','XXXXXX'], target: [2,2] },
];

export const PUZZLES: Puzzle[] = LIST;

/** 「第N問」に表示する番号（並び順） */
export const puzzleNumber = (p: Puzzle) => PUZZLES.findIndex((q) => q.id === p.id) + 1;

export function puzzleState(p: Puzzle): GameState {
  const size = PUZZLE_BOARD_SIZE;
  const full = Array.from({ length: size }, (_, y) => (p.rows[y] ?? '').padEnd(size, '.').slice(0, size));
  const { board } = parseBoard(full);
  return { ...newGame(size, 0), board, toPlay: BLACK };
}

export function puzzleSpec(p: Puzzle): SolveSpec {
  return { targets: [p.target[1] * PUZZLE_BOARD_SIZE + p.target[0]], mode: 'all', window: WINDOW, attacker: BLACK };
}
