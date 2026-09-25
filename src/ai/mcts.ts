// 軽量モンテカルロ木探索（UCT）。ワーカーからも、テストからも呼べる純粋なモジュール。
import {
  BLACK,
  WHITE,
  EMPTY,
  opp,
  neighbors,
  placeStone,
  isLegalPlacement,
  isOwnEye,
  libertyCount,
  groupAt,
  emptyRegions,
  type Color,
} from '../engine/board';

export type Rng = () => number;

export function seededRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export type Level = 'nyumon' | 'shokyu' | 'chukyu';

interface LevelConfig {
  playouts: number;
  maxMs: number;
  /** この確率で最善手でなく上位の別の手を選ぶ（弱くするための揺らぎ） */
  wobble: number;
}

export const LEVELS: Record<Level, LevelConfig> = {
  nyumon: { playouts: 40, maxMs: 400, wobble: 0.35 },
  shokyu: { playouts: 600, maxMs: 1500, wobble: 0.08 },
  chukyu: { playouts: 6000, maxMs: 3000, wobble: 0 },
};

export interface AiRequest {
  size: number;
  board: Uint8Array;
  toPlay: Color;
  ko: number;
  komi: number;
  moveNo: number;
  last: number;
  /** 直前に相手がパスしたか */
  opponentPassed: boolean;
  level: Level;
}

export interface AiResult {
  /** 打つ点。パスなら -1 */
  move: number;
  winrate: number;
}

// ---------------------------------------------------------------- プレイアウト

/** 面積計算（ツロム・テイラー式）で黒−白の差を返す。 */
function areaDiff(board: Uint8Array, size: number): number {
  const nb = neighbors(size);
  let black = 0;
  let white = 0;
  const seen = new Uint8Array(board.length);
  const st: number[] = [];
  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (v === BLACK) black++;
    else if (v === WHITE) white++;
    else if (!seen[i]) {
      let borders = 0;
      let cnt = 0;
      seen[i] = 1;
      st.push(i);
      while (st.length) {
        const p = st.pop()!;
        cnt++;
        const ns = nb[p];
        for (let k = 0; k < ns.length; k++) {
          const q = ns[k];
          const c = board[q];
          if (c === EMPTY) {
            if (!seen[q]) {
              seen[q] = 1;
              st.push(q);
            }
          } else borders |= c;
        }
      }
      if (borders === BLACK) black += cnt;
      else if (borders === WHITE) white += cnt;
    }
  }
  return black - white;
}

class Playout {
  empt: Int16Array;
  pos: Int16Array;
  count = 0;
  constructor(
    readonly size: number,
    readonly rng: Rng,
  ) {
    this.empt = new Int16Array(size * size);
    this.pos = new Int16Array(size * size);
  }

  private rebuild(board: Uint8Array) {
    let n = 0;
    for (let i = 0; i < board.length; i++) {
      if (board[i] === EMPTY) {
        this.empt[n] = i;
        this.pos[i] = n;
        n++;
      } else this.pos[i] = -1;
    }
    this.count = n;
  }

  private swap(i: number, j: number) {
    const a = this.empt[i];
    const b = this.empt[j];
    this.empt[i] = b;
    this.empt[j] = a;
    this.pos[b] = i;
    this.pos[a] = j;
  }

  private removeAt(i: number) {
    const last = this.count - 1;
    this.swap(i, last);
    this.pos[this.empt[last]] = -1;
    this.count--;
  }

  private add(p: number) {
    this.empt[this.count] = p;
    this.pos[p] = this.count;
    this.count++;
  }

  /** ヒューリスティックな1手：直前の手の周りで、取れる・アタリから逃げる手を優先する。 */
  private tactical(board: Uint8Array, toPlay: Color, last: number, ko: number): number {
    if (last < 0) return -1;
    const size = this.size;
    const nb = neighbors(size);
    const enemy = opp(toPlay);
    const ns = nb[last];
    // 1. 相手の連がアタリなら取る
    for (let i = 0; i < ns.length; i++) {
      const q = ns[i];
      if (board[q] === enemy && libertyCount(board, size, q) === 1) {
        const g = groupAt(board, size, q);
        const lib = g.liberties[0];
        if (lib !== ko && isLegalPlacement(board, size, lib, toPlay)) return lib;
      }
    }
    // 2. 自分の連がアタリなら伸びて逃げる
    for (let i = 0; i < ns.length; i++) {
      const q = ns[i];
      if (board[q] === toPlay && libertyCount(board, size, q) === 1) {
        const lib = groupAt(board, size, q).liberties[0];
        if (lib === ko || !isLegalPlacement(board, size, lib, toPlay)) continue;
        let empties = 0;
        for (const r of nb[lib]) if (board[r] === EMPTY) empties++;
        if (empties >= 2) return lib;
      }
    }
    return -1;
  }

