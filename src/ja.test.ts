// 画面に出る文字は、ひらがな・カタカナ・数字・記号だけ（漢字なし）。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLACK, WHITE } from './engine/board';
import { formatMokusu } from './engine/game';
import { ja } from './ja';
import { moveMark, pointLabel } from './notation';

const KANJI = /[㐀-䶿一-鿿豈-﫿々]/; // 々(3005) も含める

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') out.push(String((v as (...a: unknown[]) => unknown)(3.5, 'あ', 12)));
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe('ひらがな・カタカナだけ', () => {
  it('ja.ts の文言に漢字がない', () => {
    const all = strings(ja);
    expect(all.length).toBeGreaterThan(100);
    expect(all.filter((s) => KANJI.test(s))).toEqual([]);
  });

  it('数え方・着手の表記に漢字がない', () => {
    const out = [formatMokusu(3.5), formatMokusu(0.5), formatMokusu(12), pointLabel(9, 40), moveMark(9, BLACK, 40), moveMark(9, WHITE, -1)];
    expect(out.filter((s) => KANJI.test(s))).toEqual([]);
    expect(pointLabel(9, 3 * 9 + 2)).toBe('3の4');
  });

  it('画面のコード・HTML・設定ファイルの文字列にも漢字がない（コメントは除く）', () => {
    const files = [
      ...readdirSync('src/ui').map((f) => join('src/ui', f)),
      'src/App.tsx',
      'src/notation.ts',
      'src/audio.ts',
      'src/rulesDiagrams.ts',
      'index.html',
      'vite.config.ts',
    ];
    const bad: string[] = [];
    for (const f of files) {
      const code = readFileSync(f, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      code.split('\n').forEach((line, i) => {
        if (KANJI.test(line)) bad.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
