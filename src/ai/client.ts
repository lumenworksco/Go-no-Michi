// AI は Web Worker で動かし、画面を止めない。キャンセル時はワーカーごと作り直す。
// 対局用とヒント用でワーカーを分け、ヒントの計算が相手の着手を待たせないようにする。
// ワーカーが作れない・途中で壊れた場合は、メインスレッドで直接計算して必ず応答を返す
// （画面を止めてしまうが、「かんがえちゅう」のまま固まるよりはよい）。
import type { Color } from '../engine/board';
import { chooseMove, estimateDead, type AiRequest } from './mcts';
import type { WorkerIn, WorkerOut } from './worker';

type Msg = WorkerIn extends infer T ? (T extends { id: number } ? Omit<T, 'id'> : never) : never;

let nextId = 1;

/**
 * メインスレッドで直接計算する。ここでも失敗したら、パス（死に石なし）を返して必ず応答する。
 * 応答しないと、画面が「かんがえちゅう」のまま二度と動かなくなってしまう。
 */
export function fallback(msg: Msg): WorkerOut {
  try {
    if (msg.type === 'move') {
      const r = chooseMove(msg.req);
      return { id: 0, type: 'move', move: r.move, winrate: r.winrate };
    }
    return { id: 0, type: 'dead', dead: estimateDead(msg.board, msg.size, msg.toPlay) };
  } catch (err) {
    console.error(err);
    return msg.type === 'move' ? { id: 0, type: 'move', move: -1, winrate: 0.5 } : { id: 0, type: 'dead', dead: [] };
  }
}

class Channel {
  private worker: Worker | null = null;
  private pending = new Map<number, { resolve: (out: WorkerOut) => void; msg: Msg }>();
  private broken = false;

  private get(): Worker | null {
    if (this.broken) return null;
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      } catch {
        this.broken = true;
        return null;
      }
      this.worker.onmessage = (e: MessageEvent<WorkerOut>) => {
        const p = this.pending.get(e.data.id);
        if (p) {
          this.pending.delete(e.data.id);
          p.resolve(e.data);
        }
      };
      this.worker.onerror = () => {
        // ワーカーが壊れた：待っている分はメインスレッドで代わりに計算して返し、
        // 以降このチャンネルはワーカーを使わず直接計算する。
        this.broken = true;
        this.worker?.terminate();
        this.worker = null;
        const waiting = [...this.pending.values()];
        this.pending.clear();
        for (const { resolve, msg } of waiting) resolve(fallback(msg));
      };
    }
    return this.worker;
  }

  send(msg: Msg): Promise<WorkerOut> {
    const w = this.get();
    // 直接計算は画面を止めるので、「かんがえちゅう」が一度描画されてから始める
    if (!w) return new Promise((resolve) => setTimeout(() => resolve(fallback(msg)), 30));
    return new Promise((resolve) => {
      const id = nextId++;
      this.pending.set(id, { resolve, msg });
      w.postMessage({ ...msg, id } as WorkerIn);
    });
  }

  cancel() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

const main = new Channel();
const hints = new Channel();

async function move(ch: Channel, req: AiRequest) {
  const out = await ch.send({ type: 'move', req });
  if (out.type !== 'move') throw new Error('unexpected');
  return { move: out.move, winrate: out.winrate };
}

export const requestMove = (req: AiRequest) => move(main, req);
export const requestHint = (req: AiRequest) => move(hints, req);

export async function requestDead(board: Uint8Array, size: number, toPlay: Color): Promise<number[]> {
  const out = await main.send({ type: 'dead', board, size, toPlay });
  if (out.type !== 'dead') throw new Error('unexpected');
  return out.dead;
}

/** 進行中の思考を捨てる（待った・退出時）。 */
export function cancelAi() {
  main.cancel();
}
export function cancelHint() {
  hints.cancel();
}
