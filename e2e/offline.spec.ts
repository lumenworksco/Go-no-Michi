// オフラインで開けるかどうかの確認。ビルドしたもの（npm run preview）に対してだけ意味がある
// — サービスワーカーは本番ビルドにしか入っていない。
import { test, expect } from '@playwright/test';

test('サービスワーカーが効けば、オフラインでもホームが開く', async ({ page, context, browserName }) => {
  // Playwright の WebKit ドライバは「サービスワーカーが効いているページ」+「オフライン」+
  // 「読みこみなおし」の組み合わせで内部エラーを起こす（goto でも同様）。アプリ側の問題ではなく、
  // Chromium では同じ手順が問題なく通ることを確認済み。実機の Safari / iOS では未確認。
  test.skip(browserName === 'webkit', 'Playwright の WebKit ドライバの既知の制限（オフライン+読みこみなおしで内部エラー）');

  await page.goto('/');
  await expect(page.getByText('ごのみち')).toBeVisible();

  const hasSw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    try {
      await navigator.serviceWorker.ready;
      return true;
    } catch {
      return false;
    }
  });
  test.skip(!hasSw, 'この環境ではサービスワーカーが使えない');

  // 初回の登録だけでは今開いているページ自体は制御下に入らないことがあるので、一度読み直す
  await page.reload();
  await expect(page.getByText('ごのみち')).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByText('ごのみち')).toBeVisible();
    await expect(page.getByText('たいきょく', { exact: true })).toBeVisible();
    // 詰碁の画面は開くときに別ファイルを読みこむ。それもオフラインで開けること
    await page.getByText('つめご', { exact: true }).click();
    await expect(page.locator('.pcard')).toHaveCount(30);
    await page.locator('.pcard').first().click();
    await expect(page.locator('.goal')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
