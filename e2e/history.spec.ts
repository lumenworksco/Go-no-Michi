// 端末／ブラウザの「戻る」操作が、押した回数ぶんだけ画面を戻ることを確認する。
// 以前は「設定 → 対局」が戻る履歴に2つ積まれたまま対局だけ終わっても消えず、
// ホームに戻るのに「戻る」を2回押す必要があった（App.tsx の replace/go の使い分けで修正）。
import { test, expect } from '@playwright/test';
import { boardTapper } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('設定 → 対局 のあと、戻るは1回でホームに着く', async ({ page }) => {
  await page.goto('/');
  await page.getByText('たいきょく', { exact: true }).click();
  await expect(page.getByText('たいきょくの せってい')).toBeVisible();

  await page.getByText('ふたりで うつ').click();
  await page.getByText('はじめる').click();
  await expect(page.locator('svg.board-svg')).toBeVisible();

  await page.goBack();
  await expect(page.getByText('たいきょく', { exact: true })).toBeVisible();
  await expect(page.getByText('たいきょくの せってい')).toHaveCount(0); // 設定画面を飛ばしてホームに着いている
});

test('あそびかた・つめごの一覧も、戻るは1回でホームに着く', async ({ page }) => {
  await page.goto('/');
  await page.getByText('あそびかた').click();
  await page.goBack();
  await expect(page.getByText('しずかに うつ')).toBeVisible();

  await page.getByText('つめご', { exact: true }).click();
  await page.goBack();
  await expect(page.getByText('しずかに うつ')).toBeVisible();
});

test('詰碁の「つぎの もんだい」のあと、戻るは一覧に着く（前の問題には戻らない）', async ({ page }) => {
  await page.goto('/');
  await page.getByText('つめご', { exact: true }).click();
  await page.locator('.pcard').first().click();
  await expect(page.getByText('だい1もん')).toBeVisible();

  // 答えを見て、すぐ解決状態にする
  await page.getByRole('button', { name: 'こたえ' }).click();
  await expect(page.locator('.t-status.shown, .t-status.solved')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'つぎの もんだい' }).click();
  await expect(page.getByText('だい2もん')).toBeVisible();

  await page.goBack();
  // 問題1ではなく一覧に戻る（一覧の見出しは「つめご」。「いちらん」は個々の問題画面の戻るボタンの名前）
  await expect(page.getByText('つめご', { exact: true })).toBeVisible();
  await expect(page.locator('.pcard')).toHaveCount(30);
});

test('対局中にホームへ戻ったあとの「戻る」で、対局に戻らない', async ({ page }) => {
  await page.goto('/');
  await page.getByText('たいきょく', { exact: true }).click();
  await page.getByText('ふたりで うつ').click();
  await page.getByText('はじめる').click();
  await expect(page.locator('svg.board-svg')).toBeVisible();
  await boardTapper(page, 9)(4, 4); // 1手打って、「もどる」で中断確認が出るようにする（0手なら確認なしで即ホームへ戻る仕様）

  await page.getByRole('button', { name: 'もどる', exact: true }).first().click();
  await page.getByRole('button', { name: 'ちゅうだんする' }).click();
  await expect(page.locator('.resume-card')).toBeVisible();

  await page.goBack();
  // ホームの前の唯一の履歴はシード用のホーム自身なので、対局画面には戻らない
  await expect(page.locator('svg.board-svg')).toHaveCount(0);
});
