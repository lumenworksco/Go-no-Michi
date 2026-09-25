import { useEffect, useMemo, useRef, useState } from 'react';
import { BLACK, WHITE, EMPTY, opp, neighbors, libertyCount, type Color } from '../engine/board';
import { newGame, playMove, passMove, isOver, scoreGame, chainOf, formatMokusu, type GameState } from '../engine/game';
import { toSgf } from '../engine/sgf';
import { requestMove, requestHint, requestDead, cancelAi, cancelHint } from '../ai/client';
import { ja } from '../ja';
import { playStone, playCapture, playChime, vibrate } from '../audio';
import { moveMark } from '../notation';
import { addRecord, clearSavedGame, storeSavedGame, type SavedGame } from '../save';
import { Board, type FadingStone } from './Board';
import { BackButton, Dots, Sheet, StoneIcon, TopActions, TopBar, useToast } from './common';
import type { GameSettings } from './Setup';

interface Snap {
  state: GameState;
  /** この状態に至った着手（交点 / パスは -1 / 開始局面は -2） */
  move: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const colorName = (c: Color) => (c === BLACK ? ja.game.black : ja.game.white);

function replay(initial: GameState, moves: number[]): Snap[] {
  const hist: Snap[] = [{ state: initial, move: -2 }];
  for (const m of moves) {
    const s = hist[hist.length - 1].state;
    if (m < 0) hist.push({ state: passMove(s), move: -1 });
    else {
      const r = playMove(s, m);
      if (!r.ok) break;
      hist.push({ state: r.state, move: m });
    }
  }
  return hist;
}

const Arrow = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export function GameScreen({
  settings,
  resume,
  onExit,
  onRematch,
}: {
  settings: GameSettings;
  resume?: SavedGame | null;
  onExit: () => void;
  onRematch: () => void;
}) {
  const human: Color = useMemo(
    () => resume?.human ?? (settings.color === 'random' ? (Math.random() < 0.5 ? BLACK : WHITE) : settings.color),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.color],
  );
  const isAi = settings.mode === 'ai';
  const initial = useMemo(() => newGame(settings.size, settings.komi, settings.handicap), [settings]);
  const [hist, setHist] = useState<Snap[]>(() => replay(initial, resume?.moves ?? []));
  const cur = hist[hist.length - 1].state;
  const curRef = useRef(cur);
  curRef.current = cur;

