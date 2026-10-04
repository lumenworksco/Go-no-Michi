import { describe, expect, it } from 'vitest';
import { HOME, routeFromHistory } from './route';
import { PUZZLES } from './tsumego/problems';

describe('履歴から画面を読み戻す', () => {
  it('対局画面は復元しない（進むボタンで古い対局をよみがえらせない）', () => {
    const state = { name: 'game', settings: {}, run: 0, resume: { moves: [1, 2, 3] } };
    expect(routeFromHistory(state)).toEqual(HOME);
  });

  it('ふつうの画面はそのまま、知らない状態はホーム', () => {
    expect(routeFromHistory({ name: 'setup' })).toEqual({ name: 'setup' });
    expect(routeFromHistory({ name: 'rules' })).toEqual({ name: 'rules' });
    expect(routeFromHistory({ name: 'tsumegoList' })).toEqual({ name: 'tsumegoList' });
    expect(routeFromHistory(null)).toEqual(HOME);
    expect(routeFromHistory('x')).toEqual(HOME);
    expect(routeFromHistory({ name: 'nope' })).toEqual(HOME);
  });

  it('詰碁は id から問題を引き直す。存在しない id はホーム', () => {
    const p = PUZZLES[3];
    expect(routeFromHistory({ name: 'tsumego', puzzle: { id: p.id } })).toEqual({ name: 'tsumego', puzzle: p });
    expect(routeFromHistory({ name: 'tsumego', puzzle: { id: 9999 } })).toEqual(HOME);
    expect(routeFromHistory({ name: 'tsumego' })).toEqual(HOME);
  });
});
