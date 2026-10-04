// コンピュータの投了の判断。探索で見積もった勝率が、続けて何回も、ごく低いときだけ投了する。
// （1 回の探索は、乱数をつかう粗い見積もりなので、1 回だけでは投了しない。序盤でも投了しない。）
import type { Level } from './mcts';

/** この勝率より低い状態が、RESIGN_STREAK 回つづいたら投了する。 */
export const RESIGN_WINRATE = 0.04;
export const RESIGN_STREAK = 3;

/**
 * recent: コンピュータの直近の手番ごとの勝率（古い順）。
 * 入門は、わざと弱く打つので投了しない。盤の半分ほど石がならぶまでは投了しない。
 */
export function shouldResign(recent: readonly number[], o: { moveNo: number; size: number; level: Level }): boolean {
  if (o.level === 'nyumon') return false;
  if (o.moveNo < (o.size * o.size) / 2) return false;
  if (recent.length < RESIGN_STREAK) return false;
  return recent.slice(-RESIGN_STREAK).every((w) => w < RESIGN_WINRATE);
}
