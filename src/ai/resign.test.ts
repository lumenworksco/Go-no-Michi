import { describe, expect, it } from 'vitest';
import { shouldResign } from './resign';

const o = { moveNo: 60, size: 9, level: 'chukyu' as const };

describe('コンピュータの投了', () => {
  it('勝率がごく低い状態が 3 回つづいたときだけ投了する', () => {
    expect(shouldResign([0.01, 0.02, 0.0], o)).toBe(true);
    expect(shouldResign([0.5, 0.01, 0.02, 0.0], o)).toBe(true); // 古いものは見ない
    expect(shouldResign([0.01, 0.02], o)).toBe(false); // まだ 2 回
    expect(shouldResign([0.01, 0.3, 0.0], o)).toBe(false); // 途中で持ちなおした
    expect(shouldResign([0.04, 0.04, 0.04], o)).toBe(false); // しきい値ちょうどは投了しない
  });

  it('序盤・入門では投了しない', () => {
    expect(shouldResign([0, 0, 0], { ...o, moveNo: 10 })).toBe(false);
    expect(shouldResign([0, 0, 0], { ...o, level: 'nyumon' })).toBe(false);
    expect(shouldResign([0, 0, 0], { ...o, level: 'shokyu' })).toBe(true);
    expect(shouldResign([0, 0, 0], { ...o, size: 19, moveNo: 100 })).toBe(false); // 19 路はまだ半分に届かない
  });
});
