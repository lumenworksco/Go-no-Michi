import { describe, expect, it } from 'vitest';
import { groupAt, EMPTY } from './engine/board';
import { DIAGRAMS } from './rulesDiagrams';

describe('遊び方の図', () => {
  for (const [name, d] of Object.entries(DIAGRAMS)) {
    it(`${name}: 呼吸点0の石がなく、印は空点にある`, () => {
      for (let i = 0; i < d.board.length; i++) {
        if (d.board[i] !== EMPTY) expect(groupAt(d.board, 9, i).liberties.length).toBeGreaterThan(0);
      }
      for (const p of d.dots ?? []) expect(d.board[p]).toBe(EMPTY);
      if (d.ko !== undefined) expect(d.board[d.ko]).toBe(EMPTY);
    });
  }
  it('capture: 白1子の呼吸点は緑の点の1つだけ', () => {
    const d = DIAGRAMS.capture;
    const white = d.board.findIndex((v) => v === 2);
    expect(groupAt(d.board, 9, white).liberties).toEqual(d.dots);
  });
  it('liberty: 印は黒石の呼吸点そのもの', () => {
    const d = DIAGRAMS.liberty;
    const black = d.board.findIndex((v) => v === 1);
    expect([...groupAt(d.board, 9, black).liberties].sort()).toEqual([...(d.dots ?? [])].sort());
  });
});
