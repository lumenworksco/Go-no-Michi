import { useEffect, useMemo, useRef, useState } from 'react';
import { BLACK, EMPTY } from '../engine/board';
import { passMove, playMove, type GameState } from '../engine/game';
import { ja } from '../ja';
import { playStone, playCapture, playChime, vibrate } from '../audio';
import { CROP, PUZZLES, puzzleNumber, PUZZLE_BOARD_SIZE, WINDOW, puzzleSolver, puzzleSpec, puzzleState, type Puzzle } from '../tsumego/problems';
import { inWindow, isCaptured } from '../tsumego/solver';
import { Board, type FadingStone } from './Board';
import { BackButton, StoneIcon, TopActions, TopBar, useToast } from './common';

export function TsumegoList({ solved, onPick, onBack }: { solved: number[]; onPick: (p: Puzzle) => void; onBack: () => void }) {
  return (
    <div className="screen">
      <TopBar left={<BackButton onClick={onBack} />} title={ja.tsumego.title} />
      <div className="scroll">
        <p className="progress-line">{ja.tsumego.progress(solved.length, PUZZLES.length)}</p>
        <div className="puzzle-grid">
          {PUZZLES.map((p) => {
            const done = solved.includes(p.id);
            return (
              <button key={p.id} className={`pcard${done ? ' done' : ''}`} onClick={() => onPick(p)}>
                <div className="pthumb">
                  <Board size={PUZZLE_BOARD_SIZE} board={puzzleState(p).board} view={CROP} />
                </div>
                <div className="pmeta">
                  <b>{ja.tsumego.problem(puzzleNumber(p))}</b>
                  <span className={`tag l${p.moves}`}>{ja.tsumego.level[p.moves]}</span>
                </div>
                {done && <span className="check" aria-label={ja.tsumego.solved}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type Status = 'playing' | 'solved' | 'failed' | 'showing' | 'shown';

export function TsumegoPlay({
  puzzle,
  onSolved,
  onBack,
  onNext,
  hasNext,
}: {
  puzzle: Puzzle;
  onSolved: (id: number) => void;
  onBack: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const solver = useMemo(() => puzzleSolver(puzzle), [puzzle]);
  const spec = useMemo(() => puzzleSpec(puzzle), [puzzle]);
  const start = useMemo(() => puzzleState(puzzle), [puzzle]);
  const [steps, setSteps] = useState<{ s: GameState; l: number }[]>([{ s: start, l: puzzle.moves }]);
  const [status, setStatus] = useState<Status>('playing');
  const [hint, setHint] = useState(-1);
  const [fading, setFading] = useState<FadingStone[]>([]);
  const [moveKey, setMoveKey] = useState(0);
  const [animateLast, setAnimateLast] = useState(true);
  const timers = useRef<number[]>([]);
  const toast = useToast();

  const cur = steps[steps.length - 1].s;
  const left = steps[steps.length - 1].l;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pushState = (s: GameState, l: number, captured: number[], moverWasBlack: boolean) => {
    setSteps((h) => [...h, { s, l }]);
    setFading(captured.map((i, k) => ({ idx: i, color: moverWasBlack ? 2 : 1, key: Date.now() + k })));
    setAnimateLast(true);
    setMoveKey((k) => k + 1);
    playStone();
    if (captured.length) {
      playCapture(captured.length);
      vibrate([10, 40, 10]);
    } else vibrate(8);
  };

  /** 白の最善の抵抗を打つ。 */
  const whiteReplies = (s: GameState, l: number) => {
    const d = solver.bestDefence(s, l);
    if (d === -1 || d === -2) {
      setSteps((h) => [...h, { s: passMove(s), l }]);
      toast.show(ja.tsumego.whitePassed);
      return;
    }
    const r = playMove(s, d);
    if (r.ok) pushState(r.state, l, r.captured, false);
  };

  const onPoint = (idx: number) => {
    if (status !== 'playing' || cur.toPlay !== BLACK) return;
    if (!inWindow(idx, cur.size, WINDOW)) return;
    setHint(-1);
    const r = playMove(cur, idx);
    if (!r.ok) {
      toast.show(r.reason === 'ko' ? ja.game.ko : r.reason === 'suicide' ? ja.game.suicide : ja.tsumego.tap);
      return;
    }
    const nl = left - 1;
    pushState(r.state, nl, r.captured, true);
    if (isCaptured(r.state, spec)) {
      setStatus('solved');
      onSolved(puzzle.id);
      later(() => playChime(true), 350);
    } else if (nl > 0 && solver.defenderLoses(r.state, nl)) {
      const ns = r.state;
      later(() => whiteReplies(ns, nl), 450);
    } else {
      setStatus('failed');
      playChime(false);
    }
  };

  const retry = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSteps([{ s: start, l: puzzle.moves }]);
    setStatus('playing');
    setHint(-1);
    setFading([]);
    setAnimateLast(false);
  };

  const undo = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAnimateLast(false);
    setFading([]);
    // 黒の手番まで戻す（白の応手があれば2手戻る）
    setSteps((h) => {
      let n = h.slice(0, -1);
      while (n.length > 1 && n[n.length - 1].s.toPlay !== BLACK) n = n.slice(0, -1);
      return n;
    });
    setStatus('playing');
    setHint(-1);
  };

  const showHint = () => {
    if (status !== 'playing' || cur.toPlay !== BLACK) return;
    const m = solver.correctMoves(cur, left);
    if (m.length) setHint(m[0]);
  };

  const showAnswer = () => {
    retry();
    setStatus('showing');
    let s = start;
    let l: number = puzzle.moves;
    let t = 500;
    for (let guard = 0; guard < 8; guard++) {
      const m = solver.correctMoves(s, l)[0];
      if (m === undefined) break;
      const r = playMove(s, m);
      if (!r.ok) break;
      const black = r;
      const l2 = l - 1;
      later(() => pushState(black.state, l2, black.captured, true), t);
      t += 750;
      s = black.state;
      l = l2;
      if (isCaptured(s, spec) || l <= 0) break;
      const d = solver.bestDefence(s, l);
      const wr = d < 0 ? null : playMove(s, d);
      if (wr && wr.ok) {
        const white = wr;
        later(() => pushState(white.state, l2, white.captured, false), t);
        t += 750;
        s = white.state;
      } else {
        s = passMove(s);
      }
    }
    later(() => setStatus('shown'), t);
  };

  const canUndo = steps.length > 1 && (status === 'playing' || status === 'failed');

  return (
    <div className="screen tsumego">
      <TopBar left={<BackButton onClick={onBack} label={ja.tsumego.list} />} title={ja.tsumego.problem(puzzleNumber(puzzle))} right={
          <>
            <span className={`tag l${puzzle.moves}`}>{ja.tsumego.level[puzzle.moves]}</span>
            <TopActions />
          </>
        } />
      <div className="goal">
        <StoneIcon color={BLACK} size={18} />
        <span>{ja.tsumego.goal(puzzle.moves)}</span>
      </div>
      <div className="board-area tsumego-board">
        <Board
          size={PUZZLE_BOARD_SIZE}
          board={cur.board}
          last={cur.last}
          ko={cur.ko}
          ghostColor={BLACK}
          view={CROP}
          interactive={status === 'playing' && cur.toPlay === BLACK}
          canPlay={(i) => cur.board[i] === EMPTY && i !== cur.ko && inWindow(i, cur.size, WINDOW)}
          onPoint={onPoint}
          fading={fading}
          hint={hint}
          moveKey={moveKey}
          animateLast={animateLast}
        />
      </div>

      <div className={`t-status ${status}`} aria-live="polite">
        {status === 'playing' && <span>{ja.tsumego.tap}</span>}
        {status === 'solved' && <b>{ja.tsumego.correct}</b>}
        {status === 'failed' && (
          <>
            <b>{ja.tsumego.wrong}</b>
            <small>{ja.tsumego.wrongSub}</small>
          </>
        )}
        {(status === 'showing' || status === 'shown') && <span>{ja.tsumego.showing}</span>}
      </div>

      <div className="actions">
        {status === 'playing' && (
          <>
            <button className="act" onClick={showHint}>
              {ja.tsumego.hint}
            </button>
            <button className="act" onClick={undo} disabled={!canUndo}>
              {ja.tsumego.undo}
            </button>
            <button className="act" onClick={showAnswer}>
              {ja.tsumego.answer}
            </button>
          </>
        )}
        {status === 'failed' && (
          <>
            <button className="act" onClick={undo}>
              {ja.tsumego.undo}
            </button>
            <button className="act" onClick={retry}>
              {ja.tsumego.retry}
            </button>
            <button className="act" onClick={showAnswer}>
              {ja.tsumego.answer}
            </button>
          </>
        )}
        {(status === 'solved' || status === 'shown') && (
          <>
            <button className="act" onClick={retry}>
              {ja.tsumego.retry}
            </button>
            <button className="act primary" onClick={hasNext ? onNext : onBack}>
              {hasNext ? ja.tsumego.next : ja.tsumego.list}
            </button>
          </>
        )}
      </div>
      {toast.node}
    </div>
  );
}