  /** 終局まで打ち、root の手番側から見た勝敗（1=勝ち, 0=負け）を返す。 */
  run(start: Uint8Array, board: Uint8Array, toPlay: Color, ko: number, last: number, komi: number, root: Color): number {
    board.set(start);
    this.rebuild(board);
    const size = this.size;
    let passes = 0;
    let moves = 0;
    const limit = size * size * 2;
    while (passes < 2 && moves < limit) {
      let played = -1;
      const t = this.rng() < 0.85 ? this.tactical(board, toPlay, last, ko) : -1;
      let res = null as ReturnType<typeof placeStone>;
      if (t >= 0) {
        res = placeStone(board, size, t, toPlay);
        if (res) played = t;
      }
      if (played < 0) {
        let n = this.count;
        while (n > 0) {
          const i = (this.rng() * n) | 0;
          const p = this.empt[i];
          if (p === ko || isOwnEye(board, size, p, toPlay)) {
            this.swap(i, n - 1);
            n--;
            continue;
          }
          res = placeStone(board, size, p, toPlay);
          if (res) {
            played = p;
            break;
          }
          this.swap(i, n - 1);
          n--;
        }
      }
      if (played < 0) {
        passes++;
        ko = -1;
        last = -1;
      } else {
        passes = 0;
        this.removeAt(this.pos[played]);
        for (const c of res!.captured) this.add(c);
        ko = res!.captured.length === 1 && res!.ownSize === 1 && res!.ownLibs === 1 ? res!.captured[0] : -1;
        last = played;
      }
      toPlay = opp(toPlay);
      moves++;
    }
    const diff = areaDiff(board, size) - komi; // 黒 − 白 − コミ
    const blackWins = diff > 0;
    return (root === BLACK) === blackWins ? 1 : 0;
  }

  /** 終局後の盤面を返す（死に石判定用）。 */
  finalBoard(start: Uint8Array, toPlay: Color, ko: number): Uint8Array {
    const board = new Uint8Array(start.length);
    this.run(start, board, toPlay, ko, -1, 0, BLACK);
    return board;
  }
}

// ---------------------------------------------------------------- 探索木

interface Node {
  move: number;
  mover: Color;
  parent: Node | null;
  children: Node[];
  /** [点, 経験則スコア] を良い順に */
  untried: [number, number][] | null;
  visits: number;
  wins: number;
  /** 候補手の経験則スコア（探索の偏り付けと同率時の選択に使う） */
  prior: number;
}

/** 手番側の自陣（自分の石だけに囲まれた空点）の中の点は、日本ルールでは損なので除く。 */
function candidateMoves(
  board: Uint8Array,
  size: number,
  toPlay: Color,
  ko: number,
  last: number,
  rng: Rng,
): [number, number][] {
  const nb = neighbors(size);
  const enemy = opp(toPlay);
  const ownTerritory = new Uint8Array(board.length);
  for (const r of emptyRegions(board, size)) {
    if (r.borders === toPlay) for (const p of r.points) ownTerritory[p] = 1;
  }
  // 石の近くだけを候補にする（広い盤で無駄な手を避ける）
  let near: Uint8Array | null = null;
  let stones = 0;
  for (let i = 0; i < board.length; i++) if (board[i] !== EMPTY) stones++;
  if (size > 9 && stones > 0) {
    near = new Uint8Array(board.length);
    for (let i = 0; i < board.length; i++) {
      if (board[i] === EMPTY) continue;
      const x = i % size;
      const y = (i / size) | 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < size && yy < size) near[yy * size + xx] = 1;
        }
      }
    }
  }
  const lx = last >= 0 ? last % size : -99;
  const ly = last >= 0 ? (last / size) | 0 : -99;
  const scored: [number, number][] = [];
  for (let p = 0; p < board.length; p++) {
    if (board[p] !== EMPTY || p === ko || ownTerritory[p]) continue;
    if (near && !near[p]) continue;
    if (!isLegalPlacement(board, size, p, toPlay)) continue;
    if (isOwnEye(board, size, p, toPlay)) continue;
    const x = p % size;
    const y = (p / size) | 0;
    const line = Math.min(x, y, size - 1 - x, size - 1 - y);
    let s = rng() * 0.6;
    if (line === 0) s -= 3;
    else if (line === 1) s -= 0.5;
    else if (line === 2 || line === 3) s += 1;
    const d = Math.max(Math.abs(x - lx), Math.abs(y - ly));
    if (d <= 1) s += 3;
    else if (d === 2) s += 2;
    else if (d === 3) s += 1;
    for (const q of nb[p]) {
      const v = board[q];
      if (v === EMPTY) continue;
      const libs = libertyCount(board, size, q);
      if (v === enemy) {
        if (libs === 1) s += 6;
        else if (libs === 2) s += 1;
      } else if (libs === 1) s += 5;
    }
    scored.push([s, p]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map(([s, p]) => [p, s]);
}

/** 序盤の定石的な手：空いた隅の星（9路では隅の3-3と天元）。 */
function openingMove(req: AiRequest, rng: Rng): number {
  const { size, board } = req;
  let stones = 0;
  for (let i = 0; i < board.length; i++) if (board[i] !== EMPTY) stones++;
  const limit = size === 9 ? 2 : size === 13 ? 4 : 6;
  if (stones > limit) return -1;
  const lo = size === 9 ? 2 : 3;
  const hi = size - 1 - lo;
  const mid = (size - 1) / 2;
  const pts: [number, number][] = [
    [lo, lo],
    [hi, lo],
    [lo, hi],
    [hi, hi],
  ];
  if (size === 9) pts.push([mid, mid]);
  const radius = size === 9 ? 2 : 4;
  const free = pts.filter(([x, y]) => {
    if (board[y * size + x] !== EMPTY) return false;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        if (board[yy * size + xx] !== EMPTY) return false;
      }
    }
    return isLegalPlacement(board, size, y * size + x, req.toPlay);
  });
  if (!free.length) return -1;
  const [x, y] = free[(rng() * free.length) | 0];
  return y * size + x;
}

