import { useEffect, useState } from 'react';
import { load, save } from './store';
import { Home } from './ui/Home';
import { Rules } from './ui/Rules';
import { clearSavedGame, loadSavedGame } from './save';
import { Setup, type GameSettings } from './ui/Setup';
import { GameScreen } from './ui/GameScreen';
import { TsumegoList, TsumegoPlay } from './ui/Tsumego';
import { PUZZLES, type Puzzle } from './tsumego/problems';
import type { SavedGame } from './save';

type Route =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'rules' }
  | { name: 'game'; settings: GameSettings; run: number; resume?: SavedGame | null }
  | { name: 'tsumegoList' }
  | { name: 'tsumego'; puzzle: Puzzle };

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [saved, setSaved] = useState<SavedGame | null>(() => loadSavedGame());
  const [solved, setSolved] = useState<number[]>(() => load<number[]>('gonomichi:tsumego', []));

  // ホームに戻るたびに、保存されている対局を読み直す（戻るボタン経由でも古い情報を出さない）
  useEffect(() => {
    if (route.name === 'home') setSaved(loadSavedGame());
  }, [route.name]);

  // ブラウザ／端末の「戻る」で一つ前の画面に戻れるようにする
  useEffect(() => {
    const onPop = () => setRoute({ name: 'home' });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = (r: Route) => {
    try {
      history.pushState({}, '');
    } catch {
      /* 履歴が使えなくても画面遷移は行う */
    }
    setRoute(r);
  };

  const markSolved = (id: number) =>
    setSolved((s) => {
      if (s.includes(id)) return s;
      const n = [...s, id];
      save('gonomichi:tsumego', n);
      return n;
    });

  switch (route.name) {
    case 'home':
      return (
        <Home
          onPlay={() => go({ name: 'setup' })}
          onTsumego={() => go({ name: 'tsumegoList' })}
          onRules={() => go({ name: 'rules' })}
          onResume={() => saved && go({ name: 'game', settings: saved.settings, run: 0, resume: saved })}
          onDiscard={() => {
            clearSavedGame();
            setSaved(null);
          }}
          saved={saved}
          solved={solved.length}
        />
      );
    case 'rules':
      return <Rules onBack={() => setRoute({ name: 'home' })} />;
    case 'setup':
      return (
        <Setup
          onBack={() => setRoute({ name: 'home' })}
          onStart={(settings) => {
            clearSavedGame(); // 新しい対局を始めたら、中断していた対局は破棄
            setSaved(null);
            go({ name: 'game', settings, run: 0, resume: null });
          }}
        />
      );
    case 'game':
      return (
        <GameScreen
          key={route.run}
          settings={route.settings}
          resume={route.resume}
          onExit={() => {
            setSaved(loadSavedGame());
            setRoute({ name: 'home' });
          }}
          onRematch={() => setRoute({ ...route, run: route.run + 1, resume: null })}
        />
      );
    case 'tsumegoList':
      return <TsumegoList solved={solved} onPick={(puzzle) => go({ name: 'tsumego', puzzle })} onBack={() => setRoute({ name: 'home' })} />;
    case 'tsumego': {
      const i = PUZZLES.findIndex((p) => p.id === route.puzzle.id);
      const next = PUZZLES[i + 1];
      return (
        <TsumegoPlay
          key={route.puzzle.id}
          puzzle={route.puzzle}
          onSolved={markSolved}
          onBack={() => setRoute({ name: 'tsumegoList' })}
          onNext={() => next && setRoute({ name: 'tsumego', puzzle: next })}
          hasNext={!!next}
        />
      );
    }
  }
}
