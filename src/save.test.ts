import { beforeEach, describe, expect, it } from 'vitest';
import { addRecord, loadRecord, loadSavedGame, loadSolved, parseSavedGame, persistProgress, storeSavedGame, storeSolved, type SavedGame } from './save';
import { DEFAULT_SETTINGS, loadSettings, parseSettings, SETTINGS_KEY } from './settings';
import { clearAllData, load } from './store';
import { installFakeStorage } from './testStorage';

let data: Map<string, string>;
beforeEach(() => {
  data = installFakeStorage();
});

const game = (moves: number[]): SavedGame => ({ settings: { ...DEFAULT_SETTINGS }, human: 1, moves });

describe('設定の検査', () => {
  it('正しい設定は通り、おかしな値は捨てる', () => {
    expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ ...DEFAULT_SETTINGS, size: 5 })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, level: 'toString' })).toBeNull(); // 継承されたプロパティ名
    expect(parseSettings({ ...DEFAULT_SETTINGS, level: 'nope' })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, mode: 'x' })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, color: 3 })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, komi: -1 })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, komi: NaN })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, handicap: 1 })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, handicap: 6 })).toBeNull(); // 9路は5子まで
    expect(parseSettings({ ...DEFAULT_SETTINGS, size: 19, handicap: 9, komi: 0 })).not.toBeNull();
    expect(parseSettings(null)).toBeNull();
    expect(parseSettings([])).toBeNull();
  });

  it('保存された設定がこわれていたらデフォルトに戻る', () => {
    data.set(SETTINGS_KEY, '{"size":13,"level":"chukyu"}');
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, size: 13, level: 'chukyu' });
    data.set(SETTINGS_KEY, '{"size":"big"}');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    data.set(SETTINGS_KEY, 'not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    data.set(SETTINGS_KEY, '42');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('保存された対局', () => {
  it('保存して読み戻せる', () => {
    storeSavedGame(game([40, 41, -1]));
    expect(loadSavedGame()).toEqual(game([40, 41, -1]));
  });

  it('盤の外の手・形のちがうデータは捨てる', () => {
    expect(parseSavedGame(game([81]))).toBeNull(); // 9路は 0〜80
    expect(parseSavedGame(game([-2]))).toBeNull();
    expect(parseSavedGame(game([1.5]))).toBeNull();
    expect(parseSavedGame({ ...game([]), human: 0 })).toBeNull();
    expect(parseSavedGame({ ...game([]), settings: { size: 9 } })).toBeNull();
    expect(parseSavedGame({ settings: DEFAULT_SETTINGS, human: 1, moves: 'x' })).toBeNull();
    expect(parseSavedGame('x')).toBeNull();
    data.set('gonomichi:save', '{"settings":1}');
    expect(loadSavedGame()).toBeNull();
  });

  it('終局、または一手もない（待ったで最初まで戻した）ときは保存を消す', () => {
    persistProgress(game([40]), false);
    expect(loadSavedGame()).not.toBeNull();
    persistProgress(game([]), false); // 待ったで 0 手に戻した
    expect(loadSavedGame()).toBeNull();
    persistProgress(game([40, 41]), false);
    expect(loadSavedGame()).not.toBeNull();
    persistProgress(game([40, 41]), true); // 終局
    expect(loadSavedGame()).toBeNull();
  });
});

describe('せいせき・つめごの進み具合', () => {
  it('こわれた値は 0 / 空として扱う', () => {
    data.set('gonomichi:record', '{"win":"x","lose":-3,"draw":2.9}');
    expect(loadRecord()).toEqual({ win: 0, lose: 0, draw: 2 });
    data.set('gonomichi:record', 'null');
    expect(loadRecord()).toEqual({ win: 0, lose: 0, draw: 0 });
    addRecord('win');
    expect(loadRecord().win).toBe(1);
  });

  it('つめごの進み具合は、数の配列だけを受けつける', () => {
    data.set('gonomichi:tsumego', '{"a":1}');
    expect(loadSolved()).toEqual([]);
    data.set('gonomichi:tsumego', '[1,"2"]');
    expect(loadSolved()).toEqual([]);
    storeSolved([1, 2, 5]);
    expect(loadSolved()).toEqual([1, 2, 5]);
  });
});

describe('データの消去', () => {
  it('このアプリのキーだけを消す', () => {
    data.set('gonomichi:save', '1');
    data.set('gonomichi:settings', '1');
    data.set('other-app:key', 'keep');
    clearAllData();
    expect([...data.keys()]).toEqual(['other-app:key']);
  });

  it('load はガードに通らない値を捨てる', () => {
    data.set('k', '"str"');
    expect(load<number>('k', 7, (v): v is number => typeof v === 'number')).toBe(7);
  });
});
