import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addRecord, deleteSavedGame, loadRecord, loadSavedGames, loadSolved, MAX_SAVES, parseSavedGame, persistProgress, storeSavedGame, storeSolved, type SavedGame } from './save';
import { DEFAULT_SETTINGS, loadSettings, parseSettings, SETTINGS_KEY } from './settings';
import { clearAllData, load } from './store';
import { installFakeStorage } from './testStorage';

let data: Map<string, string>;
beforeEach(() => {
  data = installFakeStorage();
});

const game = (moves: number[], id = 'a'): SavedGame => ({ id, updatedAt: 0, settings: { ...DEFAULT_SETTINGS }, human: 1, moves });

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
    const [g] = loadSavedGames();
    expect(g).toMatchObject({ id: 'a', human: 1, moves: [40, 41, -1] });
    expect(g.updatedAt).toBeGreaterThan(0);
  });

  it('盤の外の手・形のちがうデータは捨てる', () => {
    expect(parseSavedGame(game([81]))).toBeNull(); // 9路は 0〜80
    expect(parseSavedGame(game([-2]))).toBeNull();
    expect(parseSavedGame(game([1.5]))).toBeNull();
    expect(parseSavedGame({ ...game([]), human: 0 })).toBeNull();
    expect(parseSavedGame({ ...game([]), settings: { size: 9 } })).toBeNull();
    expect(parseSavedGame({ settings: DEFAULT_SETTINGS, human: 1, moves: 'x' })).toBeNull();
    expect(parseSavedGame('x')).toBeNull();
    data.set('gonomichi:saves', '[{"settings":1}, 7, null]');
    expect(loadSavedGames()).toEqual([]);
    data.set('gonomichi:saves', '{"not":"a list"}');
    expect(loadSavedGames()).toEqual([]);
  });

  it('assisted（まった・ヒントを使った）は真偽値だけ受けつけて、保存・復元できる', () => {
    expect(parseSavedGame({ ...game([40]), assisted: true })?.assisted).toBe(true);
    expect(parseSavedGame({ ...game([40]), assisted: false })?.assisted).toBeUndefined();
    expect(parseSavedGame({ ...game([40]), assisted: 'yes' })).toBeNull();
    storeSavedGame({ ...game([40]), assisted: true });
    expect(loadSavedGames()[0].assisted).toBe(true);
  });

  it('複数の対局を新しい順に残し、同じ id は上書きする', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    storeSavedGame(game([40], 'a'));
    vi.setSystemTime(2000);
    storeSavedGame(game([40], 'b'));
    expect(loadSavedGames().map((g) => g.id)).toEqual(['b', 'a']);
    vi.setSystemTime(3000);
    storeSavedGame(game([40, 41], 'a')); // a を進めた → 先頭にくる・数は増えない
    expect(loadSavedGames().map((g) => [g.id, g.moves.length])).toEqual([['a', 2], ['b', 1]]);
    deleteSavedGame('b');
    expect(loadSavedGames().map((g) => g.id)).toEqual(['a']);
    vi.useRealTimers();
  });

  it(`${MAX_SAVES} 件をこえたら、いちばん古いものから消える`, () => {
    vi.useFakeTimers();
    for (let i = 0; i < MAX_SAVES + 2; i++) {
      vi.setSystemTime(1000 * (i + 1));
      storeSavedGame(game([40], `g${i}`));
    }
    const ids = loadSavedGames().map((g) => g.id);
    expect(ids).toHaveLength(MAX_SAVES);
    expect(ids[0]).toBe(`g${MAX_SAVES + 1}`);
    expect(ids).not.toContain('g0');
    vi.useRealTimers();
  });

  it('古い版の「保存が 1 つ」を取りこんで、古いキーを消す', () => {
    data.set('gonomichi:save', JSON.stringify({ settings: DEFAULT_SETTINGS, human: 1, moves: [40, 41] }));
    const list = loadSavedGames();
    expect(list).toHaveLength(1);
    expect(list[0].moves).toEqual([40, 41]);
    expect(data.has('gonomichi:save')).toBe(false);
    expect(loadSavedGames()[0].id).toBe(list[0].id); // 取りこんだあとは id が変わらない
    data.set('gonomichi:save', 'garbage');
    expect(loadSavedGames()).toHaveLength(1);
    expect(data.has('gonomichi:save')).toBe(false);
  });

  it('終局、または一手もない（待ったで最初まで戻した）ときは、その対局の保存だけを消す', () => {
    storeSavedGame(game([40], 'keep'));
    persistProgress(game([40], 'x'), false);
    expect(loadSavedGames().map((g) => g.id).sort()).toEqual(['keep', 'x']);
    persistProgress(game([], 'x'), false); // 待ったで 0 手に戻した
    expect(loadSavedGames().map((g) => g.id)).toEqual(['keep']);
    persistProgress(game([40, 41], 'x'), false);
    persistProgress(game([40, 41], 'x'), true); // 終局
    expect(loadSavedGames().map((g) => g.id)).toEqual(['keep']);
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
