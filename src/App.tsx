import { lazy, startTransition, Suspense, useEffect, useState } from 'react';
import { Home } from './ui/Home';
import { Rules } from './ui/Rules';
import { Settings } from './ui/Settings';
import { OpenSgf } from './ui/OpenSgf';
import { Review } from './ui/Review';
import { deleteSavedGame, loadSavedGames, loadSolved, MAX_SAVES, storeSolved, type SavedGame } from './save';
import { Setup } from './ui/Setup';
import { GameScreen } from './ui/GameScreen';
import { PUZZLES } from './tsumego/problems';
import { applyUpdate, useUpdateAvailable } from './pwa';
import { HOME, routeFromHistory, type Route } from './route';

// 詰碁の画面と探索器は、開いたときに読みこむ（最初の読みこみを軽くする）。オフラインでも使えるよう、
// これらのファイルもサービスワーカーが先にキャッシュしている。
const TsumegoList = lazy(() => import('./ui/Tsumego').then((m) => ({ default: m.TsumegoList })));
const TsumegoPlay = lazy(() => import('./ui/Tsumego').then((m) => ({ default: m.TsumegoPlay })));

export function App() {
  const [route, setRoute] = useState<Route>(HOME);
  const [saved, setSaved] = useState<SavedGame[]>(loadSavedGames);
  const [solved, setSolved] = useState<number[]>(loadSolved);
  const updateAvailable = useUpdateAvailable();

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
    if (route.name === 'home') setSaved(loadSavedGames());
  }, [route.name]);

  // 端末／ブラウザの「戻る」を唯一の遷移元にする。履歴に積んだ内容をそのまま読み戻す。
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const r = routeFromHistory(e.state);
      // 復元できない状態（対局など）に着いたときは、その履歴の項目もホームに直しておく
      if (r.name === 'home' && (e.state as Route | null)?.name !== 'home') {
        try {
          history.replaceState(HOME, '');
        } catch {
          /* ignore */
        }
      }
      setRoute(r);
    };
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
    // transition にしておくと、読みこみが必要な画面（詰碁）へ進むとき、読みこみが終わるまで今の画面が
    // 出たままになる（空白の画面がちらつかない）
    startTransition(() => setRoute(r));
  };
  /** 今の画面を置きかえる（次の詰碁へ、もう一局、など）。戻る履歴は増やさない。 */
  const replace = (r: Route) => {
    try {
      history.replaceState(r, '');
    } catch {
      /* ignore */
    }
    startTransition(() => setRoute(r));
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
      storeSolved(n);
      return n;
    });

  const screen = (() => {
    switch (route.name) {
      case 'home':
        return (
          <Home
            onPlay={() => go({ name: 'setup' })}
            onTsumego={() => go({ name: 'tsumegoList' })}
            onRules={() => go({ name: 'rules' })}
            onSettings={() => go({ name: 'settings' })}
            onOpenSgf={() => go({ name: 'openSgf' })}
            onResume={(g) => go({ name: 'game', settings: g.settings, run: 0, resume: g })}
            onDiscard={(id) => {
              deleteSavedGame(id);
              setSaved(loadSavedGames());
            }}
            saved={saved}
            solved={solved.length}
            updateAvailable={updateAvailable}
            onUpdate={applyUpdate}
          />
        );
      case 'rules':
        return <Rules onBack={back} />;
      case 'openSgf':
        // ファイルをえらぶ画面は使い捨てなので、棋譜の画面へは置きかえて進む（戻るで、ここを飛ばしてホームへ）
        return <OpenSgf onBack={back} onOpen={(game) => replace({ name: 'review', game })} />;
      case 'review':
        return <Review game={route.game} onBack={back} />;
      case 'settings':
        return <Settings onBack={back} onResetSolved={() => setSolved([])} />;
      case 'setup':
        return (
          <Setup
            savesFull={saved.length >= MAX_SAVES}
            onBack={back}
            onStart={(settings) => {
              // 中断していた対局は、そのまま残す（いっぱいのときは、保存するときにいちばん古いものが消える）
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
            allSolved={PUZZLES.every((p) => solved.includes(p.id))}
          />
        );
      }

    }
  })();

  return <Suspense fallback={null}>{screen}</Suspense>;
}
