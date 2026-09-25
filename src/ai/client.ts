// AI は Web Worker で動かし、画面を止めない。キャンセル時はワーカーごと作り直す。
// 対局用とヒント用でワーカーを分け、ヒントの計算が相手の着手を待たせないようにする。
import type { Color } from '../engine/board';
import type { AiRequest } from './mcts';
import type { WorkerIn, WorkerOut } from './worker';

type Msg = WorkerIn extends infer T ? (T extends { id: number } ? Omit<T, 'id'> : never) : never;

let nextId = 1;

class Channel {
  private worker: Worker | null = null;
  private pending = new Map<number, (out: WorkerOut) => void>();

  private get(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerOut>) => {
        const cb = this.pending.get(e.data.id);
        if (cb) {
          this.pending.delete(e.data.id);
          cb(e.data);
        }
      };
    }
    return this.worker;
  }

  send(msg: Msg): Promise<WorkerOut> {
    return new Promise((resolve) => {
      const id = nextId++;
      this.pending.set(id, resolve);
      this.get().postMessage({ ...msg, id } as WorkerIn);
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
