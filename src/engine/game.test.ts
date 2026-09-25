import { describe, expect, it } from 'vitest';
import { BLACK, WHITE, EMPTY, groupAt } from './board';
import { newGame, playMove, passMove, isOver, scoreGame, handicapPositions, formatMokusu, legalMoves } from './game';
import { at, stateFrom } from './testutil';

function play(s: ReturnType<typeof newGame>, x: number, y: number) {
  const r = playMove(s, at(s.size, x, y));
  if (!r.ok) throw new Error(`illegal: ${r.reason} at ${x},${y}`);
  return r.state;
}

describe('取り', () => {
  it('角の石を取る', () => {
    let s = newGame(9);
    s = play(s, 1, 0); // 黒
    s = play(s, 0, 0); // 白
    s = play(s, 0, 1); // 黒 → 白(0,0) を取る
    expect(s.board[at(9, 0, 0)]).toBe(EMPTY);
    expect(s.prisoners[BLACK]).toBe(1);
  });

  it('複数の石を一度に取る', () => {
    const s = stateFrom(['.OOX...', 'XXX....', '.......', '.......', '.......', '.......', '.......']);
    const r = playMove(s, at(7, 0, 0));
    expect(r.ok && r.captured.sort()).toEqual([at(7, 1, 0), at(7, 2, 0)]);
    expect(r.ok && r.state.prisoners[BLACK]).toBe(2);
  });

  it('連の呼吸点を数える', () => {
    const s = stateFrom([
      '.....',
      '.XX..',
      '.....',
      '.....',
      '.....',
    ]);
    const g = groupAt(s.board, 5, at(5, 1, 1));
    expect(g.stones.length).toBe(2);
    expect(g.liberties.length).toBe(6);
  });
});

describe('着手禁止点', () => {
  it('自殺手は打てない', () => {
    const s = stateFrom(
      ['.O.....', 'O......', '.......', '.......', '.......', '.......', '.......'],
      BLACK,
    );
    const r = playMove(s, at(7, 0, 0));
    expect(r).toEqual({ ok: false, reason: 'suicide' });
  });

  it('石を取れるなら呼吸点が無くても合法', () => {
    // 黒(1,0) は隣が全て白だが、白(0,0) の最後の呼吸点を塞ぐので取れる
    const s = stateFrom(['O.O....', 'XO.....', '.......', '.......', '.......', '.......', '.......']);
    const r = playMove(s, at(7, 1, 0));
    expect(r.ok && r.captured).toEqual([at(7, 0, 0)]);
  });

  it('占有済みの点には打てない', () => {
    const s = play(newGame(9), 4, 4);
    expect(playMove(s, at(9, 4, 4))).toEqual({ ok: false, reason: 'occupied' });
  });
});

describe('コウ', () => {
  const rows = [
    '.XO......',
    'XO.O.....',
    '.XO......',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
  ];
  it('直後のコウ取り返しは禁止され、他の手を挟めば打てる', () => {
    let s = stateFrom(rows, BLACK);
    // 黒 (2,1) で白(1,1) を取る
    s = play(s, 2, 1);
    expect(s.board[at(9, 1, 1)]).toBe(EMPTY);
    expect(s.ko).toBe(at(9, 1, 1));
    // 白 (1,1) の取り返しは禁止
    expect(playMove(s, at(9, 1, 1))).toEqual({ ok: false, reason: 'ko' });
    // 別の場所に打つとコウが解ける
    s = play(s, 7, 7);
    expect(s.ko).toBe(-1);
    s = play(s, 7, 6);
    expect(playMove(s, at(9, 1, 1)).ok).toBe(true);
  });
});

describe('スナップバック', () => {
  // 白 (0,1)(1,1) の呼吸点は (0,0) と (1,0) だけ。黒が (0,0) に捨て石を打ち、
  // 白が (1,0) で取ると、白3子の呼吸点は (0,0) だけになり、黒が打ち直して3子を取れる。
  const rows = ['..X..', 'OOX..', 'XX...', '.....', '.....'];
  it('捨て石を取らせて、打ち直しで3子を取る', () => {
    let s = stateFrom(rows, BLACK);
    let r = playMove(s, at(5, 0, 0));
    expect(r.ok && r.captured.length).toBe(0);
    s = (r as { state: typeof s }).state;
    r = playMove(s, at(5, 1, 0));
    expect(r.ok && r.captured).toEqual([at(5, 0, 0)]);
    s = (r as { state: typeof s }).state;
    expect(s.ko).toBe(-1); // 白は3子の連になるのでコウではない
    r = playMove(s, at(5, 0, 0));
    expect(r.ok && r.captured.length).toBe(3);
  });
});

