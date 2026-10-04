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

// オフライン＋読みこみなおし（上の test）は Playwright の WebKit では動かせないので、WebKit でも使える確認として、
// サービスワーカーが「ゲームを動かすのに要るファイル」を全部キャッシュに入れていることを直接調べる。
test('サービスワーカーが、ゲームに必要なファイルをすべてキャッシュしている', async ({ page }) => {
  await page.goto('/');
  const ready = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  test.skip(!ready, 'この環境ではサービスワーカーが使えない');
  await page.reload();
  const urls = await page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) out.push(new URL(req.url).pathname);
    }
    return out;
  });
  const has = (re: RegExp) => urls.some((u) => re.test(u));
  expect(has(/^\/(index\.html)?$/), 'index').toBe(true);
  expect(has(/^\/assets\/index-.*\.js$/), 'main js').toBe(true);
  expect(has(/^\/assets\/index-.*\.css$/), 'css').toBe(true);
  expect(has(/^\/assets\/worker-.*\.js$/), 'AI worker').toBe(true);
  expect(has(/^\/assets\/Tsumego-.*\.js$/), '詰碁の画面').toBe(true);
  expect(has(/^\/fonts\/NotoSansJP-kana-400\.woff2$/), 'font').toBe(true);
  expect(has(/^\/manifest\.webmanifest$/), 'manifest').toBe(true);
  expect(has(/^\/icon-512\.png$/), 'icon').toBe(true);
});
