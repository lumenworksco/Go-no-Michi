// node にはワーカーがないので、ここではメインスレッドで計算する経路（フォールバック）を調べる。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLACK } from '../engine/board';
import { newGame, playMove } from '../engine/game';
import { requestDead, requestMove } from './client';

const req = (s = newGame(9)) => ({
  size: s.size,
  board: s.board,
  toPlay: s.toPlay,
  ko: s.ko,
  komi: s.komi,
  moveNo: s.moveNo,
  last: s.last,
  opponentPassed: false,
  level: 'nyumon' as const,
});

afterEach(() => vi.restoreAllMocks());

describe('AI クライアント（ワーカーなし）', () => {
  it('ワーカーが使えなくても、合法な手を返す', async () => {
    const s = newGame(9);
    const r = await requestMove(req(s));
    expect(r.move).toBeGreaterThanOrEqual(0);
    expect(playMove(s, r.move).ok).toBe(true);
    expect(s.toPlay).toBe(BLACK);
  });

  it('死に石の推定も返す', async () => {
    const dead = await requestDead(newGame(9).board, 9, BLACK);
    expect(Array.isArray(dead)).toBe(true);
  });
});