export function chooseMove(req: AiRequest, rng: Rng = Math.random): AiResult {
  const cfg = LEVELS[req.level];
  const { size, toPlay } = req;

  if (!req.opponentPassed) {
    const om = openingMove(req, rng);
    if (om >= 0) return { move: om, winrate: 0.5 };
  }

  const rootCands = candidateMoves(req.board, size, toPlay, req.ko, req.last, rng);
  const playout = new Playout(size, rng);
  const scratch = new Uint8Array(req.board.length);
  const work = new Uint8Array(req.board.length);

  // 相手がパスしたときは、パスして勝てるかを先に確かめる
  let passWr = -1;
  if (req.opponentPassed) {
    let w = 0;
    const n = Math.max(30, Math.min(200, cfg.playouts));
    for (let i = 0; i < n; i++) w += playout.run(req.board, scratch, opp(toPlay), -1, -1, req.komi, toPlay);
    passWr = w / n; // run() は toPlay 側から見た勝ち(1)/負け(0)を返す
    if (rootCands.length === 0) return { move: -1, winrate: passWr };
  } else if (rootCands.length === 0) {
    return { move: -1, winrate: 0.5 };
  }

  const root: Node = {
    move: -1,
    mover: opp(toPlay),
    parent: null,
    children: [],
    untried: rootCands,
    visits: 0,
    wins: 0,
    prior: 0,
  };

  const start = performance.now();
  let iter = 0;
  while (iter < cfg.playouts) {
    if ((iter & 15) === 0 && performance.now() - start > cfg.maxMs) break;
    iter++;
    work.set(req.board);
    let ko = req.ko;
    let last = req.last;
    let color: Color = toPlay;
    let node = root;

    // 選択
    for (;;) {
      if (node.untried === null) {
        node.untried = candidateMoves(work, size, color, ko, last, rng);
      }
      const allowed = Math.min(node.children.length + node.untried.length, 2 + Math.floor(1.4 * Math.sqrt(node.visits)));
      if (node.children.length < allowed && node.untried.length > 0) {
        // 展開
        const [mv, score] = node.untried.shift()!;
        const res = placeStone(work, size, mv, color);
        if (!res) continue; // 念のため（通常は合法）
        const child: Node = {
          move: mv,
          mover: color,
          parent: node,
          children: [],
          untried: null,
          visits: 0,
          wins: 0,
          prior: Math.max(0, score) / 10,
        };
        node.children.push(child);
        node = child;
        ko = res.captured.length === 1 && res.ownSize === 1 && res.ownLibs === 1 ? res.captured[0] : -1;
        last = mv;
        color = opp(color);
        break;
      }
      if (node.children.length === 0) break; // 末端（打てる手なし）
      // UCB1
      let best: Node | null = null;
      let bestV = -Infinity;
      const lnN = Math.log(node.visits + 1);
      for (const c of node.children) {
        const v =
          c.wins / (c.visits + 1e-9) + 0.55 * Math.sqrt(lnN / (c.visits + 1e-9)) + (0.8 * c.prior) / (c.visits + 1);
        if (v > bestV) {
          bestV = v;
          best = c;
        }
      }
      const res = placeStone(work, size, best!.move, color);
      if (!res) {
        // ありえないはずだが、壊れないように子を捨てる
        node.children.splice(node.children.indexOf(best!), 1);
        continue;
      }
      ko = res.captured.length === 1 && res.ownSize === 1 && res.ownLibs === 1 ? res.captured[0] : -1;
      last = best!.move;
      node = best!;
      color = opp(color);
    }

    // プレイアウト：node で打った側 = node.mover。root の手番側から見た勝ちを得る
    const rootWin = playout.run(work, scratch, color, ko, last, req.komi, toPlay);
    // 逆伝播
    for (let n: Node | null = node; n; n = n.parent) {
      n.visits++;
      const winForMover = n.mover === toPlay ? rootWin : 1 - rootWin;
      n.wins += winForMover;
    }
  }

  if (root.children.length === 0) return { move: -1, winrate: passWr >= 0 ? passWr : 0.5 };

  const ranked = [...root.children].sort((a, b) => b.visits - a.visits);
  let pick = ranked[0];
  const bestWr = pick.wins / Math.max(1, pick.visits);
  // 勝敗がほぼ決まっている局面では勝率の差に意味がないので、経験則（取り・逃げ）を優先する
  const tol = bestWr > 0.85 || bestWr < 0.15 ? 0.12 : 0.04;
  for (const c of ranked) {
    if (c.visits >= 2 && c.wins / c.visits >= bestWr - tol && c.prior > pick.prior + 0.3) pick = c;
  }
  if (cfg.wobble > 0 && ranked.length > 1 && rng() < cfg.wobble) {
    pick = ranked[1 + ((rng() * Math.min(ranked.length - 1, 4)) | 0)];
  }
  const wr = pick.wins / Math.max(1, pick.visits);

  if (passWr >= 0 && (passWr >= wr - 0.03 || wr < 0.1)) return { move: -1, winrate: passWr };
  return { move: pick.move, winrate: wr };
}

