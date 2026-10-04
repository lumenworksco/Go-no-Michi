import { describe, expect, it } from 'vitest';
import { BLACK, WHITE, EMPTY } from './board';
import { buildReplay } from './replay';
import { parseSgf } from './sgfParse';

const replay = (sgf: string) => {
  const r = parseSgf(sgf);
  if (!r.ok) throw new Error(r.error);
  return buildReplay(r.game);
};

describe('棋譜の再生', () => {
  it('着手のたびに局面が増え、取った石が反映される', () => {
    // 白(aa) を黒(ba)(ab) で取る
    const { snaps, stoppedAt } = replay('(;SZ[9];B[ba];W[aa];B[ab])');
    expect(stoppedAt).toBeNull();
    expect(snaps).toHaveLength(4);
    expect(snaps[2].state.board[0]).toBe(WHITE);
    expect(snaps[3].state.board[0]).toBe(EMPTY);
    expect(snaps[3].state.prisoners[BLACK]).toBe(1);
    expect(snaps[3].color).toBe(BLACK);
    expect(snaps[3].move).toBe(9);
  });

  it('置き石から始まり、白が先に打つ', () => {
    const { snaps } = replay('(;SZ[9]HA[2]AB[gc][cg];W[ee])');
    expect(snaps[0].state.board.filter((v) => v === BLACK)).toHaveLength(2);
    expect(snaps[1].state.board[40]).toBe(WHITE);
  });

  it('同じ色が続いても、棋譜どおりに打てる。パスも進む', () => {
    const { snaps, stoppedAt } = replay('(;SZ[9];B[aa];B[bb];W[])');
    expect(stoppedAt).toBeNull();
    expect(snaps.map((s) => s.move)).toEqual([-2, 0, 10, -1]);
  });

  it('打てない手（石のある点）で止まり、それまでを返す', () => {
    const { snaps, stoppedAt } = replay('(;SZ[9];B[aa];W[aa];B[bb])');
    expect(stoppedAt).toBe(2);
    expect(snaps).toHaveLength(2);
  });

  it('コウの取り返しも、棋譜が指定していれば再生できる（コウの禁止は見ない）', () => {
    // 黒(cb) が白(bb) をコウで取った直後に、白がすぐ取り返す。対局では禁止の手だが、棋譜には現れうる
    const { snaps, stoppedAt } = replay('(;SZ[9]AB[ba][ab][bc]AW[ca][bb][db][cc];B[cb];W[bb])');
    expect(stoppedAt).toBeNull();
    expect(snaps).toHaveLength(3);
    expect(snaps[1].state.board[10]).toBe(EMPTY); // (1,1) が取られた
    expect(snaps[2].state.board[10]).toBe(WHITE); // 取り返した
    expect(snaps[2].state.board[11]).toBe(EMPTY); // (2,1) の黒が取られた
  });
});
