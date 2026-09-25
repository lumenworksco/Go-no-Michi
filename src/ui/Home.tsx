import { ja } from '../ja';
import { PUZZLES } from '../tsumego/problems';
import { loadRecord, type SavedGame } from '../save';
import { TopActions, TopBar } from './common';

export function Home({
  onPlay,
  onTsumego,
  onRules,
  onResume,
  onDiscard,
  saved,
  solved,
}: {
  onPlay: () => void;
  onTsumego: () => void;
  onRules: () => void;
  onResume: () => void;
  onDiscard: () => void;
  saved: SavedGame | null;
  solved: number;
}) {
  const rec = loadRecord();
  const games = rec.win + rec.lose + rec.draw;
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
        {saved && (
          <div className="resume-card">
            <button className="big-btn resume" onClick={onResume}>
              <span className="bb-title">{ja.home.resume}</span>
              <span className="bb-sub">
                {ja.home.resumeSub(saved.settings.size, saved.settings.mode === 'ai' ? ja.setup.levelName[saved.settings.level] : ja.setup.local, saved.moves.length)}
              </span>
            </button>
            <button className="text-btn discard" onClick={onDiscard}>
              {ja.home.discard}
            </button>
          </div>
        )}
        <button className={`big-btn${saved ? '' : ' primary'}`} onClick={onPlay}>
          <span className="bb-title">{ja.home.play}</span>
          <span className="bb-sub">{ja.home.playSub}</span>
        </button>
        <button className="big-btn" onClick={onTsumego}>
          <span className="bb-title">{ja.home.tsumego}</span>
          <span className="bb-sub">{ja.home.tsumegoSub(solved, PUZZLES.length)}</span>
        </button>
      </div>
    </div>
  );
}
