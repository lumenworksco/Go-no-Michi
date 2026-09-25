// 対局状態（イミュータブル）。待ったは状態のスタックを戻すだけで実現できる。
import {
  BLACK,
  WHITE,
  EMPTY,
  opp,
  placeStone,
  groupAt,
  emptyRegions,
  type Color,
} from './board';

export interface GameState {
  size: number;
  board: Uint8Array;
  toPlay: Color;
  /** prisoners[BLACK] = 黒が取った白石の数, prisoners[WHITE] = 白が取った黒石の数 */
  prisoners: [number, number, number];
  /** コウで打てない点。無ければ -1 */
  ko: number;
  /** 連続パス数（2 で終局） */
  passes: number;
  /** 直前の着手位置。パス・開始直後は -1 */
  last: number;
  moveNo: number;
  komi: number;
}

export type MoveError = 'occupied' | 'suicide' | 'ko' | 'over';

export type MoveResult =
  | { ok: true; state: GameState; captured: number[] }
  | { ok: false; reason: MoveError };

/** 置き碁の星の位置（0 始まりの x, y）。日本式の置き順。 */
function handicapPoints(size: number): [number, number][] {
  const lo = size === 9 ? 2 : 3;
  const hi = size - 1 - lo;
  const mid = (size - 1) / 2;
  return [
    [hi, lo], // 右上
    [lo, hi], // 左下
    [hi, hi], // 右下
    [lo, lo], // 左上
    [mid, mid], // 天元
    [lo, mid], // 左辺
    [hi, mid], // 右辺
    [mid, lo], // 上辺
    [mid, hi], // 下辺
  ];
}

/** 置き石の数（2〜9）に応じた星の位置。5 以上は天元を含み、6 と 8 では天元を外す。 */
export function handicapPositions(size: number, stones: number): number[] {
  const p = handicapPoints(size);
  let pts: [number, number][];
  if (stones <= 4) pts = p.slice(0, stones);
  else if (stones === 5) pts = p.slice(0, 5);
  else if (stones === 6) pts = [...p.slice(0, 4), p[5], p[6]];
  else if (stones === 7) pts = [...p.slice(0, 4), p[5], p[6], p[4]];
  else if (stones === 8) pts = [...p.slice(0, 4), p[5], p[6], p[7], p[8]];
  else pts = p.slice(0, 9);
  return pts.map(([x, y]) => y * size + x);
}

export function maxHandicap(size: number): number {
  return size === 9 ? 5 : 9;
}

export function newGame(size: number, komi = 6.5, handicap = 0): GameState {
  const board = new Uint8Array(size * size);
  let toPlay: Color = BLACK;
  if (handicap >= 2) {
    for (const i of handicapPositions(size, handicap)) board[i] = BLACK;
    toPlay = WHITE;
  }
  return { size, board, toPlay, prisoners: [0, 0, 0], ko: -1, passes: 0, last: -1, moveNo: 0, komi };
}

export const isOver = (s: GameState) => s.passes >= 2;

export function playMove(s: GameState, idx: number): MoveResult {
  if (isOver(s)) return { ok: false, reason: 'over' };
  if (s.board[idx] !== EMPTY) return { ok: false, reason: 'occupied' };
  if (idx === s.ko) return { ok: false, reason: 'ko' };
  const board = s.board.slice();
  const res = placeStone(board, s.size, idx, s.toPlay);
  if (!res) return { ok: false, reason: 'suicide' };
  const prisoners: [number, number, number] = [...s.prisoners];
  prisoners[s.toPlay] += res.captured.length;
  const ko = res.captured.length === 1 && res.ownSize === 1 && res.ownLibs === 1 ? res.captured[0] : -1;
  return {
    ok: true,
    captured: res.captured,
    state: {
      ...s,
      board,
      toPlay: opp(s.toPlay),
      prisoners,
      ko,
      passes: 0,
      last: idx,
      moveNo: s.moveNo + 1,
    },
  };
}

export function passMove(s: GameState): GameState {
  return { ...s, toPlay: opp(s.toPlay), ko: -1, passes: s.passes + 1, last: -1, moveNo: s.moveNo + 1 };
}

/** 打てる点（自殺手・コウ・占有済みを除く）。ヒント表示やテスト用。 */
export function legalMoves(s: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] === EMPTY && playMove(s, i).ok) out.push(i);
  }
  return out;
}

// --- 日本ルールの数え方：地 + アゲハマ（死に石は取られた石として数える） ---

export interface ScoreResult {
  /** 各交点の所有者（0=なし, 1=黒地, 2=白地）。死に石の下も地になる。 */
  owner: Uint8Array;
  territory: [number, number, number];
  prisoners: [number, number, number];
  deadCount: [number, number, number];
  black: number;
  white: number;
  komi: number;
  /** 正なら黒の勝ち。0 は持碁。 */
  margin: number;
  winner: Color | 0;
}

/**
 * dead は死に石の交点の集合。黒石の死に石は白のアゲハマ、白石の死に石は黒のアゲハマになる。
 * 地は死に石を取り除いた盤面で、一色の石だけに囲まれた空点。
 */
export function scoreGame(s: GameState, dead: ReadonlySet<number>): ScoreResult {
  const board = s.board.slice();
  const deadCount: [number, number, number] = [0, 0, 0];
  for (const i of dead) {
    const c = board[i];
    if (c === BLACK || c === WHITE) {
      deadCount[c]++;
      board[i] = EMPTY;
    }
  }
  const owner = new Uint8Array(board.length);
  const territory: [number, number, number] = [0, 0, 0];
  for (const r of emptyRegions(board, s.size)) {
    if (r.borders === BLACK || r.borders === WHITE) {
      for (const p of r.points) owner[p] = r.borders;
      territory[r.borders] += r.points.length;
    }
  }
  // 黒が取った白石 = 対局中に取った石 + 白の死に石
  const prisoners: [number, number, number] = [
    0,
    s.prisoners[BLACK] + deadCount[WHITE],
    s.prisoners[WHITE] + deadCount[BLACK],
  ];
  const black = territory[BLACK] + prisoners[BLACK];
  const white = territory[WHITE] + prisoners[WHITE] + s.komi;
  const margin = black - white;
  return {
    owner,
    territory,
    prisoners,
    deadCount,
    black,
    white,
    komi: s.komi,
    margin,
    winner: margin > 0 ? BLACK : margin < 0 ? WHITE : 0,
  };
}

/** 連ごと死活を切り替えるときに使う：idx の連全体を返す。 */
export function chainOf(s: GameState, idx: number): number[] {
  return groupAt(s.board, s.size, idx).stones;
}

/** 目数の表記（ひらがな）。例: 3.5 → "3もくはん" */
export function formatMokusu(v: number): string {
  const a = Math.abs(v);
  const whole = Math.floor(a);
  return a % 1 === 0 ? `${a}もく` : whole === 0 ? 'はんもく' : `${whole}もくはん`;
}