// ---------------------------------------------------------------- 死に石の推定

/**
 * 終局図から死に石を推定する。多数のプレイアウトで各点の最終的な持ち主を数え、
 * 相手のものになることが多い連を死に石とする。あくまで目安で、ユーザーが直せる。
 */
export function estimateDead(
  board: Uint8Array,
  size: number,
  toPlay: Color,
  rng: Rng = Math.random,
  runs = size <= 9 ? 400 : size <= 13 ? 250 : 120,
): number[] {
  const playout = new Playout(size, rng);
  const tally = new Float32Array(board.length); // +黒 / −白
  const nb = neighbors(size);
  for (let r = 0; r < runs; r++) {
    const fin = playout.finalBoard(board, toPlay, -1);
    for (let i = 0; i < fin.length; i++) {
      if (fin[i] === BLACK) tally[i]++;
      else if (fin[i] === WHITE) tally[i]--;
    }
    // 空点は接する色で数える
    const seen = new Uint8Array(fin.length);
    for (let i = 0; i < fin.length; i++) {
      if (fin[i] !== EMPTY || seen[i]) continue;
      const pts: number[] = [];
      const st = [i];
      seen[i] = 1;
      let borders = 0;
      while (st.length) {
        const p = st.pop()!;
        pts.push(p);
        for (const q of nb[p]) {
          if (fin[q] === EMPTY) {
            if (!seen[q]) {
              seen[q] = 1;
              st.push(q);
            }
          } else borders |= fin[q];
        }
      }
      if (borders === BLACK) for (const p of pts) tally[p]++;
      else if (borders === WHITE) for (const p of pts) tally[p]--;
    }
  }
  const dead: number[] = [];
  const done = new Uint8Array(board.length);
  for (let i = 0; i < board.length; i++) {
    const c = board[i];
    if (c === EMPTY || done[i]) continue;
    const g = groupAt(board, size, i);
    let sum = 0;
    for (const s of g.stones) {
      done[s] = 1;
      sum += (c === BLACK ? 1 : -1) * (tally[s] / runs);
    }
    // 自分の色として残る割合が低い連を死に石とみなす
    if (sum / g.stones.length < -0.5) dead.push(...g.stones);
  }
  return dead;
}
