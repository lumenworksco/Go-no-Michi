// 詰碁の候補を作る道具。ランダムな形を作り、全幅探索（solver.ts）で「黒先で N 手で取れる・唯一の正解手」と
// 証明できたものだけを出力する。出力を src/tsumego/problems.ts の LIST に貼り、problems.test.ts で再確認する。
//   npx tsx scripts/gen-puzzles.ts            （SEED, SECONDS, ONE, TWO, THREE で調整）
import { groupAt, libertyCount } from '../src/engine/board';
import { seededRng } from '../src/ai/mcts';
import { PUZZLES, puzzleState, type Puzzle } from '../src/tsumego/problems';
import { puzzleSolver } from '../src/tsumego/solver';

const rng = seededRng(Number(process.env.SEED ?? 20260704));
const seconds = Number(process.env.SECONDS ?? 60);
const want: Record<number, number> = { 1: Number(process.env.ONE ?? 4), 2: Number(process.env.TWO ?? 6), 3: Number(process.env.THREE ?? 4) };
const got: Record<number, Puzzle[]> = { 1: [], 2: [], 3: [] };
const COLS = 6;
const ROWS = 5;

const key = (rows: string[]) => rows.join('/');
const seen = new Set(PUZZLES.map((p) => key(p.rows)));
let nextId = Math.max(...PUZZLES.map((p) => p.id)) + 1;

function candidate(): string[] {
  const pBlack = 0.3 + rng() * 0.25;
  const pWhite = 0.2 + rng() * 0.2;
  const rows: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let row = '';
    for (let x = 0; x < COLS; x++) {
      if (x === COLS - 1 || y === ROWS - 1) row += 'X'; // 外壁
      else {
        const r = rng();
        row += r < pWhite ? 'O' : r < pWhite + pBlack ? 'X' : '.';
      }
    }
    rows.push(row);
  }
  return rows;
}

const start = Date.now();
let tried = 0;
while (Date.now() - start < seconds * 1000 && Object.keys(want).some((k) => got[Number(k)].length < want[Number(k)])) {
  tried++;
  const rows = candidate();
  if (seen.has(key(rows))) continue;
  const whites: [number, number][] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (rows[y][x] === 'O') whites.push([x, y]);
  if (whites.length < 3 || whites.length > 8) continue;
  const probe: Puzzle = { id: 0, moves: 3, rows, target: whites[0] };
  const s0 = puzzleState(probe);
  // 白は一つの連だけ、どの連にも呼吸点がある
  const chain = groupAt(s0.board, s0.size, whites[0][1] * s0.size + whites[0][0]);
  if (chain.stones.length !== whites.length) continue;
  let dead = false;
  for (let i = 0; i < s0.board.length && !dead; i++) if (s0.board[i] && libertyCount(s0.board, s0.size, i) === 0) dead = true;
  if (dead) continue;
  const libs = chain.liberties.length;
  if (libs === 0) continue;
  const solver = puzzleSolver(probe);
  let moves = 0;
  for (let k = 1; k <= 3; k++) {
    if (solver.minMoves(s0, k) === k) {
      moves = k;
      break;
    }
  }
  if (!moves || got[moves].length >= want[moves]) continue;
  // 1 手で取れる問題は、アタリ（呼吸点 1）のはず。2・3 手の問題は、最初はアタリでないものだけ（読みが要る）
  if (moves === 1 ? libs !== 1 : libs < 2) continue;
  const first = solver.correctMoves(s0, moves);
  if (first.length !== 1) continue; // 正解が一つに決まるものだけ
  // 黒が自分の連を作れていること（黒石が 3 つ以上）
  if (rows.join('').split('').filter((c) => c === 'X').length < 12) continue;
  seen.add(key(rows));
  got[moves].push({ id: nextId++, moves: moves as 1 | 2 | 3, rows, target: whites[0] });
}

console.log(`// ${tried} 候補を試した`);
for (const m of [1, 2, 3]) {
  for (const p of got[m]) console.log(`  { id: ${p.id}, moves: ${p.moves}, rows: ${JSON.stringify(p.rows).replace(/"/g, "'")}, target: [${p.target}] },`);
}
