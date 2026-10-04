import { test, expect } from '@playwright/test';
import { trackErrors, expectNoKanji, boardTapper, cropTapper } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('ホーム → あそびかた', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByText('ごのみち')).toBeVisible();
  await expectNoKanji(page);

  await page.getByText('あそびかた').click();
  await expect(page.locator('.rule')).toHaveCount(9);
  await expectNoKanji(page);

  await page.getByRole('button', { name: 'もどる' }).click();
  await expect(page.getByText('たいきょく', { exact: true })).toBeVisible();
  errors.assertNone();
});

test('コンピュータと対局し、終局して棋譜を扱える', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.getByText('たいきょく', { exact: true }).click();
  await page.getByText('コンピュータ', { exact: true }).click();
  await page.locator('.seg button', { hasText: 'にゅうもん' }).click();
  await page.getByText('はじめる').click();
  await expect(page.locator('svg.board-svg')).toBeVisible();
  await expectNoKanji(page);

  const tap = boardTapper(page, 9);
  await tap(4, 4);
  // コンピュータの一手を待つ（石が 2 つになる）
  await expect(page.locator('g.stone')).toHaveCount(2, { timeout: 20_000 });

  // 投了して、すぐ結果が出ることを確認する（終局の採点フローは詰碁テストと重複するので省く）
  await page.getByRole('button', { name: 'とうりょう' }).click();
  await page.getByRole('button', { name: 'とうりょうする' }).click();
  // とうりょう直後は、下の帯の結果表示と、結果シートの見出しの両方に同じ文言が出る
  await expect(page.locator('.result-line')).toHaveText(/かち（あいてが とうりょう）/);
  await expectNoKanji(page);

  // 投了直後は結果シートが自動で開いている。閉じて、下の棋譜の再生操作を確認する
  await page.locator('.sheet').getByRole('button', { name: 'ばんを みる' }).click();
  await expect(page.locator('.review-pos')).toBeVisible();
  await page.getByRole('button', { name: 'さいしょへ' }).click();
  await expect(page.locator('.review-pos')).toHaveText(/^0 \//);

  // 棋譜のコピー・保存ボタンは押せて、エラーにならない（コピー結果はブラウザ依存なので問わない）
  await page.getByRole('button', { name: 'けっか' }).click();
  await page.getByText('きふを コピー').click();
  await expect(page.locator('.toast')).toBeVisible();

  errors.assertNone();
});

test('二人で打って、パス2回で終局まで進められる', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.getByText('たいきょく', { exact: true }).click();
  await page.getByText('ふたりで うつ').click();
  await page.getByText('はじめる').click();
  const tap = boardTapper(page, 9);
  await tap(4, 4);
  await tap(2, 2);
  await expectNoKanji(page);

  await page.getByRole('button', { name: 'パス', exact: true }).click();
  await page.getByRole('button', { name: 'パス', exact: true }).click();
  await expect(page.locator('.tb-title')).toHaveText('しにいしの かくにん');
  await expectNoKanji(page);

  await page.getByRole('button', { name: 'しゅうきょく' }).click();
  await expect(page.locator('.result-line')).toBeVisible();
  await expectNoKanji(page);
  errors.assertNone();
});

test('戻る操作をしても、保存されていない対局の「つづきから」は出ない', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('.resume-card')).toHaveCount(0);

  await page.getByText('たいきょく', { exact: true }).click();
  await page.getByRole('button', { name: 'もどる' }).click();
  await expect(page.getByText('たいきょく', { exact: true })).toBeVisible(); // ホームに戻れている
  await expect(page.locator('.resume-card')).toHaveCount(0);
  errors.assertNone();
});

test('詰碁：まちがえると案内が出て、ヒント通りに打つと正解になる', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.getByText('つめご', { exact: true }).click();
  await expect(page.locator('.pcard')).toHaveCount(30);
  await expectNoKanji(page);

  await page.locator('.pcard').first().click();
  await expect(page.locator('.goal')).toBeVisible(); // 詰碁の画面は開くときに読みこむので、出るまで待つ
  await expect(page.locator('svg.board-svg')).toBeVisible();
  await expectNoKanji(page);

  // 第1問は (1,0) に黒石がある（tsumego/problems.ts）。そこをタップして「もう いしが あります」を確認する。
  const tap = cropTapper(page);
  await tap(1, 0);
  await expect(page.locator('.toast')).toContainText('あります');

  for (let i = 0; i < 4; i++) {
    if ((await page.locator('.t-status.solved').count()) > 0) break;
    await page.getByRole('button', { name: 'ヒント' }).click();
    const hint = await page
      .locator('circle.hint')
      .first()
      .evaluate((el) => [Number(el.getAttribute('cx')), Number(el.getAttribute('cy'))])
      .catch(() => null);
    if (!hint) break;
    await tap(hint[0], hint[1]);
    await page.waitForTimeout(900);
  }
  await expect(page.locator('.t-status.solved')).toBeVisible();
  await expectNoKanji(page);
  errors.assertNone();
});

test('あそびかたの図に、呼吸点・コウの印が正しく出る', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.getByText('あそびかた').click();
  await expect(page.locator('circle.dot').first()).toBeVisible();
  await expect(page.locator('rect.komark')).toBeVisible();
  errors.assertNone();
});
