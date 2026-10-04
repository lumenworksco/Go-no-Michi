// 棋譜（SGF）の読みこみ。最初の対局を、変化（枝わかれ）もふくめた木として読み、盤の大きさ・コミ・置き石・着手・
// コメント・結果を取り出す。
// 9・13・19 路だけに対応する（このアプリの盤の大きさ）。
import { BLACK, WHITE, type Color } from './board';

export interface SgfMove {
  color: Color;
  /** 交点。パスは -1 */
  point: number;
}

/** 棋譜の木の 1 つの節。root は着手なし。1 つの節に 1 つの着手だけ。 */
export interface SgfNode {
  move: SgfMove | null;
  comment?: string;
  /** 次の手の候補。先頭が本筋、2 つめ以降が変化。 */
  children: SgfNode[];
}

export interface ParsedSgf {
  size: 9 | 13 | 19;
  komi: number;
  /** HA（置き石の数）。置き石そのものは setupBlack / setupWhite にある。 */
  handicap: number;
  setupBlack: number[];
  setupWhite: number[];
  /** 本筋（いつも先頭の変化をたどった手順）。 */
  moves: SgfMove[];
  /** 変化もふくめた木。 */
  tree: SgfNode;
  /** 例: 'B+3.5'、'W+R'、'0' */
  result?: string;
  blackName?: string;
  whiteName?: string;
  date?: string;
}

export type SgfError = 'empty' | 'format' | 'size';
export type SgfResult = { ok: true; game: ParsedSgf } | { ok: false; error: SgfError };

type Node = Map<string, string[]>;

class Reader {
  i = 0;
  constructor(readonly s: string) {}
  get done() {
    return this.i >= this.s.length;
  }
  peek() {
    return this.s[this.i];
  }
  skipSpace() {
    while (!this.done && /\s/.test(this.s[this.i])) this.i++;
  }
}

/** [ ... ] の中身を読む（\ のエスケープに対応）。 */
function readValue(r: Reader): string {
  r.i++; // [
  let out = '';
  while (!r.done) {
    const c = r.s[r.i++];
    if (c === '\\') {
      const n = r.s[r.i++];
      if (n === '\n' || n === '\r') {
        // 行末の \ は「つづき」の印。改行は捨てる
        if (n === '\r' && r.s[r.i] === '\n') r.i++;
      } else if (n !== undefined) out += n;
    } else if (c === ']') return out;
    else out += c;
  }
  throw new Error('format');
}

function readNode(r: Reader): Node {
  r.i++; // ;
  const node: Node = new Map();
  for (;;) {
    r.skipSpace();
    const c = r.peek();
    if (c === undefined || c === ';' || c === '(' || c === ')') return node;
    let ident = '';
    while (!r.done && /[A-Za-z]/.test(r.s[r.i])) ident += r.s[r.i++];
    if (!ident) throw new Error('format');
    const values: string[] = [];
    for (;;) {
      r.skipSpace();
      if (r.peek() !== '[') break;
      values.push(readValue(r));
    }
    if (values.length === 0) throw new Error('format');
    // 大文字だけを属性名として使う（FF[4] などの古い形式では小文字がまじる）
    const key = ident.replace(/[a-z]/g, '');
    node.set(key, [...(node.get(key) ?? []), ...values]);
  }
}

interface GameTree {
  nodes: Node[];
  children: GameTree[];
}

/** ( 節の列 { ( 変化 ) } ) を 1 つ読む。 */
function readTree(r: Reader, depth = 0): GameTree {
  if (depth > 200) throw new Error('format');
  r.skipSpace();
  if (r.peek() !== '(') throw new Error('format');
  r.i++;
  const tree: GameTree = { nodes: [], children: [] };
  for (;;) {
    r.skipSpace();
    const c = r.peek();
    if (c === ';') {
      if (tree.children.length) throw new Error('format'); // 変化のあとに節はつづかない
      tree.nodes.push(readNode(r));
    } else if (c === '(') {
      if (!tree.nodes.length) throw new Error('format');
      tree.children.push(readTree(r, depth + 1));
    } else if (c === ')') {
      r.i++;
      return tree;
    } else throw new Error('format');
  }
}

const A = 'a'.charCodeAt(0);

/** 'dd' → 交点。'' や 'tt'（19 路のパス）は -1。盤の外は null。 */
function point(v: string, size: number): number | null {
  if (v === '' || (v === 'tt' && size <= 19)) return -1;
  if (v.length !== 2) return null;
  const x = v.charCodeAt(0) - A;
  const y = v.charCodeAt(1) - A;
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return y * size + x;
}

