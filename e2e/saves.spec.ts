// 中断した対局を複数（最大 5 つ）残せること、古い版の「保存が 1 つ」を引きつぐことの確認。
import { test, expect, type Page } from '@playwright/test';
import { boardTapper } from './helpers';

const settings = { size: 9, mode: 'local', level: 'shokyu', color: 1, handicap: 0, komi: 6.5 };
const game = (id: string, moves: number[], updatedAt: number) => ({ id, updatedAt, settings, human: 1, moves });

async function seed(page: Page, items: Record<string, unknown>) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, JSON.stringify(v));
    sessionStorage.setItem('seeded', '1');
  }, items);
}

test('古い版の「保存が 1 つ」の形も、つづきから開ける', async ({ page }) => {
  await seed(page, { 'gonomichi:save': { settings, human: 1, moves: [40, 41, 42] } });
  await page.goto('/');
  await expect(page.locator('.resume-card')).toContainText('3てめ');
  expect(await page.evaluate(() => localStorage.getItem('gonomichi:save'))).toBeNull(); // 新しい形に移した
  await page.locator('.resume-card .big-btn').click();
  await expect(page.locator('g.stone')).toHaveCount(3);
});

test('複数の保存が新しい順に並び、それぞれ開く・すてることができる', async ({ page }) => {
  await seed(page, {
    'gonomichi:saves': [game('a', [40], 1000), game('b', [40, 41], 3000), game('c', [40, 41, 42], 2000)],
  });
  await page.goto('/');
  await expect(page.locator('.resume-card')).toContainText('2てめ'); // いちばん新しい b
  await expect(page.locator('.resume-row')).toHaveCount(2);
  await expect(page.locator('.resume-row').first()).toContainText('3てめ'); // 次に新しい c
  await expect(page.locator('.resume-row').nth(1)).toContainText('1てめ');

  // 2 つめの保存を開く
  await page.locator('.resume-row').first().locator('.resume-open').click();
  await expect(page.locator('g.stone')).toHaveCount(3);
  await page.goBack();

  // 開いた保存は、いちばん新しくなる
  await expect(page.locator('.resume-card')).toContainText('3てめ');

  // すてる（確認してから、その 1 つだけが消える）
  await page.locator('.resume-row').first().locator('.text-btn').click();
  await page.locator('.sheet').getByRole('button', { name: 'すてる' }).click();
  await expect(page.locator('.resume-row')).toHaveCount(1);
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('gonomichi:saves') ?? '[]').map((g: { id: string }) => g.id));
  expect(ids).toHaveLength(2);
});

test('あたらしい対局を始めても、中断していた対局は消えない', async ({ page }) => {
  await seed(page, { 'gonomichi:saves': [game('a', [40, 41], 1000)] });
  await page.goto('/');
  await page.getByText('たいきょく', { exact: true }).click();
  await page.getByText('ふたりで うつ').click();
  await page.getByText('はじめる').click(); // 確認は出ない（保存はまだいっぱいではない）
  await boardTapper(page, 9)(4, 4);
  await expect(page.locator('g.stone')).toHaveCount(1);
  await page.goBack();
  await expect(page.locator('.resume-card')).toContainText('1てめ'); // 新しい対局
  await expect(page.locator('.resume-row')).toHaveCount(1);
  await expect(page.locator('.resume-row')).toContainText('2てめ'); // 前の対局も残っている
});

test('保存が 5 つでいっぱいのときは、はじめる前に確認が出る', async ({ page }) => {
  await seed(page, { 'gonomichi:saves': Array.from({ length: 5 }, (_, i) => game(`g${i}`, [40], 1000 + i)) });
  await page.goto('/');
  await expect(page.locator('.resume-row')).toHaveCount(4);
  await page.getByText('たいきょく', { exact: true }).click();
  await page.getByText('はじめる').click();
  await expect(page.locator('.sheet')).toContainText('いっぱい');
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.locator('svg.board-svg')).toHaveCount(0);
  await page.getByText('はじめる').click();
  await page.locator('.sheet').getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('svg.board-svg')).toBeVisible();
});
