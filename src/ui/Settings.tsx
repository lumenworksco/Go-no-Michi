import { useState } from 'react';
import { ja } from '../ja';
import { isSoundOn, isVibrateOn, setSound, setVibrate } from '../audio';
import { resetRecord, resetSolved } from '../save';
import { clearAllData } from '../store';
import { BackButton, Seg, Sheet, TopBar } from './common';

const REPO_URL = 'https://github.com/lumenworksco/Go-no-Michi';

type Ask = null | 'record' | 'solved' | 'all';

export function Settings({ onBack, onResetSolved }: { onBack: () => void; onResetSolved: () => void }) {
  const t = ja.settings;
  const [sound, setSoundState] = useState(isSoundOn());
  const [vib, setVibState] = useState(isVibrateOn());
  const [ask, setAsk] = useState<Ask>(null);
  const onOff = [
    { value: 'on', label: t.on },
    { value: 'off', label: t.off },
  ];

  const doReset = () => {
    if (ask === 'record') resetRecord();
    else if (ask === 'solved') {
      resetSolved();
      onResetSolved();
    } else if (ask === 'all') {
      clearAllData();
      location.reload(); // 音などの設定も、読みこみなおして初期にもどす
      return;
    }
    setAsk(null);
  };

  return (
    <div className="screen settings">
      <TopBar left={<BackButton onClick={onBack} />} title={t.title} />
      <div className="scroll">
        <section>
          <h3>{t.sound}</h3>
          <Seg
            value={sound ? 'on' : 'off'}
            cols={2}
            options={onOff}
            onChange={(v) => {
              setSound(v === 'on');
              setSoundState(v === 'on');
            }}
          />
        </section>
        <section>
          <h3>{t.vibrate}</h3>
          <Seg
            value={vib ? 'on' : 'off'}
            cols={2}
            options={onOff}
            onChange={(v) => {
              setVibrate(v === 'on');
              setVibState(v === 'on');
            }}
          />
        </section>

        <section>
          <h3>{t.data}</h3>
          <div className="stack">
            <button className="act" onClick={() => setAsk('record')}>
              {t.resetRecord}
            </button>
            <button className="act" onClick={() => setAsk('solved')}>
              {t.resetSolved}
            </button>
            <button className="act danger" onClick={() => setAsk('all')}>
              {t.resetAll}
            </button>
          </div>
        </section>

        <section className="about">
          <h3>{t.about}</h3>
          <p>{t.aboutText}</p>
          <p>{t.privacy}</p>
          <p className="meta">
            {t.version(__APP_VERSION__)}　・　{t.license}
          </p>
          <p className="meta">
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              {t.source}
            </a>
          </p>
          <p className="meta">{t.fonts}</p>
        </section>
      </div>

      {ask && (
        <Sheet onClose={() => setAsk(null)}>
          <h2>{t.confirmAsk}</h2>
          <p>{t.confirmBody}</p>
          <div className="sheet-actions">
            <button className="act" onClick={() => setAsk(null)}>
              {ja.game.cancel}
            </button>
            <button className="act danger solid" onClick={doReset}>
              {t.confirmYes}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
