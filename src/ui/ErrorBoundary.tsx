import { Component, type ReactNode } from 'react';
import { ja } from '../ja';
import { clearSavedGame } from '../save';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * 画面の描画中にエラーが起きても、まっくらな画面のままにしない。
 * 読みこみなおしボタンと、こわれた保存データが原因のときのための
 * 「対局の保存を消して読みこみなおす」ボタンを出す。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = ja.errorScreen;
    return (
      <div className="screen error-screen">
        <div className="error-box">
          <h1>{t.title}</h1>
          <p>{t.body}</p>
          <div className="error-actions">
            <button className="act" onClick={() => location.reload()}>
              {t.reload}
            </button>
            <button
              className="act danger"
              onClick={() => {
                clearSavedGame();
                location.reload();
              }}
            >
              {t.clearAndReload}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
