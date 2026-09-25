import { describe, expect, it } from 'vitest';
import { BLACK, WHITE } from './board';
import { toSgf } from './sgf';

describe('SGF', () => {
  it('着手とパスを書き出す', () => {
    const s = toSgf({ size: 9, komi: 6.5, handicap: 0, first: BLACK, moves: [40, 0, -1, -1], result: 'W+3.5' });
    expect(s).toBe('(;GM[1]FF[4]CA[UTF-8]AP[GoNoMichi]SZ[9]KM[6.5]RU[Japanese]RE[W+3.5];B[ee];W[aa];B[];W[])');
  });
  it('置き碁は置き石(AB)を書き、白から始まる', () => {
    const s = toSgf({ size: 9, komi: 0, handicap: 2, first: WHITE, moves: [40] });
    expect(s).toContain('HA[2]');
    expect(s.match(/AB\[/g)?.length).toBe(2);
    expect(s).toContain(';W[ee]');
  });
});
