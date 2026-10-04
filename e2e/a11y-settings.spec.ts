// アクセシビリティ（キーボード・ダイアログ・読み上げ）と、せってい画面・データの消去・成績の扱いの確認。
import { test, expect, type Page } from '@playwright/test';
import { boardTapper, trackErrors } from './helpers';

const SAVED = JSON.stringify({
  settings: { size: 9, mode: 'local', level: 'shokyu', color: 1, handicap: 0, komi: 6.5 },
  human: 1,
  moves: [40],
});

/** 初回だけ localStorage を用意する（読みこみなおしでは、保存した内容を消さない）。 */
async function seed(page: Page, items: Record<string, string>) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, items);
}

test.describe('ダイアログ', () => {
  test('フォーカスはダイアログの中を回り、Esc で閉じると元のボタンに戻る', async ({ page }) => {
    await seed(page, { 'gonomichi:save': SAVED });
    await page.goto('/');
    const discard = page.locator('.resume-card .discard');
    await discard.focus();
    await page.keyboard.press('Enter'); // キーボードで開く（Safari はマウスのクリックではボタンにフォーカスしない）
    const sheet = page.locator('.sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    // 見出しが名前になっている
    await expect(sheet).toHaveAttribute('aria-labelledby', /.+/);
    await expect(sheet.getByRole('heading')).toContainText('すてますか');
    // ダイアログ自体にフォーカスが移っている
    expect(await page.evaluate(() => document.activeElement?.classList.contains('sheet'))).toBe(true);
    // Tab を何回おしても、ダイアログの外には出ない
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.sheet'))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.sheet'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.classList.contains('discard'))).toBe(true);
  });
});

test.describe('キーボードで碁盤を操作する', () => {
  test('やじるしキーでカーソルを動かし、Enter で置ける（読み上げの文も出る）', async ({ page, browserName, isMobile }) => {
    test.skip(isMobile || browserName !== 'chromium', 'Tab での移動が使える Chromium のデスクトップだけで確認する');
    await seed(page, {});
    await page.goto('/');
    await page.getByText('たいきょく', { exact: true }).click();
    await page.getByText('ふたりで うつ').click();
    await page.getByText('はじめる').click();
    await expect(page.locator('svg.board-svg')).toBeVisible();

    for (let i = 0; i < 20; i++) {
      if (await page.evaluate(() => document.activeElement?.classList.contains('board-svg'))) break;
      await page.keyboard.press('Tab');
    }
    expect(await page.evaluate(() => document.activeElement?.classList.contains('board-svg'))).toBe(true);
    await expect(page.locator('rect.kbcursor')).toHaveCount(1);
    await expect(page.locator('.board-wrap .sr-only')).toContainText('5の5 あき'); // まん中から始まる

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.board-wrap .sr-only')).toContainText('6の5 あき');
    await page.keyboard.press('Enter');
    await expect(page.locator('g.stone')).toHaveCount(1);
    // 次は白の番。同じ点を選んで読み上げに「くろの いし」が出る
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.board-wrap .sr-only')).toContainText('6の5 くろの いし');
    // 全体の読み上げ領域には、直前の着手が出る
    await expect(page.locator('.screen > .sr-only')).toContainText('1てめ');
  });
});

