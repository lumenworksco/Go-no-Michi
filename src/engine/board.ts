// 路盤の低レベル処理。盤面は Uint8Array（0=空, 1=黒, 2=白）で、AI からも共有される。
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export type Color = 1 | 2;
export type Cell = 0 | 1 | 2;

export const opp = (c: Color): Color => (3 - c) as Color;

const nbCache = new Map<number, number[][]>();

/** 各交点の上下左右の隣接点（サイズごとにキャッシュ）。 */
export function neighbors(size: number): number[][] {
  let t = nbCache.get(size);
  if (t) return t;
  t = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n: number[] = [];
      if (y > 0) n.push((y - 1) * size + x);
      if (x > 0) n.push(y * size + x - 1);
      if (x < size - 1) n.push(y * size + x + 1);
      if (y < size - 1) n.push((y + 1) * size + x);
      t.push(n);
    }
  }
  nbCache.set(size, t);
  return t;
}

// --- アロケーションを避けるための作業用バッファ（単一スレッド前提） ---
let mark = new Int32Array(0);
let libMark = new Int32Array(0);
let stack = new Int16Array(0);
let grp = new Int16Array(0);
let stamp = 0;
let groupSize = 0;
let groupLibs = 0;

function ensure(n: number) {
  if (mark.length < n) {
    mark = new Int32Array(n);
    libMark = new Int32Array(n);
    stack = new Int16Array(n);
    grp = new Int16Array(n);
    stamp = 0;
  }
}

/** start の連（同色でつながった石）を grp に展開し、groupSize / groupLibs を更新する。 */
function flood(board: Uint8Array, size: number, start: number) {
  ensure(size * size);
  const nb = neighbors(size);
  const color = board[start];
  stamp++;
  let sp = 0;
  let cnt = 0;
  let libs = 0;
  stack[sp++] = start;
  mark[start] = stamp;
  while (sp > 0) {
    const p = stack[--sp];
    grp[cnt++] = p;
    const ns = nb[p];
    for (let i = 0; i < ns.length; i++) {
      const q = ns[i];
      const v = board[q];
      if (v === EMPTY) {
        if (libMark[q] !== stamp) {
          libMark[q] = stamp;
          libs++;
        }
      } else if (v === color && mark[q] !== stamp) {
        mark[q] = stamp;
        stack[sp++] = q;
      }
    }
  }
  groupSize = cnt;
  groupLibs = libs;
}

export interface GroupInfo {
  stones: number[];
  liberties: number[];
}

/** 連の石と呼吸点を返す（UI・解析用）。空点を渡すと空の連を返す。 */
export function groupAt(board: Uint8Array, size: number, idx: number): GroupInfo {
  if (board[idx] === EMPTY) return { stones: [], liberties: [] };
  flood(board, size, idx);
  const stones = Array.from(grp.subarray(0, groupSize));
  const nb = neighbors(size);
  const libs = new Set<number>();
  for (const s of stones) for (const q of nb[s]) if (board[q] === EMPTY) libs.add(q);
  return { stones, liberties: [...libs] };
}

/** 連の呼吸点の数だけが必要なときの高速版。 */
export function libertyCount(board: Uint8Array, size: number, idx: number): number {
  flood(board, size, idx);
  return groupLibs;
}

export interface PlaceResult {
  captured: number[];
  ownSize: number;
  ownLibs: number;
}

/**
 * 盤面を直接書き換えて石を置く。占有済み・自殺手（着手禁止点）は盤面を変えずに null を返す。
 * コウの判定は呼び出し側で行う。
 */
export function placeStone(board: Uint8Array, size: number, idx: number, color: Color): PlaceResult | null {
  if (board[idx] !== EMPTY) return null;
  board[idx] = color;
  const nb = neighbors(size);
  const enemy = opp(color);
  const captured: number[] = [];
  const ns = nb[idx];
  for (let i = 0; i < ns.length; i++) {
    const q = ns[i];
    if (board[q] !== enemy) continue;
    flood(board, size, q);
    if (groupLibs === 0) {
      for (let k = 0; k < groupSize; k++) {
        const s = grp[k];
        captured.push(s);
        board[s] = EMPTY;
      }
    }
  }
  flood(board, size, idx);
  if (groupLibs === 0) {
    // 取りがなく呼吸点も無い＝自殺手
    board[idx] = EMPTY;
    return null;
  }
  return { captured, ownSize: groupSize, ownLibs: groupLibs };
}

/** 石を置いたと仮定して合法かどうかだけ調べる（盤面は変更しない）。 */
export function isLegalPlacement(board: Uint8Array, size: number, idx: number, color: Color): boolean {
  if (board[idx] !== EMPTY) return false;
  const nb = neighbors(size);
  const ns = nb[idx];
  // 隣に空点があれば必ず合法
  for (let i = 0; i < ns.length; i++) if (board[ns[i]] === EMPTY) return true;
  const enemy = opp(color);
  for (let i = 0; i < ns.length; i++) {
    const q = ns[i];
    flood(board, size, q);
    if (board[q] === enemy) {
      if (groupLibs === 1) return true; // 取れる
    } else if (groupLibs > 1) {
      return true; // 味方の連につながって生きる
    }
  }
  return false;
}

/** 空点が「自分の眼」かどうか（AI の埋め防止用の簡易判定）。 */
export function isOwnEye(board: Uint8Array, size: number, idx: number, color: Color): boolean {
  const nb = neighbors(size);
  const ns = nb[idx];
  for (let i = 0; i < ns.length; i++) if (board[ns[i]] !== color) return false;
  const x = idx % size;
  const y = (idx / size) | 0;
  let bad = 0;
  let inBoard = 0;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
    inBoard++;
    if (board[yy * size + xx] !== color) bad++;
  }
  // 辺・隅では斜めが1つでも欠けていたら眼ではない、中央では2つ以上欠けていたら眼ではない
  return inBoard < 4 ? bad === 0 : bad <= 1;
}

export interface Region {
  points: number[];
  /** 隣接する石の色（bit 1=黒, bit 2=白） */
  borders: number;
}

/** 空点のつながり（領域）と、それに接する石の色を列挙する。 */
export function emptyRegions(board: Uint8Array, size: number): Region[] {
  const nb = neighbors(size);
  const seen = new Uint8Array(size * size);
  const regions: Region[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY || seen[i]) continue;
    const points: number[] = [];
    let borders = 0;
    const st = [i];
    seen[i] = 1;
    while (st.length) {
      const p = st.pop()!;
      points.push(p);
      for (const q of nb[p]) {
        const v = board[q];
        if (v === EMPTY) {
          if (!seen[q]) {
            seen[q] = 1;
            st.push(q);
          }
        } else {
          borders |= v;
        }
      }
    }
    regions.push({ points, borders });
  }
  return regions;
}
