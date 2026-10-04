import { BLACK, type Color } from './engine/board';
import { formatMokusu } from './engine/game';
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

/** SGF の結果（RE）を、画面に出す文にする。読めない形のときは null。 */
export function sgfResultText(re: string): string | null {
  const t = re.trim();
  if (/^(0|draw|jigo)$/i.test(t)) return ja.game.jigo;
  const m = /^([BW])\+(.*)$/i.exec(t);
  if (!m) return null;
  const who = m[1].toUpperCase() === 'B' ? ja.game.black : ja.game.white;
  const rest = m[2].trim();
  if (/^r/i.test(rest)) return ja.game.winResign(who);
  const n = Number(rest);
  if (rest !== '' && Number.isFinite(n) && n > 0) return ja.game.winBy(who, formatMokusu(n));
  return `${who}の かち`;
}
