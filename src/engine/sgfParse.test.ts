import { describe, expect, it } from 'vitest';
import { BLACK, WHITE } from './board';
import { toSgf } from './sgf';
import { decodeSgf, parseSgf } from './sgfParse';

const ok = (text: string) => {
  const r = parseSgf(text);
  if (!r.ok) throw new Error(`parse failed: ${r.error}`);
  return r.game;
};

describe('SGF の読みこみ', () => {
  it('toSgf で書いたものを、そのまま読み戻せる（パス・結果・名前・日付つき）', () => {
    const text = toSgf({ size: 9, komi: 6.5, handicap: 0, first: BLACK, moves: [40, 0, -1, 80], result: 'W+3.5', blackName: 'あなた', whiteName: 'コンピュータ', date: '2026-10-04' });
    const g = ok(text);
    expect(g).toMatchObject({ size: 9, komi: 6.5, handicap: 0, result: 'W+3.5', blackName: 'あなた', whiteName: 'コンピュータ', date: '2026-10-04' });
    expect(g.moves).toEqual([
      { color: BLACK, point: 40 },
      { color: WHITE, point: 0 },
      { color: BLACK, point: -1 },
      { color: WHITE, point: 80 },
    ]);
  });

  it('置き碁：置き石(AB)と白からの着手', () => {
    const g = ok(toSgf({ size: 19, komi: 0, handicap: 4, first: WHITE, moves: [180] }));
    expect(g.handicap).toBe(4);
    expect(g.setupBlack).toHaveLength(4);
    expect(g.moves[0]).toEqual({ color: WHITE, point: 180 });
  });

  it('エスケープ・改行・小文字まじりの属性名・AB の長方形に対応する', () => {
    const g = ok('(;GM[1]FF[4]SZ[9]PB[a\\]b\\\\c]C[line1\nline2]AB[aa:ac]AP[x];B[ee];W[dd])');
    expect(g.blackName).toBe('a]b\\c');
    expect(g.setupBlack).toEqual([0, 9, 18]);
    expect(g.moves).toHaveLength(2);
    expect(ok('(;SZ[9]PlayerBlack[x];B[aa])').blackName).toBe('x'); // 古い形式の長い属性名（小文字は無視）
  });

  it('変化があるときは、最初の変化をたどる', () => {
    const g = ok('(;SZ[9];B[aa](;W[bb];B[cc])(;W[dd];B[ee]))');
    expect(g.moves.map((m) => m.point)).toEqual([0, 10, 20]);
    const g2 = ok('(;SZ[9];B[aa];W[bb](;B[cc])(;B[dd]))(;SZ[9];B[ee])'); // 2 つめの対局は読まない
    expect(g2.moves.map((m) => m.point)).toEqual([0, 10, 20]);
  });

  it('パスは [] と [tt]（19 路）のどちらでも読める', () => {
    expect(ok('(;SZ[19];B[];W[tt])').moves.map((m) => m.point)).toEqual([-1, -1]);
    expect(ok('(;SZ[9];B[])').moves[0].point).toBe(-1);
  });

  it('SZ がなければ 19 路、非対応の大きさ・長方形は size エラー', () => {
    expect(ok('(;B[dd])').size).toBe(19);
    expect(parseSgf('(;SZ[5];B[aa])')).toEqual({ ok: false, error: 'size' });
    expect(parseSgf('(;SZ[9:13];B[aa])')).toEqual({ ok: false, error: 'size' });
    expect(parseSgf('(;SZ[25];B[aa])')).toEqual({ ok: false, error: 'size' });
  });

  it('こわれた入力は format / empty エラーで、例外を投げない', () => {
    expect(parseSgf('')).toEqual({ ok: false, error: 'empty' });
    expect(parseSgf('   \n')).toEqual({ ok: false, error: 'empty' });
    for (const bad of ['hello', '(;SZ[9', '(;SZ[9];B[zz])', '(;SZ[9];B[a])', '(B[aa])', '(;SZ[9];B[aa]', '(;[aa])', '(;AB[zz])', '()', '(;SZ[9]AB[aa:zz])']) {
      const r = parseSgf(bad);
      expect(r.ok, bad).toBe(false);
    }
  });

  it('深すぎる入れ子でも落ちない', () => {
    const r = parseSgf('(;SZ[9]' + '('.repeat(5000));
    expect(r.ok).toBe(false);
  });

  it('BOM つきでも読める。コミ・HA が変な値なら無視する', () => {
    const g = ok('﻿(;SZ[9]KM[abc]HA[x];B[aa])');
    expect(g.komi).toBe(6.5);
    expect(g.handicap).toBe(0);
  });

  it('CA[Shift_JIS] の古い棋譜も、文字化けせずに読める', async () => {
    const head = new TextEncoder().encode('(;SZ[9]CA[Shift_JIS]PB[');
    const tail = new TextEncoder().encode('];B[aa])');
    const buf = new Uint8Array([...head, 0x82, 0xa0, ...tail]); // 0x82 0xA0 = あ（Shift_JIS）
    const g = ok(await decodeSgf(buf.buffer));
    expect(g.blackName).toBe('あ');
    // CA がなければ UTF-8 のまま
    expect(ok(await decodeSgf(new TextEncoder().encode('(;SZ[9]PB[あ];B[aa])').buffer as ArrayBuffer)).blackName).toBe('あ');
  });
});
