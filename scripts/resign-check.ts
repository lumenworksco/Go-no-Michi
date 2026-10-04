// 投了の判断が、実際の対局で働くかを確かめる道具: 中級（黒）対 初級（白）で、初級の勝率の見積もりと、投了の時点を出す。
//   SZ=9 N=3 npx tsx scripts/resign-check.ts
import { newGame, playMove, passMove, isOver, scoreGame } from '../src/engine/game';
import { chooseMove, seededRng, estimateDead } from '../src/ai/mcts';
import { RESIGN_STREAK, shouldResign } from '../src/ai/resign';
import { BLACK } from '../src/engine/board';

const size = Number(process.env.SZ ?? 9);
const N = Number(process.env.N ?? 3);
for (let g = 0; g < N; g++) {
  const rng = seededRng(500 + g);
  let s = newGame(size, 6.5);
  const recent: number[] = [];
  let resignedAt = -1;
  const rates: string[] = [];
  while (!isOver(s) && s.moveNo < size * size * 3) {
    const black = s.toPlay === BLACK;
    const r = chooseMove({ size, board: s.board, toPlay: s.toPlay, ko: s.ko, komi: s.komi, moveNo: s.moveNo, last: s.last, opponentPassed: s.passes === 1, level: black ? 'chukyu' : 'shokyu' }, rng);
    if (!black) {
      recent.push(r.winrate);
      if (recent.length > RESIGN_STREAK) recent.shift();
      rates.push(r.winrate.toFixed(2));
      if (resignedAt < 0 && shouldResign(recent, { moveNo: s.moveNo, size, level: 'shokyu' })) resignedAt = s.moveNo;
    }
    s = r.move < 0 ? passMove(s) : (playMove(s, r.move) as { ok: true; state: typeof s }).state;
  }
  const sc = scoreGame(s, new Set(estimateDead(s.board, size, s.toPlay, rng)));
  console.log(`game ${g}: moves ${s.moveNo}, margin(黒-白) ${sc.margin}, 白(初級)が投了する手: ${resignedAt}`);
  console.log('  白の勝率の見積もり:', rates.join(' '));
}
