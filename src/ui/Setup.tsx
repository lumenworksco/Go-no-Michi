import { useState } from 'react';
import { BLACK, WHITE, type Color } from '../engine/board';
import { maxHandicap } from '../engine/game';
import type { Level } from '../ai/mcts';
import { ja } from '../ja';
import { load, save } from '../store';
import { BackButton, TopBar } from './common';

export interface GameSettings {
  size: 9 | 13 | 19;
  mode: 'ai' | 'local';
  level: Level;
  /** 人間の色。random は開始時に決める */
  color: Color | 'random';
  handicap: number;
  komi: number;
}

export const DEFAULT_SETTINGS: GameSettings = { size: 9, mode: 'ai', level: 'shokyu', color: BLACK, handicap: 0, komi: 6.5 };

function Seg<T extends string | number>({
  value,
  options,
  onChange,
  cols,
}: {
  value: T;
  options: { value: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className="seg" style={cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}>
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} aria-pressed={o.value === value}>
          <span>{o.label}</span>
          {o.sub && <small>{o.sub}</small>}
        </button>
      ))}
    </div>
  );
}

export function Setup({ onStart, onBack }: { onStart: (s: GameSettings) => void; onBack: () => void }) {
  const [s, setS] = useState<GameSettings>(() => ({ ...DEFAULT_SETTINGS, ...load<Partial<GameSettings>>('gonomichi:settings', {}) }));
  const set = <K extends keyof GameSettings>(k: K, v: GameSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const t = ja.setup;
  const maxH = maxHandicap(s.size);
  const handicap = Math.min(s.handicap, s.handicap >= 2 ? maxH : 0);
  const komi = handicap >= 2 ? 0 : s.komi;

  return (
    <div className="screen setup">
      <TopBar left={<BackButton onClick={onBack} />} title={t.title} />
      <div className="scroll">
        <section>
          <h3>{t.board}</h3>
          <Seg
            value={s.size}
            cols={3}
            options={([9, 13, 19] as const).map((n) => ({ value: n, label: t.boardOpt[n], sub: t.boardSub[n] }))}
            onChange={(v) => set('size', v)}
          />
        </section>

        <section>
          <h3>{t.opponent}</h3>
          <Seg
            value={s.mode}
            cols={2}
            options={[
              { value: 'ai', label: t.ai },
              { value: 'local', label: t.local },
            ]}
            onChange={(v) => set('mode', v)}
          />
        </section>

        {s.mode === 'ai' && (
          <>
            <section>
              <h3>{t.level}</h3>
              <Seg
                value={s.level}
                cols={3}
                options={(['nyumon', 'shokyu', 'chukyu'] as const).map((l) => ({ value: l, label: t.levelName[l], sub: t.levelSub[l] }))}
                onChange={(v) => set('level', v)}
              />
            </section>
            <section>
              <h3>{t.color}</h3>
              <Seg
                value={String(s.color)}
                cols={3}
                options={[
                  { value: String(BLACK), label: t.black, sub: t.blackSub },
                  { value: String(WHITE), label: t.white, sub: t.whiteSub },
                  { value: 'random', label: t.random },
                ]}
                onChange={(v) => set('color', v === 'random' ? 'random' : (Number(v) as Color))}
              />
            </section>
          </>
        )}

        <section>
          <h3>{t.handicap}</h3>
          <div className="chips">
            {[0, ...Array.from({ length: maxH - 1 }, (_, i) => i + 2)].map((n) => (
              <button key={n} className={n === handicap ? 'chip on' : 'chip'} onClick={() => set('handicap', n)} aria-pressed={n === handicap}>
                {n === 0 ? t.even : t.stones(n)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>{t.komi}</h3>
          <div className="chips">
            {(handicap >= 2 ? [0] : [0, 5.5, 6.5, 7.5]).map((k) => (
              <button key={k} className={k === komi ? 'chip on' : 'chip'} onClick={() => set('komi', k)} aria-pressed={k === komi}>
                {t.komiValue(k)}
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="bottom-cta">
        <button
          className="big-btn primary slim"
          onClick={() => {
            const final = { ...s, handicap, komi };
            save('gonomichi:settings', final);
            onStart(final);
          }}
        >
          <span className="bb-title">{t.start}</span>
        </button>
      </div>
    </div>
  );
}
