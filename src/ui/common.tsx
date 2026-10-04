import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BLACK, type Color } from '../engine/board';
import { ja } from '../ja';
import { isSoundOn, setSound } from '../audio';

export function StoneIcon({ color, size = 20 }: { color: Color; size?: number }) {
  return <span className={`stone-icon ${color === BLACK ? 'b' : 'w'}`} style={{ width: size, height: size }} aria-hidden="true" />;
}

export function SoundToggle() {
  const [on, setOn] = useState(isSoundOn());
  return (
    <button
      className="icon-btn"
      aria-label={on ? ja.aria.soundOn : ja.aria.soundOff}
      onClick={() => {
        setSound(!on);
        setOn(!on);
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
        {on ? <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
      </svg>
    </button>
  );
}

/** ブラウザの全画面表示。非対応の端末（iPhone など）や、インストール済みアプリでは出さない。 */
export function FullscreenToggle() {
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled && !window.matchMedia('(display-mode: standalone)').matches;
  const [on, setOn] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const h = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  if (!supported) return null;
  return (
    <button
      className="icon-btn fs-btn"
      aria-label={on ? ja.aria.fullscreenOff : ja.aria.fullscreenOn}
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {on ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      </svg>
    </button>
  );
}

export function TopActions() {
  return (
    <>
      <FullscreenToggle />
      <SoundToggle />
    </>
  );
}

export function BackButton({ onClick, label = ja.aria.back }: { onClick: () => void; label?: string }) {
  return (
    <button className="icon-btn back" onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

export function TopBar({ left, title, right }: { left?: ReactNode; title?: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="tb-side">{left}</div>
      <div className="tb-title">{title}</div>
      <div className="tb-side right">{right}</div>
    </header>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = (text: string, ms = 1800) => {
    window.clearTimeout(timer.current);
    setMsg({ text, key: Date.now() });
    timer.current = window.setTimeout(() => setMsg(null), ms);
  };
  const node = msg ? (
    <div className="toast" key={msg.key} role="status">
      {msg.text}
    </div>
  ) : null;
  return { show, node };
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 下から出る（デスクトップでは中央の）ダイアログ。
 * - Esc で閉じる
 * - 開いたらダイアログ自体にフォーカスを移し、Tab はダイアログの中だけを回る
 * - 閉じたら、開く前にフォーカスしていたものに戻す
 * - 見出し（h2）を、ダイアログの名前として読み上げ用に結びつける
 */
export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    const before = document.activeElement as HTMLElement | null;
    const heading = el?.querySelector('h2');
    if (heading) heading.id = titleId;
    el?.focus({ preventScroll: true });

    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      // ブラウザまかせにせず、いつも自分で次の場所を決める（ブラウザによって、ダイアログ自体から
      // Tab を押したときの行き先がちがうため）
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === -1 || at === items.length - 1 ? 0 : at + 1;
      e.preventDefault();
      items[next].focus();
    };
    window.addEventListener('keydown', f);
    return () => {
      window.removeEventListener('keydown', f);
      // 開く前の場所に戻す（その要素がもう無いときは何もしない）
      if (before && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [titleId]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" ref={dialog} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {children}
      </div>
    </div>
  );
}

export function Dots() {
  return (
    <span className="dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** 選択肢のならび（どれか一つを選ぶ）。 */
export function Seg<T extends string | number>({
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

/** 棋譜を進める・戻すボタンの矢印。 */
export const Arrow = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