  const [thinking, setThinking] = useState(false);
  const [fading, setFading] = useState<FadingStone[]>([]);
  const [moveKey, setMoveKey] = useState(0);
  const [animateLast, setAnimateLast] = useState(true);
  const [dead, setDead] = useState<Set<number>>(new Set());
  const [estimating, setEstimating] = useState(false);
  const [finished, setFinished] = useState(false);
  const [resigned, setResigned] = useState<Color | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [confirm, setConfirm] = useState<null | 'resign' | 'leave'>(null);
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);
  const [hint, setHint] = useState(-1);
  const [hinting, setHinting] = useState(false);
  const token = useRef(0);
  const hintToken = useRef(0);
  const recorded = useRef(false);
  const toast = useToast();

  const over = isOver(cur);
  const phase: 'play' | 'scoring' | 'done' = resigned || finished ? 'done' : over ? 'scoring' : 'play';
  const aiFirst = isAi && initial.toPlay !== human;
  const baseLen = aiFirst ? 2 : 1;
  const canUndo = hist.length > baseLen && phase !== 'done';

  // ---- 自動保存（中断して、ホームの「続きから」で再開できる） ----------------
  useEffect(() => {
    if (phase === 'done') clearSavedGame();
    else if (hist.length > 1) storeSavedGame({ settings, human, moves: hist.slice(1).map((h) => h.move) });
  }, [hist, phase, settings, human]);

  // ---- 着手 ----------------------------------------------------------
  const doPlay = (idx: number) => {
    const s = curRef.current;
    const r = playMove(s, idx);
    if (!r.ok) return r.reason;
    setHist((h) => [...h, { state: r.state, move: idx }]);
    const gone = opp(s.toPlay);
    setFading(r.captured.map((i, k) => ({ idx: i, color: gone, key: Date.now() + k })));
    setAnimateLast(true);
    setMoveKey((k) => k + 1);
    playStone();
    if (r.captured.length) {
      playCapture(r.captured.length);
      vibrate([10, 40, 10]);
    } else {
      vibrate(8);
      const nb = neighbors(s.size)[idx];
      if (nb.some((q) => r.state.board[q] === gone && libertyCount(r.state.board, s.size, q) === 1)) toast.show(ja.game.atari, 1100);
    }
    return null;
  };

  const doPass = () => {
    const s = curRef.current;
    setHist((h) => [...h, { state: passMove(s), move: -1 }]);
    setFading([]);
    setAnimateLast(true);
    playChime(false);
    vibrate(6);
  };

  const onPoint = (idx: number) => {
    if (phase === 'scoring') {
      const s = curRef.current;
      if (s.board[idx] === EMPTY) return;
      const chain = chainOf(s, idx);
      setDead((d) => {
        const n = new Set(d);
        if (chain.every((p) => n.has(p))) chain.forEach((p) => n.delete(p));
        else chain.forEach((p) => n.add(p));
        return n;
      });
      playStone(0.4);
      return;
    }
    if (phase !== 'play' || thinking || (isAi && cur.toPlay !== human)) return;
    const err = doPlay(idx);
    if (err === 'ko') toast.show(ja.game.ko);
    else if (err === 'suicide') toast.show(ja.game.suicide);
  };

  // ---- コンピュータの手番 -------------------------------------------------
  useEffect(() => {
    if (!isAi || over || resigned || cur.toPlay === human) return;
    const my = ++token.current;
    let settled = false;
    setThinking(true);
    const started = performance.now();
    requestMove({
      size: cur.size,
      board: cur.board,
      toPlay: cur.toPlay,
      ko: cur.ko,
      komi: cur.komi,
      moveNo: cur.moveNo,
      last: cur.last,
      opponentPassed: cur.passes === 1,
      level: settings.level,
    }).then(async (r) => {
      await sleep(Math.max(0, 500 - (performance.now() - started)));
      if (my !== token.current) return;
      settled = true;
      setThinking(false);
      if (r.move < 0) {
        doPass();
        toast.show(ja.game.passed(ja.game.computer));
      } else if (doPlay(r.move) !== null) {
        doPass(); // 起こらないはずだが、止まらないようにする
      }
    });
    return () => {
      if (settled) return; // 思考が終わった後の後始末ではワーカーを残す
      token.current++;
      cancelAi();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist, resigned]);

  // ---- 死に石の推定 ---------------------------------------------------------
  useEffect(() => {
    if (!over || resigned) return;
    let cancelled = false;
    let settled = false;
    setEstimating(true);
    setDead(new Set());
    requestDead(cur.board, cur.size, cur.toPlay).then((d) => {
      if (cancelled) return;
      settled = true;
      setDead(new Set(d));
      setEstimating(false);
    });
    return () => {
      cancelled = true;
      if (!settled) cancelAi();
      setEstimating(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, hist.length, resigned]);

  useEffect(
    () => () => {
      cancelAi();
      cancelHint();
    },
    [],
  );

  // 局面が変わったらヒントは消す
  useEffect(() => {
    hintToken.current++;
    cancelHint();
    setHint(-1);
    setHinting(false);
  }, [hist]);

  const autoDead = () => {
    setEstimating(true);
    requestDead(cur.board, cur.size, cur.toPlay).then((d) => {
      setDead(new Set(d));
      setEstimating(false);
    });
  };

  // ---- 操作 -----------------------------------------------------------
  const undo = () => {
    if (!canUndo) return;
    token.current++;
    cancelAi();
    setThinking(false);
    setFading([]);
    setAnimateLast(false);
    setHist((h) => {
      let n = h.slice(0, -1);
      if (isAi) while (n.length > 1 && n[n.length - 1].state.toPlay !== human) n = n.slice(0, -1);
      return n;
    });
  };

  const resumePlay = () => {
    setFading([]);
    setAnimateLast(false);
    setHist((h) => {
      const n = [...h];
      while (n.length > 1 && n[n.length - 1].state.passes > 0) n.pop();
      return n;
    });
  };

  const finish = () => {
    setFinished(true);
    setShowResult(true);
  };

  const resign = () => {
    setConfirm(null);
    setResigned(isAi ? human : cur.toPlay);
    setShowResult(true);
    cancelAi();
    setThinking(false);
  };

  const leave = () => {
    if (phase === 'done' || cur.moveNo === 0) onExit();
    else setConfirm('leave');
  };

  const askHint = () => {
    if (!isAi || phase !== 'play' || thinking || hinting || cur.toPlay !== human) return;
    const my = ++hintToken.current;
    setHinting(true);
    requestHint({
      size: cur.size,
      board: cur.board,
      toPlay: cur.toPlay,
      ko: cur.ko,
      komi: cur.komi,
      moveNo: cur.moveNo,
      last: cur.last,
      opponentPassed: cur.passes === 1,
      level: 'chukyu',
    }).then((r) => {
      if (my !== hintToken.current) return;
      setHinting(false);
      if (r.move < 0) toast.show(ja.game.hintPass);
      else setHint(r.move);
    });
  };

  // ---- 表示用 ---------------------------------------------------------
  const score = useMemo(() => (over ? scoreGame(cur, dead) : null), [over, cur, dead]);
  const winner: Color | 0 | null = resigned ? opp(resigned) : finished && score ? score.winner : null;

  useEffect(() => {
    if (phase !== 'done' || winner === null) return;
    playChime(!isAi || winner === human || winner === 0);
    if (isAi && !recorded.current) {
      recorded.current = true;
      addRecord(winner === 0 ? 'draw' : winner === human ? 'win' : 'lose');
    }
  }, [phase, winner, isAi, human]);

  const last = hist.length - 1;
  const viewIdx = phase === 'done' ? (reviewIdx ?? last) : last;
  const view = hist[viewIdx].state;
  const atEnd = viewIdx === last;
  const stepReview = (to: number) => {
    setAnimateLast(false);
    setFading([]);
    setReviewIdx(Math.max(0, Math.min(last, to)));
  };

  const topColor: Color = isAi ? opp(human) : WHITE;
  const bottomColor: Color = opp(topColor);
  const myTurn = phase === 'play' && (!isAi || cur.toPlay === human) && !thinking;
  const playerName = (c: Color) => (isAi ? (c === human ? ja.game.you : ja.game.computer) : colorName(c));

  const markOf = (s: GameState, idx: number) => moveMark(s.size, opp(s.toPlay), hist[idx].move);
  const titleText =
    phase === 'scoring' ? ja.game.scoring : view.moveNo === 0 ? ja.game.moveNo(0) : ja.game.moveLabel(view.moveNo, markOf(view, viewIdx));

  // キーボード操作（デスクトップ）。常に最新のハンドラを ref 経由で呼ぶ。
  const kb = useRef<(e: KeyboardEvent) => void>(() => {});
  kb.current = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (confirm) setConfirm(null);
      else if (showResult) setShowResult(false);
      return;
    }
    if (confirm || (showResult && phase === 'done')) return;
    const k = e.key.toLowerCase();
    if (phase === 'play') {
      if (k === 'p' && myTurn) doPass();
      else if (k === 'u') undo();
      else if (k === 'h') askHint();
    } else if (phase === 'done') {
      if (e.key === 'ArrowLeft') stepReview(viewIdx - 1);
      else if (e.key === 'ArrowRight') stepReview(viewIdx + 1);
      else if (e.key === 'Home') stepReview(0);
      else if (e.key === 'End') stepReview(last);
    }
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => kb.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  // ---- 棋譜 -----------------------------------------------------------
  const sgf = () => {
    const code =
      resigned !== null
        ? `${opp(resigned) === BLACK ? 'B' : 'W'}+R`
        : score
          ? score.winner === 0
            ? '0'
            : `${score.winner === BLACK ? 'B' : 'W'}+${Math.abs(score.margin)}`
          : undefined;
    return toSgf({
      size: settings.size,
      komi: settings.komi,
      handicap: settings.handicap,
      first: initial.toPlay,
      moves: hist.slice(1).map((h) => h.move),
      result: code,
      blackName: isAi ? (human === BLACK ? ja.game.you : ja.game.computer) : ja.game.black,
      whiteName: isAi ? (human === WHITE ? ja.game.you : ja.game.computer) : ja.game.white,
    });
  };
  const copySgf = async () => {
    try {
      await navigator.clipboard.writeText(sgf());
      toast.show(ja.game.copied);
    } catch {
      toast.show(ja.game.copyFail);
    }
  };
  const saveSgf = () => {
    try {
      const url = URL.createObjectURL(new Blob([sgf()], { type: 'application/x-go-sgf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ごのみち-${new Date().toISOString().slice(0, 10)}.sgf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.show(ja.game.saved);
    } catch {
      toast.show(ja.game.copyFail);
    }
  };

  const bar = (c: Color) => (
    <div className={`pbar ${c === topColor ? 'top' : 'bottom'}${phase === 'play' && cur.toPlay === c ? ' active' : ''}`}>
      <StoneIcon color={c} size={26} />
      <div className="pname">
        <b>{playerName(c)}</b>
        <small>
          {isAi && c !== human ? ja.setup.levelName[settings.level] : c === BLACK ? ja.game.blackTurn : ja.game.whiteTurn}
          {c === WHITE && cur.komi > 0 ? ` ・ ${ja.game.komi(ja.setup.komiValue(cur.komi))}` : ''}
        </small>
      </div>
      <div className="pstat">
        {thinking && isAi && c !== human && phase === 'play' ? (
          <span className="thinking">
            {ja.game.thinking}
            <Dots />
          </span>
        ) : (
          <span className="cap">{ja.game.prisoners(view.prisoners[c] + (score && atEnd ? score.deadCount[opp(c)] : 0))}</span>
        )}
      </div>
    </div>
  );

  const resultText = (() => {
    if (winner === null) return '';
    if (resigned) return ja.game.winResign(colorName(winner as Color));
    if (winner === 0) return ja.game.jigo;
    return ja.game.winBy(colorName(winner), formatMokusu(score!.margin));
  })();
  const youWon = winner !== null && winner !== 0 && isAi ? winner === human : null;

  return (
    <div className="screen game">
      <TopBar left={<BackButton onClick={leave} label={ja.game.back} />} title={titleText} right={<TopActions />} />
      <div className="sr-only" aria-live="polite">
        {view.moveNo > 0 ? ja.game.announce(view.moveNo, markOf(view, viewIdx)) : ''}
      </div>

      {bar(topColor)}

      <div className="board-area">
        <Board
          size={view.size}
          board={view.board}
          last={view.last}
          ko={atEnd ? view.ko : -1}
          ghostColor={cur.toPlay}
          interactive={myTurn || phase === 'scoring'}
          canPlay={phase === 'scoring' ? () => false : (i) => cur.board[i] === EMPTY && i !== cur.ko}
          onPoint={onPoint}
          fading={fading}
          dead={over && atEnd ? dead : undefined}
          owner={over && atEnd ? score?.owner : undefined}
          hint={hint}
          moveKey={moveKey}
          animateLast={animateLast}
        />
      </div>

      {bar(bottomColor)}

      {phase === 'play' && (
        <div className="actions">
          <button className="act" onClick={undo} disabled={!canUndo}>
            {ja.game.undo}
          </button>
          {isAi && (
            <button className="act" onClick={askHint} disabled={!myTurn || hinting}>
              {hinting ? ja.game.hinting : ja.game.hint}
            </button>
          )}
          <button
            className="act"
            onClick={() => {
              if (myTurn) doPass();
            }}
            disabled={!myTurn}
          >
            {ja.game.pass}
          </button>
          <button className="act danger" onClick={() => setConfirm('resign')} disabled={cur.moveNo === 0}>
            {ja.game.resign}
          </button>
        </div>
      )}

      {phase === 'scoring' && score && (
        <div className="scorebar">
          <div className="score-line">
            <span>
              <StoneIcon color={BLACK} size={16} /> {ja.game.black} <b>{score.black}</b>
            </span>
            <span className="help">
              {estimating ? (
                <>
                  {ja.game.estimating}
                  <Dots />
                </>
              ) : (
                ja.game.scoringHelp
              )}
            </span>
            <span>
              <StoneIcon color={WHITE} size={16} /> {ja.game.white} <b>{score.white}</b>
            </span>
          </div>
          <div className="actions">
            <button className="act" onClick={autoDead} disabled={estimating}>
              {ja.game.autoDead}
            </button>
            <button className="act" onClick={resumePlay}>
              {ja.game.resume}
            </button>
            <button className="act primary" onClick={finish}>
              {ja.game.finish}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="scorebar">
          <div className="result-line">{resultText}</div>
          <div className="review" role="group" aria-label={ja.game.review}>
            <button className="icon-btn" onClick={() => stepReview(0)} disabled={viewIdx === 0} aria-label={ja.game.first}>
              <Arrow d="M6 5v14M18 5l-8 7 8 7" />
            </button>
            <button className="icon-btn" onClick={() => stepReview(viewIdx - 1)} disabled={viewIdx === 0} aria-label={ja.game.prev}>
              <Arrow d="M15 5l-7 7 7 7" />
            </button>
            <span className="review-pos">
              {viewIdx} / {last}
            </span>
            <button className="icon-btn" onClick={() => stepReview(viewIdx + 1)} disabled={atEnd} aria-label={ja.game.next}>
              <Arrow d="M9 5l7 7-7 7" />
            </button>
            <button className="icon-btn" onClick={() => stepReview(last)} disabled={atEnd} aria-label={ja.game.lastMove}>
              <Arrow d="M18 5v14M6 5l8 7-8 7" />
            </button>
          </div>
          <div className="actions">
            <button className="act" onClick={() => setShowResult(true)}>
              {ja.game.resultBtn}
            </button>
            <button className="act" onClick={onRematch}>
              {ja.game.againBtn}
            </button>
            <button className="act" onClick={onExit}>
              {ja.game.homeBtn}
            </button>
          </div>
        </div>
      )}

      {toast.node}

      {confirm === 'resign' && (
        <Sheet onClose={() => setConfirm(null)}>
          <h2>{ja.game.resignAsk}</h2>
          <p>{ja.game.resignBody}</p>
          <div className="sheet-actions">
            <button className="act" onClick={() => setConfirm(null)}>
              {ja.game.cancel}
            </button>
            <button className="act danger solid" onClick={resign}>
              {ja.game.resignYes}
            </button>
          </div>
        </Sheet>
      )}

      {confirm === 'leave' && (
        <Sheet onClose={() => setConfirm(null)}>
          <h2>{ja.game.leaveAsk}</h2>
          <p>{ja.game.leaveBody}</p>
          <div className="sheet-actions">
            <button className="act" onClick={() => setConfirm(null)}>
              {ja.game.keepPlaying}
            </button>
            <button className="act primary" onClick={onExit}>
              {ja.game.leaveYes}
            </button>
          </div>
        </Sheet>
      )}

      {phase === 'done' && showResult && (
        <Sheet onClose={() => setShowResult(false)}>
          <div className="result">
            <small className="kicker">{ja.game.resultTitle}</small>
            {youWon !== null && <div className={`verdict ${youWon ? 'win' : 'lose'}`}>{youWon ? ja.game.youWin : ja.game.youLose}</div>}
            <h2>{resultText}</h2>
            {!resigned && score && (
              <table className="score-table">
                <thead>
                  <tr>
                    <th />
                    <th>
                      <StoneIcon color={BLACK} size={16} /> {ja.game.black}
                    </th>
                    <th>
                      <StoneIcon color={WHITE} size={16} /> {ja.game.white}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{ja.game.territory}</td>
                    <td>{score.territory[BLACK]}</td>
                    <td>{score.territory[WHITE]}</td>
                  </tr>
                  <tr>
                    <td>{ja.game.prisonersLabel}</td>
                    <td>{score.prisoners[BLACK]}</td>
                    <td>{score.prisoners[WHITE]}</td>
                  </tr>
                  <tr>
                    <td>{ja.game.komiRow}</td>
                    <td>—</td>
                    <td>{score.komi}</td>
                  </tr>
                  <tr className="sum">
                    <td>{ja.game.total}</td>
                    <td>{score.black}</td>
                    <td>{score.white}</td>
                  </tr>
                </tbody>
              </table>
            )}
            <div className="sheet-actions">
              <button className="act" onClick={() => setShowResult(false)}>
                {ja.game.reviewBtn}
              </button>
              <button className="act" onClick={onExit}>
                {ja.game.homeBtn}
              </button>
              <button className="act primary" onClick={onRematch}>
                {ja.game.againBtn}
              </button>
            </div>
            <div className="sheet-links">
              <button onClick={copySgf}>{ja.game.copySgf}</button>
              <button onClick={saveSgf}>{ja.game.saveSgf}</button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
