// 計算そのものが例外を投げても、必ず応答する（「かんがえちゅう」のまま止まらない）ことを確かめる。
import { describe, expect, it, vi } from 'vitest';

vi.mock('./mcts', () => ({
  chooseMove: () => {
    throw new Error('boom');
  },
  estimateDead: () => {
    throw new Error('boom');
  },
}));

import { newGame } from '../engine/game';
import { fallback, requestDead, requestMove } from './client';

describe('フォールバックが失敗したとき', () => {
  it('手はパス、死に石は空で応答する', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = newGame(9);
    const r = await requestMove({ size: 9, board: s.board, toPlay: s.toPlay, ko: -1, komi: 6.5, moveNo: 0, last: -1, opponentPassed: false, level: 'nyumon' });
    expect(r.move).toBe(-1);
    expect(await requestDead(s.board, 9, 1)).toEqual([]);
    expect(fallback({ type: 'dead', board: s.board, size: 9, toPlay: 1 })).toMatchObject({ type: 'dead', dead: [] });
    expect(err).toHaveBeenCalled();
  });
});
