// 棋譜（SGF）を開いて、一手ずつ見る。
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { boardTapper, expectNoKanji } from './helpers';

const SGF = '(;GM[1]FF[4]SZ[9]KM[6.5]PB[あ]PW[い]RE[B+3.5]DT[2026-10-04];B[ee];W[cc];B[gg])';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

async function openSgfScreen(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'きふを ひらく' }).click();
  await expect(page.getByRole('heading', { name: 'きふを ひらく' }).or(page.locator('.tb-title', { hasText: 'きふを ひらく' }))).toBeVisible();
}

test('ファイルをえらんで開き、一手ずつ見られる', async ({ page, isMobile }) => {
  await openSgfScreen(page);
  await expectNoKanji(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'game.sgf', mimeType: 'application/x-go-sgf', buffer: Buffer.from(SGF, 'utf-8') });

  await expect(page.locator('.review-pos')).toHaveText('0 / 3');
  await expect(page.locator('g.stone')).toHaveCount(0);
  await expect(page.locator('.result-line')).toHaveText('くろの 3もくはん かち');
  await expect(page.locator('.pbar.bottom')).toContainText('あ'); // くろの名前（棋譜の中の名前は、漢字があってもよい）
  await expect(page.locator('.review-meta')).toContainText('2026-10-04');

  await page.getByRole('button', { name: 'ひとつ すすむ' }).click();
  await expect(page.locator('g.stone')).toHaveCount(1);
  await expect(page.locator('.tb-title')).toContainText('1てめ');
  await page.getByRole('button', { name: 'さいごへ' }).click();
  await expect(page.locator('g.stone')).toHaveCount(3);
  await expect(page.locator('.review-pos')).toHaveText('3 / 3');
  if (!isMobile) {
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('g.stone')).toHaveCount(2);
    await page.keyboard.press('Home');
    await expect(page.locator('g.stone')).toHaveCount(0);
  }

  // 戻るは 1 回でホームへ（ファイルをえらぶ画面は飛ばす）
  await page.goBack();
  await expect(page.locator('.home')).toBeVisible();
  await page.goForward(); // 進んでも、棋譜の画面は復元しない
  await expect(page.locator('.home')).toBeVisible();
});

test('はりつけて開く。読めないとき・対応しない盤は、理由を出す', async ({ page }) => {
  await openSgfScreen(page);
  const area = page.locator('textarea.sgf-text');

  await page.getByRole('button', { name: 'ひらく' }).click();
  await expect(page.getByRole('alert')).toContainText('はいっていません');

  await area.fill('これは きふ では ありません');
  await page.getByRole('button', { name: 'ひらく' }).click();
  await expect(page.getByRole('alert')).toContainText('よめませんでした');

  await area.fill('(;GM[1]SZ[5];B[aa])');
  await page.getByRole('button', { name: 'ひらく' }).click();
  await expect(page.getByRole('alert')).toContainText('たいおうしていません');

  await area.fill(SGF);
  await expect(page.getByRole('alert')).toHaveCount(0); // 書きなおすと、エラーは消える
  await page.getByRole('button', { name: 'ひらく' }).click();
  await expect(page.locator('.review-pos')).toHaveText('0 / 3');
});

test('打てない手があるときは、そこまでを出して知らせる', async ({ page }) => {
  await openSgfScreen(page);
  await page.locator('textarea.sgf-text').fill('(;SZ[9];B[ee];W[ee];B[aa])');
  await page.getByRole('button', { name: 'ひらく' }).click();
  await expect(page.locator('.review-pos')).toHaveText('0 / 1');
  await expect(page.locator('.review-meta[role=status]')).toContainText('2てめ');
});

test('対局のきふを保存して、そのファイルをもう一度開ける', async ({ page }) => {
  await page.goto('/');
  await page.getByText('たいきょく', { exact: true }).click();
  await page.getByText('ふたりで うつ').click();
  await page.getByText('はじめる').click();
  const tap = boardTapper(page, 9);
  await tap(4, 4);
  await tap(2, 2);
  await tap(6, 6);
  await page.getByRole('button', { name: 'パス', exact: true }).click();
  await page.getByRole('button', { name: 'パス', exact: true }).click();
  await page.getByRole('button', { name: 'しゅうきょく' }).click();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('きふを ほぞん').click()]);
  expect(download.suggestedFilename()).toMatch(/^gonomichi-\d{4}-\d{2}-\d{2}\.sgf$/);
  const text = readFileSync(await download.path(), 'utf-8');
  expect(text).toContain('SZ[9]');
  expect(text).toMatch(/DT\[\d{4}-\d{2}-\d{2}\]/);

  await page.locator('.sheet').getByRole('button', { name: 'ホームへ' }).click();
  await page.getByRole('button', { name: 'きふを ひらく' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'saved.sgf', mimeType: 'application/x-go-sgf', buffer: Buffer.from(text, 'utf-8') });
  await expect(page.locator('.review-pos')).toHaveText('0 / 5'); // 3 手 + パス 2 回
  await page.getByRole('button', { name: 'さいごへ' }).click();
  await expect(page.locator('g.stone')).toHaveCount(3);
});
