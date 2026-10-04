import { expect, type Page } from '@playwright/test';

const KANJI = /[㐀-䶿一-鿿豈-﫿々]/;

/**
 * ページ上の console error / pageerror / 4xx・5xx 応答を集めて、あとでまとめて検査できるようにする。
 * 各テストの先頭で呼び、最後に errors.assertNone() する。
 */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    // dev サーバーの HMR 用 404 などは対象外（本番ビルドにはそもそも出ない）
    if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`);
  });
  return {
    assertNone: () => expect(errors, errors.join('\n')).toEqual([]),
  };
}

/** 画面上のテキストに漢字が無いことを確認する（ひらがな・カタカナのみの UI 方針）。 */
export async function expectNoKanji(page: Page) {
  const hits = await page.evaluate((pattern) => {
    const re = new RegExp(pattern, 'u');
    const out: string[] = [];
    const check = (s: string | null, where: string) => {
      if (s && re.test(s)) out.push(`${where}: ${s}`);
    };
    check(document.title, 'title');
    check(document.body.innerText, 'body');
    document.querySelectorAll('[aria-label],[title],[alt]').forEach((el) => {
      check(el.getAttribute('aria-label'), 'aria-label');
      check(el.getAttribute('title'), 'title-attr');
      check(el.getAttribute('alt'), 'alt');
    });
    return out;
  }, KANJI.source);
  expect(hits, hits.join('\n')).toEqual([]);
}

/** 詰碁の「切り取り表示」(CROP) 内の点をタップする。CROP と WINDOW は全問題で共通（tsumego/problems.ts）。 */
export function cropTapper(page: Page) {
  const vbX = -0.55;
  const vbY = -0.55;
  const vbW = 5 + 0.55 + 0.5;
  const vbH = 4 + 0.55 + 0.5;
  return async (x: number, y: number) => {
    const box = await page.locator('svg.board-svg').boundingBox();
    if (!box) throw new Error('board not visible');
    await page.mouse.click(box.x + ((x - vbX) / vbW) * box.width, box.y + ((y - vbY) / vbH) * box.height);
  };
}

/** boardTapper の指（タッチ）版。pointerType が 'touch' になる。 */
export function touchTapper(page: Page, size: number) {
  const pad = 0.95;
  const span = size - 1 + pad * 2;
  return async (x: number, y: number) => {
    const box = await page.locator('svg.board-svg').boundingBox();
    if (!box) throw new Error('board not visible');
    await page.touchscreen.tap(box.x + ((x + pad) / span) * box.width, box.y + ((y + pad) / span) * box.height);
  };
}

/** 盤面の交点をタップ／クリックする。size×size の碁盤「全体」が見えている（詰碁の切り取り表示ではない）前提。 */
export function boardTapper(page: Page, size: number) {
  const pad = 0.95; // Board.tsx の、盤全体表示のときの余白
  const span = size - 1 + pad * 2;
  return async (x: number, y: number) => {
    const box = await page.locator('svg.board-svg').boundingBox();
    if (!box) throw new Error('board not visible');
    const px = box.x + ((x + pad) / span) * box.width;
    const py = box.y + ((y + pad) / span) * box.height;
    await page.mouse.click(px, py);
  };
}