/** AB[aa][bb:cc] のような、点のならび（長方形の省略つき）を交点のリストにする。 */
function points(values: string[], size: number): number[] | null {
  const out: number[] = [];
  for (const v of values) {
    const [a, b] = v.split(':');
    const p1 = point(a, size);
    if (p1 === null || p1 < 0) return null;
    if (b === undefined) out.push(p1);
    else {
      const p2 = point(b, size);
      if (p2 === null || p2 < 0) return null;
      const [x1, y1, x2, y2] = [p1 % size, Math.floor(p1 / size), p2 % size, Math.floor(p2 / size)];
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) out.push(y * size + x);
    }
  }
  return out;
}

/** 1 つの節の着手（B / W）を取り出す。座標がおかしければ null。 */
function nodeMoves(node: Node, size: number): SgfMove[] | null {
  const out: SgfMove[] = [];
  for (const [key, color] of [['B', BLACK], ['W', WHITE]] as const) {
    const v = node.get(key)?.[0];
    if (v === undefined) continue;
    const p = point(v, size);
    if (p === null) return null;
    out.push({ color, point: p });
  }
  return out;
}

/** tree の節の列を parent の下につなぎ、その先に変化をつなぐ。座標がおかしければ false。 */
function attach(tree: GameTree, parent: SgfNode, size: number, isRoot: boolean): boolean {
  let last = parent;
  for (let i = 0; i < tree.nodes.length; i++) {
    const node = tree.nodes[i];
    const moves = nodeMoves(node, size);
    if (!moves) return false;
    const comment = isRoot && i === 0 ? undefined : node.get('C')?.[0];
    if (moves.length === 0) {
      // 着手のない節（コメントだけなど）は、直前の節のコメントに足す
      if (comment) last.comment = last.comment ? `${last.comment}\n${comment}` : comment;
      continue;
    }
    moves.forEach((move, j) => {
      const n: SgfNode = { move, children: [] };
      if (j === 0 && comment) n.comment = comment;
      last.children.push(n);
      last = n;
    });
  }
  for (const child of tree.children) if (!attach(child, last, size, false)) return false;
  return true;
}

export function parseSgf(text: string): SgfResult {
  const src = text.replace(/^\uFEFF/, '').trim();
  if (!src) return { ok: false, error: 'empty' };
  const start = src.indexOf('(');
  if (start < 0) return { ok: false, error: 'format' };
  let gt: GameTree;
  try {
    gt = readTree(new Reader(src.slice(start)));
  } catch {
    return { ok: false, error: 'format' };
  }
  if (!gt.nodes.length) return { ok: false, error: 'format' };
  const root = gt.nodes[0];
  const one = (k: string) => root.get(k)?.[0];

  // 盤の大きさ（SZ[19] か SZ[9:9]。正方形だけ）
  const sz = one('SZ') ?? '19';
  const [w, h = w] = sz.split(':');
  const n = Number(w);
  if (!Number.isInteger(n) || Number(h) !== n) return { ok: false, error: 'size' };
  if (n !== 9 && n !== 13 && n !== 19) return { ok: false, error: 'size' };
  const size = n as 9 | 13 | 19;

  const komiRaw = Number(one('KM') ?? 6.5);
  const komi = Number.isFinite(komiRaw) && komiRaw >= 0 && komiRaw <= 30 ? komiRaw : 6.5;
  const haRaw = Number(one('HA') ?? 0);
  const setupBlack = points(root.get('AB') ?? [], size);
  const setupWhite = points(root.get('AW') ?? [], size);
  if (!setupBlack || !setupWhite) return { ok: false, error: 'format' };

  const tree: SgfNode = { move: null, children: [] };
  const rootComment = one('C');
  if (rootComment) tree.comment = rootComment;
  if (!attach(gt, tree, size, true)) return { ok: false, error: 'format' };

  const moves: SgfMove[] = [];
  for (let node = tree.children[0]; node; node = node.children[0]) if (node.move) moves.push(node.move);

  const game: ParsedSgf = { size, komi, handicap: Number.isInteger(haRaw) && haRaw >= 0 ? haRaw : 0, setupBlack, setupWhite, moves, tree };
  const re = one('RE');
  if (re) game.result = re.trim();
  const pb = one('PB');
  if (pb) game.blackName = pb;
  const pw = one('PW');
  if (pw) game.whiteName = pw;
  const dt = one('DT');
  if (dt) game.date = dt;
  return { ok: true, game };
}

/** ファイルの中身を文字にする。ふつうは UTF-8。CA[Shift_JIS] などの古い文字コードの棋譜にも対応する。 */
export async function decodeSgf(buf: ArrayBuffer): Promise<string> {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  const ca = /CA\s*\[\s*([^\]\s]+)\s*\]/i.exec(utf8)?.[1];
  if (ca && !/^utf-?8$/i.test(ca)) {
    try {
      return new TextDecoder(ca).decode(buf);
    } catch {
      /* 知らない文字コードなら、UTF-8 のまま読む */
    }
  }
  return utf8;
}
