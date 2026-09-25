import { chooseMove, estimateDead, type AiRequest } from './mcts';
import type { Color } from '../engine/board';

export type WorkerIn =
  | { id: number; type: 'move'; req: AiRequest }
  | { id: number; type: 'dead'; board: Uint8Array; size: number; toPlay: Color };

export type WorkerOut =
  | { id: number; type: 'move'; move: number; winrate: number }
  | { id: number; type: 'dead'; dead: number[] };

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.type === 'move') {
    const r = chooseMove(m.req);
    (self as unknown as Worker).postMessage({ id: m.id, type: 'move', move: r.move, winrate: r.winrate } satisfies WorkerOut);
  } else {
    const dead = estimateDead(m.board, m.size, m.toPlay);
    (self as unknown as Worker).postMessage({ id: m.id, type: 'dead', dead } satisfies WorkerOut);
  }
};
