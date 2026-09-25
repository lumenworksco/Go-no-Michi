import { BLACK, type Color } from './engine/board';
import { ja } from './ja';

/** 例: 左から3、上から4 → 「3の4」（ばんの まわりの 数字と同じ読み方） */
export function pointLabel(size: number, idx: number): string {
  return `${(idx % size) + 1}の${Math.floor(idx / size) + 1}`;
}

/** 直前の着手の表記。くろは ▲、しろは △。パスは「パス」。 */
export function moveMark(size: number, mover: Color, idx: number): string {
  const mark = mover === BLACK ? '▲' : '△';
  return idx < 0 ? `${mark}${ja.game.passLabel}` : `${mark}${pointLabel(size, idx)}`;
}
