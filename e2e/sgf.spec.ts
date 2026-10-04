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

test('変化（枝わかれ）を選べて、コメントも出る', async ({ page, isMobile }) => {
  await openSgfScreen(page);
  const sgf = '(;GM[1]SZ[9]C[ぜんたいの コメント];B[ee]C[1手目の コメント](;W[cc];B[gg])(;W[gc];B[cg];W[ge];B[ce]))';
  await page.locator('textarea.sgf-text').fill(sgf);
  await page.getByRole('button', { name: 'ひらく' }).click();

  await expect(page.locator('.sgf-comment')).toContainText('ぜんたいの コメント');
  await expect(page.locator('.variations')).toHaveCount(0); // 最初の節では分かれていない
  await expect(page.locator('.review-pos')).toHaveText('0 / 3'); // 本筋は 3 手

  await page.getByRole('button', { name: 'ひとつ すすむ' }).click();
  await expect(page.locator('.sgf-comment')).toContainText('1手目の コメント');
  const group = page.getByRole('group', { name: 'へんか' });
  await expect(group).toBeVisible();
  await expect(group.getByRole('button')).toHaveCount(2);
  await expect(group.getByRole('button').first()).toContainText('ほんすじ');
  await expect(group.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');

  // 2 つめの変化を選ぶと、その 1 手目（2 手目）が出て、手数は 5 手になる
  await group.getByRole('button').nth(1).click();
  await expect(page.locator('.review-pos')).toHaveText('2 / 5');
  await expect(page.locator('g.stone')).toHaveCount(2);
  await page.getByRole('button', { name: 'さいごへ' }).click();
  await expect(page.locator('g.stone')).toHaveCount(5);

  // 1 手目にもどって本筋を選びなおす
  await page.getByRole('button', { name: 'さいしょへ' }).click();
  await page.getByRole('button', { name: 'ひとつ すすむ' }).click();
  await expect(group.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true'); // 前の選択をおぼえている
  await group.getByRole('button').first().click();
  await expect(page.locator('.review-pos')).toHaveText('2 / 3');
  if (!isMobile) {
    await page.keyboard.press('ArrowLeft'); // 1 手目
    await page.keyboard.press('ArrowDown'); // 次の候補へ（位置は 1 手目のまま）
    await expect(page.locator('.review-pos')).toHaveText('1 / 5');
    await expect(group.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  }
});