test.describe('せってい', () => {
  test('音と ふるえ の設定が保存され、せいせき・つめごの記録を消せる', async ({ page }) => {
    const errors = trackErrors(page);
    await seed(page, { 'gonomichi:record': '{"win":2,"lose":1,"draw":0}', 'gonomichi:tsumego': '[1,2,3]' });
    await page.goto('/');
    await expect(page.locator('.record')).toContainText('2かち');
    await expect(page.getByText('3 / 30')).toBeVisible();

    await page.getByRole('button', { name: 'せってい', exact: true }).click();
    await expect(page.getByText('このアプリに ついて')).toBeVisible();
    await expect(page.getByText('ライセンス: MIT')).toBeVisible();

    await page.locator('section', { hasText: 'こうかおん' }).getByRole('button', { name: 'オフ' }).click();
    await page.locator('section', { hasText: 'ぶるっと ふるえる' }).getByRole('button', { name: 'オフ' }).click();
    expect(await page.evaluate(() => localStorage.getItem('gonomichi:sound'))).toBe('false');
    expect(await page.evaluate(() => localStorage.getItem('gonomichi:vibrate'))).toBe('false');

    // せいせきを消す（確認 → キャンセルでは消えない）
    await page.getByRole('button', { name: 'せいせきを けす' }).click();
    await page.getByRole('button', { name: 'キャンセル' }).click();
    expect(await page.evaluate(() => localStorage.getItem('gonomichi:record'))).not.toBeNull();
    await page.getByRole('button', { name: 'せいせきを けす' }).click();
    await page.locator('.sheet').getByRole('button', { name: 'けす' }).click();
    expect(await page.evaluate(() => localStorage.getItem('gonomichi:record'))).toBeNull();

    await page.getByRole('button', { name: 'つめごの きろくを けす' }).click();
    await page.locator('.sheet').getByRole('button', { name: 'けす' }).click();
    await page.getByRole('button', { name: 'もどる' }).click();
    await expect(page.locator('.record')).toHaveCount(0);
    await expect(page.getByText('0 / 30')).toBeVisible();
    errors.assertNone();
  });

  test('「ぜんぶ けして はじめから」で、保存したデータがすべて消える', async ({ page }) => {
    await seed(page, { 'gonomichi:save': SAVED, 'gonomichi:settings': '{"size":13}', 'gonomichi:record': '{"win":1}' });
    await page.goto('/');
    await page.getByRole('button', { name: 'せってい', exact: true }).click();
    await page.getByRole('button', { name: 'ぜんぶ けして はじめから' }).click();
    await page.locator('.sheet').getByRole('button', { name: 'けす' }).click();
    await expect(page.locator('.home')).toBeVisible(); // 読みこみなおしでホームへ
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('gonomichi:')))).toEqual([]);
    await expect(page.locator('.resume-card')).toHaveCount(0);
  });
});

test.describe('せいせき・つめご', () => {
  test('まった・ヒントを使った対局は、せいせきに入らない', async ({ page }) => {
    await seed(page, {});
    await page.goto('/');
    await page.getByText('たいきょく', { exact: true }).click();
    await page.getByText('コンピュータ', { exact: true }).click();
    await page.locator('.seg button', { hasText: 'にゅうもん' }).click();
    await page.getByText('はじめる').click();
    await boardTapper(page, 9)(4, 4);
    await expect(page.locator('g.stone')).toHaveCount(2, { timeout: 20_000 });
    await page.getByRole('button', { name: 'まった' }).click();
    await expect(page.locator('g.stone')).toHaveCount(0);
    await boardTapper(page, 9)(4, 4);
    await expect(page.locator('g.stone')).toHaveCount(2, { timeout: 20_000 });
    await page.getByRole('button', { name: 'とうりょう', exact: true }).click();
    await page.getByRole('button', { name: 'とうりょうする' }).click();
    await expect(page.locator('.sheet .assisted-note')).toBeVisible();
    await page.locator('.sheet').getByRole('button', { name: 'ホームへ' }).click();
    await expect(page.locator('.record')).toHaveCount(0); // せいせきに入っていない
  });

  test('せいせきは、たすけなしで終えた対局だけに付く', async ({ page }) => {
    await seed(page, {});
    await page.goto('/');
    await page.getByText('たいきょく', { exact: true }).click();
    await page.getByText('コンピュータ', { exact: true }).click();
    await page.locator('.seg button', { hasText: 'にゅうもん' }).click();
    await page.getByText('はじめる').click();
    await boardTapper(page, 9)(4, 4);
    await expect(page.locator('g.stone')).toHaveCount(2, { timeout: 20_000 });
    await page.getByRole('button', { name: 'とうりょう', exact: true }).click();
    await page.getByRole('button', { name: 'とうりょうする' }).click();
    await expect(page.locator('.sheet .assisted-note')).toHaveCount(0);
    await page.locator('.sheet').getByRole('button', { name: 'ホームへ' }).click();
    await expect(page.locator('.record')).toContainText('1まけ');
  });

  test('30 問ぜんぶ解くと、一覧にお祝いが出る', async ({ page }) => {
    const all = JSON.stringify(Array.from({ length: 30 }, (_, i) => i + 1));
    await seed(page, { 'gonomichi:tsumego': all });
    await page.goto('/');
    await page.getByText('つめご', { exact: true }).click();
    await expect(page.locator('.pcard')).toHaveCount(30);
    await expect(page.locator('.all-done')).toContainText('おめでとう');
    await expect(page.locator('.pcard.done')).toHaveCount(30);
  });
});
