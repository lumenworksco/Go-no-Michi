// スマホ相当の画面（iPhone 13 / SE・Pixel 7・横向き）で、全画面を順に開いて確かめる。ブラウザの「レスポンシブ表示」と同じ種類の確認を、
// 自動で行う道具。横あふれ・切れた文字・小さいタップ領域・コンソールのエラーを数え、各画面のスクリーンショットを残す。
//   node scripts/phone-check.mjs [出力先]                        （既定: 本番 https://go.braunf.com/ を見る）
//   npm run build && npm run preview -- --port 4178 &  BASE=http://127.0.0.1:4178/ node scripts/phone-check.mjs
// 2 回目以降に画面を見るときは、出力先の phone/*.png を開く。
import { chromium, webkit, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const S = process.argv[2] ?? 'phone-check-out';
mkdirSync(`${S}/phone`, { recursive: true }); const base = process.env.BASE ?? 'https://go.braunf.com/';
const SGF = '(;GM[1]SZ[9]KM[6.5]PB[Black]PW[White]RE[B+3.5]C[ぜんたい];B[ee]C[1てめ](;W[cc];B[gg])(;W[gc];B[cg]))';
const settings = { size: 9, mode: 'local', level: 'shokyu', color: 1, handicap: 0, komi: 6.5 };
const saves = [1, 2, 3].map((n) => ({ id: 's' + n, updatedAt: n, settings, human: 1, moves: [40, 41, 42].slice(0, n) }));
const profiles = [
  ['iphone13-webkit', webkit, devices['iPhone 13']],
  ['pixel7-chromium', chromium, devices['Pixel 7']],
  ['iphoneSE-webkit', webkit, devices['iPhone SE']],
  ['iphone13-landscape', webkit, devices['iPhone 13 landscape']],
];
const report = [];
for (const [name, type, dev] of profiles) {
  const b = await type.launch(); const ctx = await b.newContext({ ...dev }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript((s) => { if (!sessionStorage.s) { localStorage.clear(); localStorage.setItem('gonomichi:saves', JSON.stringify(s)); sessionStorage.s = 1; } }, saves);
  const audit = async (label) => {
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const vw = window.innerWidth;
      const over = document.documentElement.scrollWidth > vw + 1;
      const small = [];
      for (const el of document.querySelectorAll('button, a, [role=button], input, textarea')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (b.right < 0 || b.left > vw) continue;
        if (Math.min(b.width, b.height) < 40 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0') small.push(`${(el.textContent || el.getAttribute('aria-label') || el.className).trim().slice(0, 18)} ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      const clippedText = [...document.querySelectorAll('.big-btn, .act, .chip, .seg button, .pbar, .tb-title')].filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => el.textContent.trim().slice(0, 20));
      return { vw, over, small, clippedText };
    });
    report.push({ name, label, ...r });
    await page.screenshot({ path: `${S}/phone/${name}-${label}.png` });
  };
  await page.goto(base); await page.waitForSelector('.home'); await audit('01-home');
  await page.getByRole('button', { name: 'あそびかた' }).click(); await audit('02-rules'); await page.getByRole('button', { name: 'もどる' }).click();
  await page.getByRole('button', { name: 'せってい', exact: true }).click(); await audit('03-settings'); await page.getByRole('button', { name: 'もどる' }).click();
  await page.getByText('つめご', { exact: true }).click(); await page.waitForSelector('.pcard'); await audit('04-tsumego-list');
  await page.locator('.pcard').nth(4).click(); await page.waitForSelector('.goal'); await audit('05-tsumego-play'); await page.goBack(); await page.goBack();
  await page.getByRole('button', { name: 'きふを ひらく' }).click(); await audit('06-open-sgf');
  await page.locator('textarea.sgf-text').fill(SGF); await page.getByRole('button', { name: 'ひらく' }).click(); await page.waitForSelector('.review-pos');
  await page.getByRole('button', { name: 'ひとつ すすむ' }).click(); await audit('07-review-variation'); await page.goBack();
  // 13x13 game with touch two-step
  await page.getByText('たいきょく', { exact: true }).click(); await page.getByText('ふたりで うつ').click(); await page.locator('.seg button', { hasText: '13×13' }).click(); await audit('08-setup');
  await page.getByText('はじめる').click(); await page.waitForSelector('svg.board-svg');
  const box = await page.locator('svg.board-svg').boundingBox(); const pad = 0.95, span = 12 + pad * 2;
  const tap = (x, y) => page.touchscreen.tap(box.x + ((x + pad) / span) * box.width, box.y + ((y + pad) / span) * box.height);
  await tap(6, 6); await page.waitForTimeout(400);
  const preview = await page.locator('g.ghost.pending').count(); const stones0 = await page.locator('g.stone').count();
  await audit('09-game13-preview'); await tap(6, 6); await page.waitForTimeout(400); const stones1 = await page.locator('g.stone').count();
  report.push({ name, label: 'touch-2step', preview, stones0, stones1 });
  await tap(3, 3); await tap(3, 3); await tap(9, 9); await tap(9, 9); await audit('10-game13-play');
  await page.getByRole('button', { name: 'パス', exact: true }).click(); await page.getByRole('button', { name: 'パス', exact: true }).click(); await audit('11-scoring');
  await page.getByRole('button', { name: 'しゅうきょく' }).click(); await page.waitForSelector('.sheet'); await audit('12-result-sheet');
  report.push({ name, label: 'console-errors', errors });
  await b.close();
}
import { writeFileSync } from 'node:fs'; writeFileSync(`${S}/phone/report.json`, JSON.stringify(report, null, 1));
for (const r of report) {
  if (r.label === 'console-errors') console.log(r.name, 'console errors:', r.errors.length, r.errors.slice(0, 2));
  else if (r.label === 'touch-2step') console.log(r.name, 'touch 2-step: preview ghost', r.preview, '| stones before 2nd tap', r.stones0, '→ after', r.stones1);
  else console.log(r.name.padEnd(20), r.label.padEnd(22), 'vw', r.vw, r.over ? 'HORIZONTAL OVERFLOW' : 'ok', r.small.length ? 'small:' + r.small.join('; ') : '', r.clippedText.length ? 'CLIPPED:' + r.clippedText.join('; ') : '');
}
