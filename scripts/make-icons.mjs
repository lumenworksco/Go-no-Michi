// 依存なしでアプリアイコン（PNG）を生成する。 node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function render(size, { rounded, inset }) {
  const S = 3; // スーパーサンプリング
  const px = Buffer.alloc(size * size * 4);
  const r = size * (rounded ? 0.22 : 0);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const fx = x + (sx + 0.5) / S, fy = y + (sy + 0.5) / S;
      // 角丸
      let inside = true;
      if (r > 0) {
        const cx = Math.min(Math.max(fx, r), size - r), cy = Math.min(Math.max(fy, r), size - r);
        inside = (fx - cx) ** 2 + (fy - cy) ** 2 <= r * r;
      }
      if (!inside) continue;
      const u = fx / size, v = fy / size;
      // 盤の色（斜めのグラデーション）
      let col = mix([236, 201, 138], [201, 148, 80], (u + v) / 2);
      // 碁盤の線（中央寄せ・inset で余白を確保）
      const g = size * (1 - inset * 2) / 4, o = size * inset;
      const gx = (fx - o) / g, gy = (fy - o) / g;
      if (gx >= -0.02 && gx <= 4.02 && gy >= -0.02 && gy <= 4.02) {
        const dx = Math.abs(gx - Math.round(gx)) * g, dy = Math.abs(gy - Math.round(gy)) * g;
        if (Math.min(dx, dy) < size * 0.004) col = mix(col, [59, 40, 16], 0.55);
      }
      // 石
      const stone = (cx, cy, rad, kind) => {
        const dx = fx - cx * size, dy = fy - cy * size, d = Math.hypot(dx, dy);
        if (d > rad * size) return null;
        const t = Math.min(1, Math.hypot(dx + rad * size * 0.3, dy + rad * size * 0.35) / (rad * size * 1.5));
        return kind === 'b' ? mix([96, 98, 104], [5, 5, 6], Math.sqrt(t)) : mix([255, 255, 255], [185, 180, 168], t * t);
      };
      const sh = Math.hypot(fx - (0.3 + 0.01) * size, fy - (0.32 + 0.02) * size) < 0.19 * size || Math.hypot(fx - 0.71 * size, fy - 0.72 * size) < 0.19 * size;
      if (sh) col = mix(col, [30, 15, 0], 0.3);
      const b = stone(0.35, 0.36, 0.19, 'b');
      const w = stone(0.66, 0.66, 0.19, 'w');
      if (b) col = b;
      if (w) col = w;
      acc = acc.map((a, i) => a + (i < 3 ? col[i] : 255));
    }
    const n = S * S;
    const o = (y * size + x) * 4;
    const a = acc[3] / n;
    px[o] = a ? Math.round(acc[0] / (acc[3] / 255)) : 0;
    px[o + 1] = a ? Math.round(acc[1] / (acc[3] / 255)) : 0;
    px[o + 2] = a ? Math.round(acc[2] / (acc[3] / 255)) : 0;
    px[o + 3] = Math.round(a);
  }
  return png(size, size, px);
}

writeFileSync('public/icon-192.png', render(192, { rounded: true, inset: 0.18 }));
writeFileSync('public/icon-512.png', render(512, { rounded: true, inset: 0.18 }));
writeFileSync('public/icon-maskable-512.png', render(512, { rounded: false, inset: 0.24 }));
writeFileSync('public/apple-touch-icon.png', render(180, { rounded: false, inset: 0.18 }));
console.log('icons written');
