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

  // 起動（読みこみなおし含む）のたびに、戻る履歴の起点をホームにそろえる。
  // このアプリは常にホームから始まるので、前回の深い画面が履歴に残っていても無視する。
  useEffect(() => {
    try {
      history.replaceState({ name: 'home' } as Route, '');
    } catch {
      /* 履歴が使えなくても画面遷移は行う */
    }
  }, []);

  // ホームに戻るたびに、保存されている対局を読み直す（戻るボタン経由でも古い情報を出さない）
  useEffect(() => {
    if (route.name === 'home') setSaved(loadSavedGame());
  }, [route.name]);

  // 端末／ブラウザの「戻る」を唯一の遷移元にする。履歴に積んだ内容をそのまま読み戻す。
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setRoute((e.state as Route | null) ?? { name: 'home' });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** 新しい画面へ進む。戻る履歴にも積むので、端末の「戻る」でここへ戻ってこられる。 */
  const go = (r: Route) => {
    try {
      history.pushState(r, '');
    } catch {
      /* ignore */
    }
    setRoute(r);
  };
  /** 今の画面を置きかえる（次の詰碁へ、もう一局、など）。戻る履歴は増やさない。 */
  const replace = (r: Route) => {
    try {
      history.replaceState(r, '');
    } catch {
      /* ignore */
    }
    setRoute(r);
  };
  /** 一つ前の画面に戻る。履歴を操作することで、端末の「戻る」ボタンと挙動がそろう。 */
  const back = () => {
    try {
      history.back();
    } catch {
      setRoute({ name: 'home' });
    }
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
      return <Rules onBack={back} />;
    case 'setup':
      return (
        <Setup
          hasSaved={!!saved}
          onBack={back}
          onStart={(settings) => {
            clearSavedGame(); // 新しい対局を始めたら、中断していた対局は破棄
            setSaved(null);
            // 対局設定の画面は使い捨てなので、戻る履歴には積まず置きかえる。
            // こうすると対局を終えたときの「戻る」は、設定画面を飛ばして直接ホームに戻る。
            replace({ name: 'game', settings, run: 0, resume: null });
          }}
        />
      );
    case 'game':
      return (
        <GameScreen
          key={route.run}
          settings={route.settings}
          resume={route.resume}
          onExit={back}
          onRematch={() => replace({ ...route, run: route.run + 1, resume: null })}
        />
      );
    case 'tsumegoList':
      return <TsumegoList solved={solved} onPick={(puzzle) => go({ name: 'tsumego', puzzle })} onBack={back} />;
    case 'tsumego': {
      const i = PUZZLES.findIndex((p) => p.id === route.puzzle.id);
      const next = PUZZLES[i + 1];
      return (
        <TsumegoPlay
          key={route.puzzle.id}
          puzzle={route.puzzle}
          onSolved={markSolved}
          onBack={back}
          onNext={() => next && replace({ name: 'tsumego', puzzle: next })}
          hasNext={!!next}
        />
      );
    }
  }
}
