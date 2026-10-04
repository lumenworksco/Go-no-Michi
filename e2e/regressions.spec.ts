// 公開前の監査で見つかった不具合の再発防止テスト。
import { test, expect, type Page } from '@playwright/test';
import { boardTapper, touchTapper, trackErrors } from './helpers';

const SAVED = JSON.stringify({
  settings: { size: 9, mode: 'local', level: 'shokyu', color: 1, handicap: 0, komi: 6.5 },
  human: 1,
  moves: [40],
});

async function startLocalGame(page: Page) {
  await page.getByText('たいきょく', { exact: true }).click();
  await page.getByText('ふたりで うつ').click();
  await page.getByText('はじめる').click();
  await expect(page.locator('svg.board-svg')).toBeVisible();
}

test.describe('保存とこわれたデータ', () => {
  test('こわれた保存データがあっても、ホーム・設定・詰碁が開く', async ({ page }) => {
    const errors = trackErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('gonomichi:tsumego', '{"x":1}');
      localStorage.setItem('gonomichi:settings', '{"size":99,"level":"zzz","komi":"x"}');
      localStorage.setItem('gonomichi:save', '{"bad":1}');
      localStorage.setItem('gonomichi:record', '"x"');
      localStorage.setItem('gonomichi:sound', '"yes"');
    });
    await page.goto('/');
    await expect(page.getByText('ごのみち').first()).toBeVisible();
    await expect(page.locator('.resume-card')).toHaveCount(0);

    await page.getByText('たいきょく', { exact: true }).click();
    await expect(page.getByText('たいきょくの せってい')).toBeVisible();
    await page.getByRole('button', { name: 'もどる' }).click();

    await page.getByText('つめご', { exact: true }).click();
    await expect(page.locator('.pcard')).toHaveCount(16);
    errors.assertNone();
  });

  test('待ったで 0 手まで戻して出ると、「つづきから」は残らない', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await startLocalGame(page);
    await boardTapper(page, 9)(4, 4);
    await expect(page.locator('g.stone')).toHaveCount(1);
    await page.getByRole('button', { name: 'まった' }).click();
    await expect(page.locator('g.stone')).toHaveCount(0);
    await page.getByRole('button', { name: 'もどる' }).first().click(); // 0 手なので確認なしでホームへ
    await expect(page.getByText('たいきょく', { exact: true })).toBeVisible();
    await expect(page.locator('.resume-card')).toHaveCount(0);
  });

  test('「すてる」は確認してから消す（Esc でも閉じられる）', async ({ page }) => {
    await page.addInitScript((saved) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('gonomichi:save', saved);
        sessionStorage.setItem('seeded', '1');
      }
    }, SAVED);
    await page.goto('/');
    await expect(page.locator('.resume-card')).toBeVisible();

    await page.locator('.resume-card .discard').click();
    await expect(page.locator('.sheet')).toContainText('すてますか');
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.locator('.resume-card')).toBeVisible(); // まだ残っている

    await page.locator('.resume-card .discard').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.locator('.resume-card')).toBeVisible();

    await page.locator('.resume-card .discard').click();
    await page.locator('.sheet').getByRole('button', { name: 'すてる' }).click();
    await expect(page.locator('.resume-card')).toHaveCount(0);
  });
});

test.describe('戻る・進む', () => {
  test('進むボタンで、古い対局がよみがえって新しい保存を上書きしない', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('cleared')) {
        localStorage.clear();
        sessionStorage.setItem('cleared', '1');
      }
    });
    await page.goto('/');
    await startLocalGame(page);
    const tap = boardTapper(page, 9);
    await tap(4, 4);
    await page.goBack(); // ホームへ（対局は自動保存されている）
    await page.locator('.resume-card .big-btn').click(); // つづきから → 1 手目の対局を再開
    await expect(page.locator('g.stone')).toHaveCount(1);
    await tap(2, 2);
    await expect(page.locator('g.stone')).toHaveCount(2);
    await page.goBack();
    await expect(page.locator('.resume-card')).toContainText('2てめ');

    await page.goForward(); // 進んでも対局は開かない
    await expect(page.locator('svg.board-svg')).toHaveCount(0);
    await expect(page.locator('.resume-card')).toContainText('2てめ'); // 保存も古い 1 手に戻っていない
  });

  test('設定 → 対局のあと、進んでも新しい対局は始まらない', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('cleared')) {
        localStorage.clear();
        sessionStorage.setItem('cleared', '1');
      }
    });
    await page.goto('/');
    await startLocalGame(page);
    await page.goBack();
    await page.goForward();
    await expect(page.locator('svg.board-svg')).toHaveCount(0);
    await expect(page.getByText('たいきょく', { exact: true })).toBeVisible();
  });
});

test.describe('操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('キーボードの P は 2 回押したときだけパスする', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'キーボード操作はデスクトップだけ');
    await page.goto('/');
    await startLocalGame(page);
    await page.keyboard.press('p');
    await expect(page.locator('.toast')).toContainText('もういちど');
    await expect(page.locator('.tb-title')).not.toContainText('パス');
    await page.keyboard.press('p');
    await expect(page.locator('.tb-title')).toContainText('パス');
  });

  test('大きな盤を指でさわると、1 回目は確認・2 回目で置く', async ({ page, isMobile }) => {
    test.skip(!isMobile, '指（タッチ）の操作はモバイルだけ');
    await page.goto('/');
    await page.getByText('たいきょく', { exact: true }).click();
    await page.getByText('ふたりで うつ').click();
    await page.locator('.seg button', { hasText: '13×13' }).click();
    await page.getByText('はじめる').click();
    await expect(page.locator('svg.board-svg')).toBeVisible();

    const tap = touchTapper(page, 13);
    await tap(6, 6);
    await expect(page.locator('g.ghost.pending')).toHaveCount(1);
    await expect(page.locator('g.stone')).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('もういちど');

    await tap(3, 3); // 別の点にうつす
    await expect(page.locator('g.stone')).toHaveCount(0);
    await tap(3, 3); // 同じ点をもう一度 → 置く
    await expect(page.locator('g.stone')).toHaveCount(1);
    await expect(page.locator('g.ghost.pending')).toHaveCount(0);
  });

  test('9路は指でも 1 タップで置ける', async ({ page, isMobile }) => {
    test.skip(!isMobile, '指（タッチ）の操作はモバイルだけ');
    await page.goto('/');
    await startLocalGame(page);
    await touchTapper(page, 9)(4, 4);
    await expect(page.locator('g.stone')).toHaveCount(1);
  });
});
