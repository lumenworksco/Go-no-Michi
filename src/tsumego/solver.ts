// 詰碁の全幅探索。出題データを手で信じるのではなく、機械で「N手以内に取れる」を証明する。
import { EMPTY, type Color } from '../engine/board';
import { passMove, playMove, type GameState } from '../engine/game';

export interface Window {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SolveSpec {
  targets: number[];
  /** 'all' = 全ての目標を取る, 'any' = どれか1つ取れば成功 */
  mode: 'all' | 'any';
  window: Window;
  attacker: Color;
}

export function inWindow(idx: number, size: number, w: Window): boolean {
  const x = idx % size;
  const y = (idx / size) | 0;
  return x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1;
}

/** 目標の石が（盤上から消えて）取られたか。 */
export function isCaptured(s: GameState, spec: Pick<SolveSpec, 'targets' | 'mode'>): boolean {
  const gone = spec.targets.map((t) => s.board[t] === EMPTY);
  return spec.mode === 'all' ? gone.every(Boolean) : gone.some(Boolean);
}

function windowPoints(size: number, w: Window): number[] {
  const pts: number[] = [];
  for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) pts.push(y * size + x);
  return pts;
}

export class Solver {
  private memo = new Map<string, boolean>();
  private pts: number[];
  constructor(readonly spec: SolveSpec, size: number) {
    this.pts = windowPoints(size, spec.window);
  }

  private key(s: GameState, left: number): string {
    return `${left}|${s.toPlay}|${s.ko}|${s.passes}|${s.board.join('')}`;
  }

  /** 攻め方の番で、left 手以内に取れるか。 */
  attackerWins(s: GameState, left: number): boolean {
    if (isCaptured(s, this.spec)) return true;
    if (left <= 0) return false;
    if (this.memo.size > 2_000_000) this.memo.clear();
    const k = this.key(s, left);
    const hit = this.memo.get(k);
    if (hit !== undefined) return hit;
    let win = false;
    for (const p of this.pts) {
      const r = playMove(s, p);
      if (!r.ok) continue;
      if (isCaptured(r.state, this.spec) || (left > 1 && this.defenderLoses(r.state, left - 1))) {
        win = true;
        break;
      }
    }
    this.memo.set(k, win);
    return win;
  }

  /** 守り方の番で、どう応じても left 手以内に取られてしまうか。 */
  defenderLoses(s: GameState, left: number): boolean {
    if (isCaptured(s, this.spec)) return true;
    const k = this.key(s, -left); // 負の数で守り方の番を区別
    const hit = this.memo.get(k);
    if (hit !== undefined) return hit;
    let loses = true;
    // パスも守り方の選択肢（攻め方がすぐ取れない形でも粘れることがある）
    if (!this.attackerWins(passMove(s), left)) loses = false;
    if (loses) {
      for (const p of this.pts) {
        const r = playMove(s, p);
        if (!r.ok) continue;
        if (isCaptured(r.state, this.spec)) continue;
        if (!this.attackerWins(r.state, left)) {
          loses = false;
          break;
        }
      }
    }
    this.memo.set(k, loses);
    return loses;
  }

  /** 攻め方が left 手以内に取れる最初の手をすべて返す。 */
  correctMoves(s: GameState, left: number): number[] {
    const out: number[] = [];
    for (const p of this.pts) {
      const r = playMove(s, p);
      if (!r.ok) continue;
      if (isCaptured(r.state, this.spec) || (left > 1 && this.defenderLoses(r.state, left - 1))) out.push(p);
    }
    return out;
  }

  /** 攻め方が取るのに最低限必要な手数（見つからなければ Infinity）。 */
  minMoves(s: GameState, max: number): number {
    for (let k = 1; k <= max; k++) if (this.attackerWins(s, k)) return k;
    return Infinity;
  }

  /** 守り方の最善の応手（最も長く粘る手）。パスは -1。 */
  bestDefence(s: GameState, left: number): number {
    let best = -2;
    let bestLen = -1;
    const consider = (move: number, next: GameState) => {
      if (isCaptured(next, this.spec)) return;
      const len = this.minMoves(next, left);
      if (len > bestLen) {
        bestLen = len;
        best = move;
      }
    };
    consider(-1, passMove(s));
    for (const p of this.pts) {
      const r = playMove(s, p);
      if (r.ok) consider(p, r.state);
    }
    return best;
  }
}
