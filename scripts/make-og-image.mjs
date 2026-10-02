// SNS カード用の画像 (1200×630) を作る。ヘッドレス Chromium で HTML を描画してスクリーンショットする。
//   node scripts/make-og-image.mjs
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><style>
  @font-face { font-family: 'serif-ja'; src: local('Hiragino Mincho ProN'), local('Yu Mincho'); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background:
      radial-gradient(60% 70% at 32% 50%, rgba(227,192,127,0.14), transparent 70%),
      #0b0c0e;
    display: flex; align-items: center; justify-content: center; gap: 86px;
    font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif;
  }
  .board { width: 300px; opacity: 0.95; }
  .board line { stroke: rgba(227,192,127,0.3); stroke-width: 0.045; }
  .board .b { fill: #0d0d0f; stroke: rgba(255,255,255,0.18); stroke-width: 0.035; }
  .board .w { fill: #eeeae0; }
  .right { display: flex; flex-direction: column; gap: 14px; }
  .title { font-size: 128px; font-weight: 600; color: #efece6; letter-spacing: 0.08em; line-height: 1; }
  .tagline { font-size: 30px; color: #cfc9bd; letter-spacing: 0.22em; }
  .url { font-family: system-ui, sans-serif; font-size: 20px; color: #8d9098; letter-spacing: 0.08em; margin-top: 6px; }
</style></head>
<body>
  <svg class="board" viewBox="0 0 8 8">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${i}" y1="0" x2="${i}" y2="8"/><line x1="0" y1="${i}" x2="8" y2="${i}"/>`).join('')}
    <circle class="b" cx="2" cy="2" r="0.44"/><circle class="w" cx="3" cy="2" r="0.44"/>
    <circle class="b" cx="3" cy="3" r="0.44"/><circle class="w" cx="4" cy="3" r="0.44"/>
    <circle class="b" cx="5" cy="5" r="0.44"/><circle class="w" cx="4" cy="5" r="0.44"/>
  </svg>
  <div class="right">
    <div class="title">ごのみち</div>
    <div class="tagline">しずかに&nbsp;うつ、いご。</div>
    <div class="url">go.braunf.com</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
const buf = await page.screenshot({ type: 'png' });
writeFileSync('public/og-image.png', buf);
await browser.close();
console.log('public/og-image.png written', buf.length, 'bytes');
