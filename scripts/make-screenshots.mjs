// README 用のスマホ幅のスクリーンショットを作る。先にビルドして preview を起動しておく:
//   npm run build && npm run preview -- --port 4173 &
//   node scripts/make-screenshots.mjs        （BASE_URL で別の場所も指せる）
import { chromium, devices } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.clear());
await page.goto(base);
await page.waitForSelector('.home');
await page.waitForTimeout(700); // 画面が出るアニメーションが終わるまで待つ
await page.screenshot({ path: 'docs/screenshot-mobile-home.png' });

await page.getByText('たいきょく', { exact: true }).click();
await page.getByText('ふたりで うつ').click();
await page.getByText('はじめる').click();
await page.waitForSelector('svg.board-svg');
const box = await page.locator('svg.board-svg').boundingBox();
const pad = 0.95;
const span = 8 + pad * 2;
for (const [x, y] of [[2, 2], [6, 6], [2, 6], [6, 2], [4, 4], [3, 4]]) {
  await page.mouse.click(box.x + ((x + pad) / span) * box.width, box.y + ((y + pad) / span) * box.height);
  await page.waitForTimeout(450);
}
await page.screenshot({ path: 'docs/screenshot-mobile-game.png' });
await browser.close();
console.log('docs/screenshot-mobile-home.png, docs/screenshot-mobile-game.png written');
