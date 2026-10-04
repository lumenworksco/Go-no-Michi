import { useState } from 'react';
import { decodeSgf, parseSgf, type ParsedSgf, type SgfError } from '../engine/sgfParse';
import { ja } from '../ja';
import { BackButton, TopBar } from './common';

const MAX_BYTES = 1_000_000;

const errorText = (e: SgfError | 'big' | 'clip') =>
  ({ empty: ja.sgf.errEmpty, format: ja.sgf.errFormat, size: ja.sgf.errSize, big: ja.sgf.errBig, clip: ja.sgf.errClip })[e];

export function OpenSgf({ onBack, onOpen }: { onBack: () => void; onOpen: (g: ParsedSgf) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = (src: string) => {
    const r = parseSgf(src);
    if (r.ok) onOpen(r.game);
    else setError(errorText(r.error));
  };

  return (
    <div className="screen settings">
      <TopBar left={<BackButton onClick={onBack} />} title={ja.sgf.title} />
      <div className="scroll">
        <p className="about-lead">{ja.sgf.intro}</p>
        <section>
          <label className="act file-btn">
            {ja.sgf.choose}
            <input
              type="file"
              accept=".sgf,text/plain,application/x-go-sgf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = ''; // 同じファイルをもう一度えらべるように
                if (!file) return;
                if (file.size > MAX_BYTES) return setError(errorText('big'));
                try {
                  open(await decodeSgf(await file.arrayBuffer()));
                } catch {
                  setError(errorText('format'));
                }
              }}
            />
          </label>
        </section>
        <section>
          <h3>{ja.sgf.or}</h3>
          <textarea
            className="sgf-text"
            rows={6}
            value={text}
            placeholder={ja.sgf.placeholder}
            spellCheck={false}
            aria-label={ja.sgf.or}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
          <div className="stack">
            {typeof navigator !== 'undefined' && !!navigator.clipboard?.readText && (
              <button
                className="act"
                onClick={async () => {
                  try {
                    const t = await navigator.clipboard.readText();
                    setText(t);
                    open(t);
                  } catch {
                    setError(errorText('clip'));
                  }
                }}
              >
                {ja.sgf.pasteClip}
              </button>
            )}
            <button className="act primary" onClick={() => open(text)}>
              {ja.sgf.open}
            </button>
          </div>
        </section>
        {error && (
          <p className="sgf-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
