// 盤の大きさごとの AI の応答時間を測る。 npx tsx scripts/bench.ts
import { newGame, playMove } from '../src/engine/game';
import { chooseMove, seededRng, LEVELS, type Level } from '../src/ai/mcts';

for (const size of [9, 13, 19]) {
  let s = newGame(size, 6.5);
  const rng = seededRng(5);
  for (let i = 0; i < size * 2; i++) {
    const r = chooseMove({ size, board: s.board, toPlay: s.toPlay, ko: s.ko, komi: 6.5, moveNo: s.moveNo, last: s.last, opponentPassed: false, level: 'nyumon' }, rng);
    if (r.move < 0) break;
    const m = playMove(s, r.move);
    if (!m.ok) break;
    s = m.state;
  }
  for (const level of Object.keys(LEVELS) as Level[]) {
    const t = performance.now();
    const r = chooseMove({ size, board: s.board, toPlay: s.toPlay, ko: s.ko, komi: 6.5, moveNo: s.moveNo, last: s.last, opponentPassed: false, level }, rng);
    console.log(`${size}路 ${level}: ${(performance.now() - t).toFixed(0)}ms move=${r.move} wr=${r.winrate.toFixed(2)}`);
  }
}
