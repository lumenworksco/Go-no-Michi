import { Component, type ReactNode } from 'react';
import { ja } from '../ja';
import { clearAllData } from '../store';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * 画面の描画中にエラーが起きても、まっくらな画面のままにしない。
 * 読みこみなおしボタンと、こわれた保存データが原因のときのための
 * 「保存したデータを全部消して読みこみなおす」ボタンを出す（対局・設定・成績・詰碁の進み具合）。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
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
                clearAllData();
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
