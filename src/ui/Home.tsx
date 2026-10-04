import { useState } from 'react';
import { ja } from '../ja';
import { PUZZLES } from '../tsumego/problems';
import { loadRecord, type SavedGame } from '../save';
import { Sheet, TopActions, TopBar } from './common';

export function Home({
  onPlay,
  onTsumego,
  onRules,
  onSettings,
  onOpenSgf,
  onResume,
  onDiscard,
  saved,
  solved,
  updateAvailable = false,
  onUpdate,
}: {
  onPlay: () => void;
  onTsumego: () => void;
  onRules: () => void;
  onSettings: () => void;
  onOpenSgf: () => void;
  onResume: (g: SavedGame) => void;
  onDiscard: (id: string) => void;
  /** 中断した対局（新しい順）。 */
  saved: SavedGame[];
  solved: number;
  /** あたらしいバージョンが待機している */
  updateAvailable?: boolean;
  onUpdate?: () => void;
}) {
  const [rec] = useState(loadRecord);
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);
  const games = rec.win + rec.lose + rec.draw;
  const [latest, ...others] = saved;
  const describe = (g: SavedGame) =>
    ja.home.resumeSub(g.settings.size, g.settings.mode === 'ai' ? ja.setup.levelName[g.settings.level] : ja.setup.local, g.moves.length);
  return (
    <div className="screen home">
      <TopBar
        left={
          <button className="text-btn" onClick={onRules}>
            {ja.home.rules}
          </button>
        }
        right={<TopActions />}
      />
      <div className="home-hero">
        <div className="home-board" aria-hidden="true">
          <svg viewBox="0 0 8 8">
            {Array.from({ length: 9 }, (_, i) => (
              <g key={i}>
                <line x1={i} y1={0} x2={i} y2={8} />
                <line x1={0} y1={i} x2={8} y2={i} />
              </g>
            ))}
            <circle cx={2} cy={2} r={0.44} className="hb" />
            <circle cx={3} cy={2} r={0.44} className="hw" />
            <circle cx={3} cy={3} r={0.44} className="hb" />
            <circle cx={4} cy={3} r={0.44} className="hw" />
            <circle cx={5} cy={5} r={0.44} className="hb" />
            <circle cx={4} cy={5} r={0.44} className="hw" />
          </svg>
        </div>
        <h1 className="title">{ja.appName}</h1>
        <p className="tagline">{ja.tagline}</p>
        {games > 0 && <p className="record">{ja.home.record(rec.win, rec.lose, rec.draw)}</p>}
      </div>
      <div className="home-actions">
        {updateAvailable && (
          <div className="update-card" role="status">
            <span>{ja.home.updateAvailable}</span>
            <button className="act primary" onClick={onUpdate}>
              {ja.home.update}
            </button>
          </div>
        )}
        {latest && (
          <div className="resume-card">
            <button className="big-btn resume" onClick={() => onResume(latest)}>
              <span className="bb-title">{ja.home.resume}</span>
              <span className="bb-sub">{describe(latest)}</span>
            </button>
            <button className="text-btn discard" onClick={() => setConfirmDiscard(latest.id)}>
              {ja.home.discard}
            </button>
          </div>
        )}
        {others.length > 0 && (
          <div className="saves-more">
            <small>{ja.home.otherSaves}</small>
            {others.map((g) => (
              <div className="resume-row" key={g.id}>
                <button className="resume-open" onClick={() => onResume(g)}>
                  {describe(g)}
                </button>
                <button className="text-btn" onClick={() => setConfirmDiscard(g.id)}>
                  {ja.home.discard}
                </button>
              </div>
            ))}
          </div>
        )}
        <button className={`big-btn${latest ? '' : ' primary'}`} onClick={onPlay}>
          <span className="bb-title">{ja.home.play}</span>
          <span className="bb-sub">{ja.home.playSub}</span>
        </button>
        <button className="big-btn" onClick={onTsumego}>
          <span className="bb-title">{ja.home.tsumego}</span>
          <span className="bb-sub">{ja.home.tsumegoSub(solved, PUZZLES.length)}</span>
        </button>
        <div className="home-links">
          <button className="text-btn" onClick={onOpenSgf}>
            {ja.home.openSgf}
          </button>
          <button className="text-btn" onClick={onSettings}>
            {ja.home.settings}
          </button>
        </div>
      </div>

      {confirmDiscard && (
        <Sheet onClose={() => setConfirmDiscard(null)}>
          <h2>{ja.home.discardAsk}</h2>
          <p>{ja.home.discardBody}</p>
          <div className="sheet-actions">
            <button className="act" onClick={() => setConfirmDiscard(null)}>
              {ja.game.cancel}
            </button>
            <button
              className="act danger solid"
              onClick={() => {
                onDiscard(confirmDiscard);
                setConfirmDiscard(null);
              }}
            >
              {ja.home.discardYes}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
