import { useEffect, useMemo, useState } from 'react';
import { BLACK, WHITE, type Color } from '../engine/board';
import { buildReplay } from '../engine/replay';
import type { ParsedSgf } from '../engine/sgfParse';
import { ja } from '../ja';
import { moveMark, sgfResultText } from '../notation';
import { Board } from './Board';
import { Arrow, BackButton, StoneIcon, TopBar, TopActions } from './common';

/** 読みこんだ棋譜を、一手ずつ見る画面。 */
export function Review({ game, onBack }: { game: ParsedSgf; onBack: () => void }) {
  // 変化の分かれ目での選び方（節の番号 → 何番めの候補か）。選びなおしたら、それより先の選択は捨てる。
  const [choices, setChoices] = useState<Record<number, number>>({});
  const replay = useMemo(() => buildReplay(game, choices), [game, choices]);
  const last = replay.snaps.length - 1;
  const [rawIdx, setIdx] = useState(0);
  const idx = Math.min(rawIdx, last);
  const step = (to: number) => setIdx(Math.max(0, Math.min(last, to)));
  const node = replay.line[idx];
  const forks = node.children.filter((c) => c.move);
  const chosen = choices[idx] ?? 0;
  const pickVariation = (k: number) => {
    setChoices((prev) => {
      const next: Record<number, number> = {};
      for (const key of Object.keys(prev)) if (Number(key) < idx) next[Number(key)] = prev[Number(key)];
      next[idx] = k;
      return next;
    });
    setIdx(idx + 1); // 選んだ変化の 1 手目を表示する
  };

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') step(idx - 1);
      else if (e.key === 'ArrowRight') step(idx + 1);
      else if (e.key === 'Home') step(0);
      else if (e.key === 'End') step(last);
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && forks.length > 1) {
        e.preventDefault();
        const k = (chosen + (e.key === 'ArrowDown' ? 1 : forks.length - 1)) % forks.length;
        pickVariation(k);
        setIdx(idx); // 候補を切りかえるだけで、いまの位置にとどまる
      }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });

  const snap = replay.snaps[idx];
  const view = snap.state;
  const mark = idx > 0 ? moveMark(game.size, snap.color, snap.move) : '';
  const title = idx === 0 ? ja.game.moveNo(0) : ja.game.moveLabel(idx, mark);
  const result = game.result ? sgfResultText(game.result) : null;
  const nameOf = (c: Color) => (c === BLACK ? game.blackName : game.whiteName) || (c === BLACK ? ja.game.black : ja.game.white);

  const bar = (c: Color, pos: 'top' | 'bottom') => (
    <div className={`pbar ${pos}`}>
      <StoneIcon color={c} size={26} />
      <div className="pname">
        <b>{nameOf(c)}</b>
        <small>{c === BLACK ? ja.game.blackTurn : ja.game.whiteTurn}{c === WHITE && game.komi > 0 ? ` ・ ${ja.game.komi(ja.setup.komiValue(game.komi))}` : ''}</small>
      </div>
      <div className="pstat">
        <span className="cap">{ja.game.prisoners(view.prisoners[c])}</span>
      </div>
    </div>
  );

  return (
    <div className="screen game review-screen">
      <TopBar left={<BackButton onClick={onBack} />} title={title} right={<TopActions />} />
      <div className="sr-only" aria-live="polite">
        {idx > 0 ? ja.game.announce(idx, mark) : ''}
      </div>
      {bar(WHITE, 'top')}
      <div className="board-area">
        <Board size={view.size} board={view.board} last={view.last} animateLast={false} />
      </div>
      {bar(BLACK, 'bottom')}
      <div className="scorebar">
        {result && <div className="result-line">{result}</div>}
        {game.date && <p className="review-meta">{game.date}</p>}
        {node.comment && (
          <p className="sgf-comment" aria-label={ja.sgf.comment}>
            {node.comment}
          </p>
        )}
        {forks.length > 1 && (
          <div className="variations" role="group" aria-label={ja.sgf.variations}>
            <small>{ja.sgf.variationsHelp}</small>
            <div className="chips">
              {forks.map((c, k) => (
                <button key={k} className={k === chosen ? 'chip on' : 'chip'} aria-pressed={k === chosen} onClick={() => pickVariation(k)}>
                  {moveMark(game.size, c.move!.color, c.move!.point)}
                  {k === 0 ? ` ${ja.sgf.mainLine}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}
        {replay.stoppedAt !== null && <p className="review-meta" role="status">{ja.sgf.stopped(replay.stoppedAt)}</p>}
        {last === 0 && replay.stoppedAt === null && <p className="review-meta">{ja.sgf.noMoves}</p>}
        <div className="review" role="group" aria-label={ja.game.review}>
          <button className="icon-btn" onClick={() => step(0)} disabled={idx === 0} aria-label={ja.game.first}>
            <Arrow d="M6 5v14M18 5l-8 7 8 7" />
          </button>
          <button className="icon-btn" onClick={() => step(idx - 1)} disabled={idx === 0} aria-label={ja.game.prev}>
            <Arrow d="M15 5l-7 7 7 7" />
          </button>
          <span className="review-pos">
            {idx} / {last}
          </span>
          <button className="icon-btn" onClick={() => step(idx + 1)} disabled={idx === last} aria-label={ja.game.next}>
            <Arrow d="M9 5l7 7-7 7" />
          </button>
          <button className="icon-btn" onClick={() => step(last)} disabled={idx === last} aria-label={ja.game.lastMove}>
            <Arrow d="M18 5v14M6 5l8 7-8 7" />
          </button>
        </div>
      </div>
    </div>
  );
}
