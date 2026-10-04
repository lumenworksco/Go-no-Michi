import { describe, expect, it } from 'vitest';
import { BLACK, WHITE } from './board';
import { toSgf } from './sgf';

describe('SGF', () => {
  it('着手とパスを書き出す', () => {
    const s = toSgf({ size: 9, komi: 6.5, handicap: 0, first: BLACK, moves: [40, 0, -1, -1], result: 'W+3.5' });
    expect(s).toBe('(;GM[1]FF[4]CA[UTF-8]AP[GoNoMichi]SZ[9]KM[6.5]RU[Japanese]RE[W+3.5];B[ee];W[aa];B[];W[])');
  });

  it('置き碁は置き石(AB)を書き、白から始まる（件数と先手）', () => {
    const s = toSgf({ size: 9, komi: 0, handicap: 2, first: WHITE, moves: [40] });
    expect(s).toContain('HA[2]');
    expect(s.match(/AB\[/g)?.length).toBe(2);
    expect(s).toContain(';W[ee]');
  });

  it('ヘッダ・着手・パス・結果を書き出す', () => {
    const sgf = toSgf({ size: 9, komi: 6.5, handicap: 0, first: BLACK, moves: [0, 10, -1, 80], result: 'W+3.5', blackName: 'a', whiteName: 'b' });
    expect(sgf).toBe('(;GM[1]FF[4]CA[UTF-8]AP[GoNoMichi]SZ[9]KM[6.5]RU[Japanese]PB[a]PW[b]RE[W+3.5];B[aa];W[bb];B[];W[ii])');
  });

  it('置き碁は AB と HA を書き、白から始まる', () => {
    const sgf = toSgf({ size: 9, komi: 0, handicap: 2, first: WHITE, moves: [40] });
    expect(sgf).toContain('HA[2]AB[gc]AB[cg]');
    expect(sgf).toContain(';W[ee])');
  });

  it('座標は 19 路の端（s）まで正しい', () => {
    const sgf = toSgf({ size: 19, komi: 6.5, handicap: 0, first: BLACK, moves: [18, 19 * 18, 19 * 19 - 1] });
    expect(sgf).toContain(';B[sa];W[as];B[ss]');
  });

  it('結果なし・名前なしでも壊れない', () => {
    expect(toSgf({ size: 9, komi: 6.5, handicap: 0, first: BLACK, moves: [] })).toBe('(;GM[1]FF[4]CA[UTF-8]AP[GoNoMichi]SZ[9]KM[6.5]RU[Japanese])');
  });
});
