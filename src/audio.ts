// 効果音は Web Audio で合成する（音声ファイル不要・オフラインでも鳴る）。
import { load, save } from './store';

let ctx: AudioContext | null = null;
let enabled = load<boolean>('gonomichi:sound', true);
let noise: AudioBuffer | null = null;

export const isSoundOn = () => enabled;
export function setSound(on: boolean) {
  enabled = on;
  save('gonomichi:sound', on);
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = Math.floor(c.sampleRate * 0.08);
  noise = c.createBuffer(1, len, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  return noise;
}

/** 石を置くときの「パチッ」。 */
export function playStone(strength = 1) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1900 + Math.random() * 500;
  bp.Q.value = 1.4;
  const g = c.createGain();
  g.gain.value = 0.55 * strength;
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);

  const o = c.createOscillator();
  const og = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(420, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.07);
  og.gain.setValueAtTime(0.22 * strength, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(og).connect(c.destination);
  o.start(t);
  o.stop(t + 0.1);
}

/** 石を取ったとき、少しずつずらして数回鳴らす。 */
export function playCapture(count: number) {
  const n = Math.min(4, Math.max(1, count));
  for (let i = 0; i < n; i++) setTimeout(() => playStone(0.5), 90 + i * 70);
}

/** パス・終局などの小さな合図。 */
export function playChime(up = true) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const notes = up ? [523.25, 659.25, 783.99] : [392, 329.63];
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.11);
    g.gain.linearRampToValueAtTime(0.12, t + i * 0.11 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.11 + 0.5);
    o.connect(g).connect(c.destination);
    o.start(t + i * 0.11);
    o.stop(t + i * 0.11 + 0.55);
  });
}

export function vibrate(ms: number | number[] = 10) {
  try {
    if (enabled) navigator.vibrate?.(ms);
  } catch {
    /* 非対応環境では何もしない */
  }
}
