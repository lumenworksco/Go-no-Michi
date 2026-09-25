import { describe, expect, it } from 'vitest';
import { groupAt, WHITE, BLACK } from '../engine/board';
import { playMove, passMove } from '../engine/game';
import { PUZZLES, puzzleSolver, puzzleState, puzzleSpec, WINDOW } from './problems';
import { isCaptured, inWindow } from './solver';

describe('詰碁の出題', () => {
  for (const p of PUZZLES) {
    describe(`問題 id=${p.id}`, () => {
      const s0 = puzzleState(p);
      const solver = puzzleSolver(p);

      it('盤面が正しい（呼吸点0の連がなく、目標は白石）', () => {
        for (let i = 0; i < s0.board.length; i++) {
          if (s0.board[i] === 0) continue;
          expect(groupAt(s0.board, s0.size, i).liberties.length).toBeGreaterThan(0);
        }
        expect(s0.board[puzzleSpec(p).targets[0]]).toBe(WHITE);
      });

      it(`ちょうど${p.moves}手で取れる（それより短くは取れない）`, () => {
        expect(solver.correctMoves(s0, p.moves).length).toBeGreaterThan(0);
        if (p.moves > 1) expect(solver.correctMoves(s0, p.moves - 1)).toEqual([]);
        expect(solver.minMoves(s0, p.moves)).toBe(p.moves);
      });

      it('最善の抵抗に対しても手順通りに取れる', () => {
        let s = s0;
        let left = p.moves;
        for (;;) {
          const moves = solver.correctMoves(s, left);
          expect(moves.length).toBeGreaterThan(0);
          const m = moves[0];
          expect(inWindow(m, s.size, WINDOW)).toBe(true);
          const r = playMove(s, m);
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          s = r.state;
          left--;
          if (isCaptured(s, puzzleSpec(p))) break;
          expect(left).toBeGreaterThan(0);
          const d = solver.bestDefence(s, left);
          if (d === -1) s = passMove(s);
          else {
            const rd = playMove(s, d);
            expect(rd.ok).toBe(true);
            if (!rd.ok) return;
            s = rd.state;
          }
          expect(s.toPlay).toBe(BLACK);
        }
      });
    });
  }
});

describe('出題一覧', () => {
  it('id は重複せず、易しい順（手数が増える順）に並ぶ', () => {
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
    for (let i = 1; i < PUZZLES.length; i++) expect(PUZZLES[i].moves).toBeGreaterThanOrEqual(PUZZLES[i - 1].moves);
  });
});
