// AI との対局が、かならず終局まで進むこと（二人とも打つ手がなくなれば、パスで終わること）を確かめる。
import { describe, expect, it } from 'vitest';
import { BLACK, EMPTY } from '../engine/board';
import { isOver, legalMoves, newGame, passMove, playMove, type GameState } from '../engine/game';
import { chooseMove, seededRng, type Level } from './mcts';

const ask = (s: GameState, level: Level, rng: () => number) =>
  chooseMove({ size: s.size, board: s.board, toPlay: s.toPlay, ko: s.ko, komi: s.komi, moveNo: s.moveNo, last: s.last, opponentPassed: s.passes === 1, level }, rng);

function apply(s: GameState, move: number): GameState {
  if (move < 0) return passMove(s);
  const r = playMove(s, move);
  if (!r.ok) throw new Error(`illegal ${move}: ${r.reason}`);
  return r.state;
}

describe('終局まで進む', () => {
  // shokyu 以上は 1 手ごとに最長 1.5〜3 秒かかるので、ここでは入門だけ（強さの確認は npm run arena）
  for (const [level, seeds] of [['nyumon', [1, 2, 3]]] as [Level, number[]][]) {
    it(`AI 同士（${level}・9路）が上限の手数までに終局する`, () => {
      for (const seed of seeds) {
        const rng = seededRng(seed);
        let s = newGame(9);
        let n = 0;
        while (!isOver(s) && n < 9 * 9 * 3) {
          s = apply(s, ask(s, level, rng).move);
          n++;
        }
        expect(isOver(s), `${level} seed ${seed}: ${n} 手で終わらなかった`).toBe(true);
      }
    }, 60_000);
  }

  it('人が途中からパスしかしないとき、AI も打ち続けずにパスして終わる', () => {
    const rng = seededRng(11);
    let s = newGame(9);
    let n = 0;
    // 人（黒）は 12 手打ったあと、パスだけ。AI（白）は nyumon。
    let humanMoves = 0;
    while (!isOver(s) && n < 200) {
      if (s.toPlay === BLACK) {
        if (humanMoves < 12) {
          const legal = legalMoves(s);
          s = apply(s, legal[(rng() * legal.length) | 0]);
          humanMoves++;
        } else s = passMove(s);
      } else s = apply(s, ask(s, 'nyumon', rng).move);
      n++;
    }
    expect(isOver(s), `${n} 手で終わらなかった`).toBe(true);
    expect(s.board.some((v) => v === EMPTY)).toBe(true);
  }, 60_000);
});
