import { describe, expect, it } from 'vitest';
import { BLACK, EMPTY, WHITE, isLegalPlacement, placeStone, type Color } from './board';
import { handicapPositions, isOver, newGame, passMove, playMove, scoreGame, type GameState } from './game';
import { seededRng } from '../ai/mcts';
import { at, stateFrom } from './testutil';

/** ランダムに合法手だけを打って、いろいろな局面を作る。 */
function randomPosition(size: number, moves: number, seed: number): GameState {
  const rng = seededRng(seed);
  let s = newGame(size);
  for (let i = 0; i < moves; i++) {
    const empties: number[] = [];
    for (let p = 0; p < s.board.length; p++) if (s.board[p] === EMPTY) empties.push(p);
    for (let tries = 0; tries < 30; tries++) {
      const r = playMove(s, empties[(rng() * empties.length) | 0]);
      if (r.ok) {
        s = r.state;
        break;
      }
    }
  }
  return s;
}

describe('isLegalPlacement は placeStone と食い違わない（AI はこの判定に頼っている）', () => {
  for (const size of [5, 9]) {
    it(`${size}路・ランダムな局面`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const s = randomPosition(size, size * size, seed);
        for (const color of [BLACK, WHITE] as Color[]) {
          for (let p = 0; p < s.board.length; p++) {
            const copy = s.board.slice();
            const placed = placeStone(copy, size, p, color) !== null;
            expect(isLegalPlacement(s.board, size, p, color), `seed ${seed} 点 ${p} 色 ${color}`).toBe(placed);
          }
        }
      }
    });
  }
});

describe('コウの境目', () => {
  it('1子を取っても、自分の石がつながって2子以上ならコウではない', () => {
    const s = stateFrom(['.XX..', 'XO...', '.X...', '.....', '.....'], BLACK);
    const r = playMove(s, at(5, 2, 1));
    expect(r.ok && r.captured).toEqual([at(5, 1, 1)]);
    expect(r.ok && r.state.ko).toBe(-1);
  });

  it('2子を一度に取ってもコウではない', () => {
    const s = stateFrom(['.OOX.', 'XXX..', '.....', '.....', '.....'], BLACK);
    const r = playMove(s, at(5, 0, 0));
    expect(r.ok && r.captured.length).toBe(2);
    expect(r.ok && r.state.ko).toBe(-1);
  });

  it('パスでコウの禁止は解ける', () => {
    let s = stateFrom(['.XO......', 'XO.O.....', '.XO......', '.........', '.........', '.........', '.........', '.........', '.........'], BLACK);
    const r = playMove(s, at(9, 2, 1));
    if (!r.ok) throw new Error('illegal');
    s = passMove(r.state);
    expect(s.ko).toBe(-1);
  });
});

describe('置き碁の石の位置', () => {
  const xy = (size: number, pts: number[]) => pts.map((p) => [p % size, Math.floor(p / size)]);
  it('9路：2〜5子', () => {
    expect(xy(9, handicapPositions(9, 2))).toEqual([[6, 2], [2, 6]]);
    expect(xy(9, handicapPositions(9, 3))).toEqual([[6, 2], [2, 6], [6, 6]]);
    expect(xy(9, handicapPositions(9, 4))).toEqual([[6, 2], [2, 6], [6, 6], [2, 2]]);
    expect(xy(9, handicapPositions(9, 5))).toContainEqual([4, 4]);
  });
  it('19路：4隅・6子（左右の辺）・9子（天元も）', () => {
    const four = xy(19, handicapPositions(19, 4));
    expect(four).toEqual([[15, 3], [3, 15], [15, 15], [3, 3]]);
    const six = xy(19, handicapPositions(19, 6));
    expect(six).toContainEqual([3, 9]);
    expect(six).toContainEqual([15, 9]);
    expect(six).not.toContainEqual([9, 9]); // 6子は天元なし
    const nine = xy(19, handicapPositions(19, 9));
    expect(nine).toContainEqual([9, 9]);
    expect(new Set(nine.map(String)).size).toBe(9);
  });
  it('置き石はすべて星の位置（盤の中）にある', () => {
    for (const size of [9, 13, 19]) {
      for (let n = 2; n <= (size === 9 ? 5 : 9); n++) {
        for (const p of handicapPositions(size, n)) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThan(size * size);
        }
      }
    }
  });
});

describe('地の数え方の境目', () => {
  it('死に石として指定しないかぎり、中に相手の石がある空点は地にならない', () => {
    const s = stateFrom(['XXXXX', 'X.O.X', 'XXXXX', '.....', '.....'], BLACK, 0);
    // 白石のまわりの 2 点は白石にも接するので地ではない。下の 10 点は黒だけに接する
    expect(scoreGame(s, new Set()).territory[BLACK]).toBe(10);
    const r = scoreGame(s, new Set([at(5, 2, 1)]));
    expect(r.territory[BLACK]).toBe(3 + 10); // 白石を取り除くと、中の 3 点も黒の地になる
    expect(r.prisoners[BLACK]).toBe(1);
  });

  it('終局後は着手できない', () => {
    let s = newGame(9);
    s = passMove(passMove(s));
    expect(isOver(s)).toBe(true);
    expect(playMove(s, 0)).toEqual({ ok: false, reason: 'over' });
  });
});
