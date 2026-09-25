import { describe, expect, it } from 'vitest';
import { BLACK } from '../engine/board';
import { newGame, playMove, passMove, isOver, type GameState } from '../engine/game';
import { at, stateFrom } from '../engine/testutil';
import { chooseMove, estimateDead, seededRng, type Level } from './mcts';

function ask(s: GameState, level: Level, seed = 1, opponentPassed = false) {
  return chooseMove(
    { size: s.size, board: s.board, toPlay: s.toPlay, ko: s.ko, komi: s.komi, moveNo: s.moveNo, last: s.last, opponentPassed, level },
    seededRng(seed),
  );
}

describe('AI', () => {
  it('自己対戦で反則の手を打たない', () => {
    let s = newGame(9);
    const rng = seededRng(7);
    for (let i = 0; i < 60 && !isOver(s); i++) {
      const r = chooseMove(
        { size: 9, board: s.board, toPlay: s.toPlay, ko: s.ko, komi: 6.5, moveNo: s.moveNo, last: s.last, opponentPassed: s.passes === 1, level: 'nyumon' },
        rng,
      );
      if (r.move < 0) s = passMove(s);
      else {
        const m = playMove(s, r.move);
        expect(m.ok).toBe(true);
        if (!m.ok) return;
        s = m.state;
      }
    }
  });

  it('相手がパスして自分が勝っているならパスする', () => {
    const s = stateFrom(
      [
        'XXXXXXXXX',
        'X.X.X.X.X',
        'XXXXXXXXX',
        'XOOOOOOOO',
        'XO.O.O.OO',
        'XOOOOOOOO',
        'XO.O.O.OO',
        'XOOOOOOOO',
        'XXXXXXXXX',
      ],
      BLACK,
      0,
    );
    // 黒は眼の中しか打つ手がない（自分の眼は打たない）ため、パスが返る
    const r = ask(s, 'shokyu', 1, true);
    expect(r.move).toBe(-1);
  });
});

describe('死に石の推定', () => {
  it('黒の陣地に残された白の1子は死に石', () => {
    const rows = [
      'XXXXXXXXX',
      'XX.X.XX.X',
      'XXXXXXXXX',
      'XXXX.XXXX',
      'XXXXOXXXX',
      'XXXXXXXXX',
      'XX.XXX.XX',
      'XXXXXXXXX',
      'XXXXXXXXX',
    ];
    const s = stateFrom(rows, BLACK);
    const dead = estimateDead(s.board, 9, BLACK, seededRng(3));
    expect(dead).toEqual([at(9, 4, 4)]);
  });
});