describe('パスと終局', () => {
  it('2連続パスで終局', () => {
    let s = newGame(9);
    s = passMove(s);
    expect(isOver(s)).toBe(false);
    s = passMove(s);
    expect(isOver(s)).toBe(true);
    expect(playMove(s, 0)).toEqual({ ok: false, reason: 'over' });
  });

  it('着手を挟むとパスの連続がリセットされる', () => {
    let s = newGame(9);
    s = passMove(s);
    s = play(s, 4, 4);
    s = passMove(s);
    expect(isOver(s)).toBe(false);
  });
});

describe('置き碁', () => {
  it('置き石の後は白番', () => {
    const s = newGame(19, 0, 4);
    expect(s.toPlay).toBe(WHITE);
    expect(s.board.reduce((n, v) => n + (v === BLACK ? 1 : 0), 0)).toBe(4);
  });
  it('置き石の数だけ重複なく星に置かれる', () => {
    for (const size of [9, 13, 19]) {
      for (let n = 2; n <= (size === 9 ? 5 : 9); n++) {
        const pts = handicapPositions(size, n);
        expect(new Set(pts).size).toBe(n);
      }
    }
  });
});

describe('日本ルールの計算', () => {
  // 5路の手作りの終局図: 黒が左2列、白が右2列、中央の列は黒石・白石の境界
  //   X X . O O
  const rows = [
    'XX.OO',
    'XX.OO',
    'XX.OO',
    'XX.OO',
    'XX.OO',
  ];
  it('地 + アゲハマ + コミ', () => {
    let s = stateFrom(rows, BLACK, 0.5);
    s = { ...s, prisoners: [0, 3, 1] };
    const r = scoreGame(s, new Set());
    // 中央の列は両者に接するのでダメ（0目）
    expect(r.territory[BLACK]).toBe(0);
    expect(r.territory[WHITE]).toBe(0);
    expect(r.black).toBe(3);
    expect(r.white).toBe(1.5);
    expect(r.winner).toBe(BLACK);
    expect(r.margin).toBe(1.5);
  });

  it('一色に囲まれた空点は地', () => {
    const s = stateFrom(
      [
        '.X.O.',
        'XX.OO',
        'XX.OO',
        'XX.OO',
        'XX.OO',
      ],
      BLACK,
      0,
    );
    const r = scoreGame(s, new Set());
    expect(r.territory[BLACK]).toBe(1); // (0,0)
    expect(r.territory[WHITE]).toBe(1); // (4,0)
  });

  it('死に石はアゲハマとして数え、その下は相手の地になる', () => {
    const s = stateFrom(
      [
        'XXXXX....',
        'XXXXX....',
        'XX.XX.OOO',
        'XXXXXO.OO',
        'XXXXXOOOO',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
      BLACK,
      0,
    );
    // 白(6,2)〜 は黒の石ではなく白の石。ここでは白石 (5,3) を死に石として指定
    const dead = new Set<number>([at(9, 5, 3), at(9, 5, 4)]);
    const r = scoreGame(s, dead);
    expect(r.deadCount[WHITE]).toBe(2);
    expect(r.prisoners[BLACK]).toBe(2);
  });

  it('コミで白が勝つ', () => {
    const s = stateFrom(rows, BLACK, 6.5);
    const r = scoreGame(s, new Set());
    expect(r.winner).toBe(WHITE);
  });

  it('持碁', () => {
    const s = stateFrom(rows, BLACK, 0);
    const r = scoreGame(s, new Set());
    expect(r.winner).toBe(0);
  });

  it('目数の表記', () => {
    expect(formatMokusu(3.5)).toBe('3もくはん');
    expect(formatMokusu(0.5)).toBe('はんもく');
    expect(formatMokusu(12)).toBe('12もく');
  });
});

describe('合法手', () => {
  it('空の 9路 盤は 81 手', () => {
    expect(legalMoves(newGame(9)).length).toBe(81);
  });
});
