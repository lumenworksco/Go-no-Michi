import { newGame, playMove, passMove, isOver, scoreGame } from '../src/engine/game';
import { chooseMove, estimateDead, seededRng, type Level } from '../src/ai/mcts';
import { BLACK } from '../src/engine/board';

function game(size: number, black: Level, white: Level, seed: number) {
  let s = newGame(size, 6.5);
  const rng = seededRng(seed);
  let n = 0;
  let ms = 0;
  while (!isOver(s) && n < size * size * 3) {
    const lvl = s.toPlay === BLACK ? black : white;
    const t0 = performance.now();
    const r = chooseMove({ size, board: s.board, toPlay: s.toPlay, ko: s.ko, komi: s.komi, moveNo: s.moveNo, last: s.last, opponentPassed: s.passes === 1, level: lvl }, rng);
    ms += performance.now() - t0;
    if (r.move < 0) s = passMove(s);
    else {
      const m = playMove(s, r.move);
      if (!m.ok) throw new Error('illegal ' + r.move);
      s = m.state;
    }
    n++;
  }
  const dead = new Set(estimateDead(s.board, size, s.toPlay, rng));
  const sc = scoreGame(s, dead);
  return { winner: sc.winner, margin: sc.margin, moves: s.moveNo, avgMs: ms / n };
}

function main() {
  const size = Number(process.env.SZ ?? 9);
  const A = (process.env.A ?? 'chukyu') as Level;
  const B = (process.env.B ?? 'nyumon') as Level;
  const N = Number(process.env.N ?? 6);
  let aw = 0;
  for (let i = 0; i < N; i++) {
    const aBlack = i % 2 === 0;
    const r = game(size, aBlack ? A : B, aBlack ? B : A, 100 + i);
    const aWon = (r.winner === BLACK) === aBlack && r.winner !== 0;
    if (aWon) aw++;
    console.log(`game ${i}: A=${aBlack ? 'B' : 'W'} margin ${r.margin} moves ${r.moves} avg ${r.avgMs.toFixed(0)}ms -> ${aWon ? 'A' : 'B'}`);
  }
  console.log(`RESULT ${A} vs ${B} on ${size}: ${aw}/${N}`);
}
main();
