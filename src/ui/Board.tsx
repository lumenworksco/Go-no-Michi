import { useMemo, useRef, useState, type ReactElement } from 'react';
import { BLACK, WHITE, EMPTY, type Color } from '../engine/board';
import type { Window } from '../tsumego/solver';
import { ja } from '../ja';

export interface FadingStone {
  idx: number;
  color: Color;
  key: number;
}

interface Props {
  size: number;
  board: Uint8Array;
  last?: number;
  ko?: number;
  /** ゴースト（置く前の薄い石）の色 */
  ghostColor?: Color;
  interactive?: boolean;
  /** 置ける点かどうか。false ならゴーストを出さない */
  canPlay?: (idx: number) => boolean;
  onPoint?: (idx: number) => void;
  fading?: FadingStone[];
  /** 死に石（終局の確認中） */
  dead?: ReadonlySet<number>;
  /** 地の持ち主（0=なし, 1=黒, 2=白） */
  owner?: Uint8Array;
  /** 一部だけ表示する（詰碁） */
  view?: Window;
  hint?: number;
  /** 呼吸点などを示す小さな点（遊び方の図用） */
  dots?: number[];
  /** 着手のたびに増える。最後の石だけ「置く」アニメーションを再生する */
  moveKey?: number;
  animateLast?: boolean;
}

const HOSHI: Record<number, number[]> = { 9: [2, 4, 6], 13: [3, 6, 9], 19: [3, 9, 15] };
const R = 0.475;

export function Board({
  size,
  board,
  last = -1,
  ko = -1,
  ghostColor = BLACK,
  interactive = false,
  canPlay,
  onPoint,
  fading = [],
  dead,
  owner,
  view,
  hint = -1,
  dots = [],
  moveKey = 0,
  animateLast = true,
}: Props) {
  const full = !view;
  const v = view ?? { x0: 0, y0: 0, x1: size - 1, y1: size - 1 };
  const padL = v.x0 === 0 ? (full ? 0.95 : 0.55) : 0.5;
  const padT = v.y0 === 0 ? (full ? 0.95 : 0.55) : 0.5;
  const padR = v.x1 === size - 1 ? (full ? 0.95 : 0.55) : 0.5;
  const padB = v.y1 === size - 1 ? (full ? 0.95 : 0.55) : 0.5;
  const vb = { x: v.x0 - padL, y: v.y0 - padT, w: v.x1 - v.x0 + padL + padR, h: v.y1 - v.y0 + padT + padB };

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState(-1);
  const pressed = useRef(false);

  const pointAt = (e: React.PointerEvent): number => {
    const el = svgRef.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    const px = vb.x + ((e.clientX - r.left) / r.width) * vb.w;
    const py = vb.y + ((e.clientY - r.top) / r.height) * vb.h;
    const x = Math.round(px);
    const y = Math.round(py);
    if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) return -1;
    return y * size + x;
  };

  const lines = useMemo(() => {
    const out: ReactElement[] = [];
    const yTop = v.y0 === 0 ? 0 : v.y0 - 1;
    const yBot = v.y1 === size - 1 ? size - 1 : v.y1 + 1;
    const xLeft = v.x0 === 0 ? 0 : v.x0 - 1;
    const xRight = v.x1 === size - 1 ? size - 1 : v.x1 + 1;
    for (let x = Math.max(0, v.x0 - 1); x <= Math.min(size - 1, v.x1 + 1); x++) {
      const edge = x === 0 || x === size - 1;
      out.push(<line key={`v${x}`} x1={x} y1={yTop} x2={x} y2={yBot} className={edge ? 'gl edge' : 'gl'} />);
    }
    for (let y = Math.max(0, v.y0 - 1); y <= Math.min(size - 1, v.y1 + 1); y++) {
      const edge = y === 0 || y === size - 1;
      out.push(<line key={`h${y}`} x1={xLeft} y1={y} x2={xRight} y2={y} className={edge ? 'gl edge' : 'gl'} />);
    }
    return out;
  }, [size, v.x0, v.x1, v.y0, v.y1]);

  const hoshi: ReactElement[] = [];
  for (const y of HOSHI[size] ?? []) {
    for (const x of HOSHI[size] ?? []) {
      if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
      hoshi.push(<circle key={`h${x}-${y}`} cx={x} cy={y} r={0.1} className="hoshi" />);
    }
  }

  const labels: ReactElement[] = [];
  if (full) {
    for (let i = 0; i < size; i++) {
      labels.push(
        <text key={`lx${i}`} x={i} y={-0.5} className="coord">
          {i + 1}
        </text>,
        <text key={`ly${i}`} x={-0.55} y={i} className="coord">
          {i + 1}
        </text>,
      );
    }
  }

  const stones: ReactElement[] = [];
  const marks: ReactElement[] = [];
  for (let i = 0; i < board.length; i++) {
    const c = board[i];
    const x = i % size;
    const y = (i / size) | 0;
    if (x < v.x0 - 1 || x > v.x1 + 1 || y < v.y0 - 1 || y > v.y1 + 1) continue;
    if (c === EMPTY) {
      const o = owner?.[i] ?? 0;
      if (o) marks.push(<rect key={`t${i}`} x={x - 0.17} y={y - 0.17} width={0.34} height={0.34} className={o === BLACK ? 'terr b' : 'terr w'} />);
      continue;
    }
    const isLast = i === last;
    const isDead = dead?.has(i) ?? false;
    const cls = ['stone', c === BLACK ? 'b' : 'w', isLast && animateLast ? 'pop' : '', isDead ? 'dead' : ''].filter(Boolean).join(' ');
    stones.push(
      <g key={isLast && animateLast ? `${i}-${moveKey}` : `${i}`} transform={`translate(${x} ${y})`}>
        <circle cx={0.05} cy={0.08} r={R} className="shadow" />
        <g className={cls}>
          <circle r={R} fill={c === BLACK ? 'url(#gB)' : 'url(#gW)'} className="body" />
          {c === WHITE && <circle r={R} fill="none" className="rim" />}
        </g>
        {isDead && <path d="M-0.2 -0.2L0.2 0.2M0.2 -0.2L-0.2 0.2" className={c === BLACK ? 'xmark w' : 'xmark b'} />}
        {isLast && !isDead && <circle r={0.2} className={c === BLACK ? 'lastring w' : 'lastring b'} />}
      </g>,
    );
    const o = owner?.[i] ?? 0;
    if (o) marks.push(<rect key={`t${i}`} x={x - 0.17} y={y - 0.17} width={0.34} height={0.34} className={o === BLACK ? 'terr b' : 'terr w'} />);
  }

  const showGhost = interactive && hover >= 0 && board[hover] === EMPTY && (canPlay ? canPlay(hover) : true);
  const gx = hover % size;
  const gy = (hover / size) | 0;

  return (
    <div className={`board-wrap${full ? '' : ' cropped'}`} style={{ aspectRatio: `${vb.w} / ${vb.h}`, ['--ar' as string]: vb.w / vb.h }}>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="img"
        aria-label={ja.aria.board}
        className={interactive ? 'board-svg interactive' : 'board-svg'}
        onPointerDown={(e) => {
          if (!interactive) return;
          pressed.current = true;
          (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
          setHover(pointAt(e));
        }}
        onPointerMove={(e) => {
          if (!interactive) return;
          setHover(pointAt(e));
        }}
        onPointerUp={(e) => {
          if (!interactive) return;
          const idx = pointAt(e);
          const wasPressed = pressed.current;
          pressed.current = false;
          if (e.pointerType !== 'mouse') setHover(-1);
          if (wasPressed && idx >= 0) onPoint?.(idx);
        }}
        onPointerCancel={() => {
          pressed.current = false;
          setHover(-1);
        }}
        onPointerLeave={() => {
          if (!pressed.current) setHover(-1);
        }}
      >
        <defs>
          <radialGradient id="gB" cx="0.34" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#5b5d63" />
            <stop offset="0.35" stopColor="#25262a" />
            <stop offset="1" stopColor="#050506" />
          </radialGradient>
          <radialGradient id="gW" cx="0.36" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#efece5" />
            <stop offset="1" stopColor="#b9b4a8" />
          </radialGradient>
        </defs>
        {labels}
        {lines}
        {hoshi}
        {koMark(ko, size, v)}
        {fading.map((f) => (
          <g key={f.key} transform={`translate(${f.idx % size} ${(f.idx / size) | 0})`} className="fade-out" pointerEvents="none">
            <circle r={R} fill={f.color === BLACK ? 'url(#gB)' : 'url(#gW)'} />
          </g>
        ))}
        {stones}
        {marks}
        {dots.map((d) => (
          <circle key={`d${d}`} cx={d % size} cy={(d / size) | 0} r={0.13} className="dot" />
        ))}
        {hint >= 0 && <circle cx={hint % size} cy={(hint / size) | 0} r={0.32} className="hint" />}
        {showGhost && (
          <g transform={`translate(${gx} ${gy})`} pointerEvents="none" className="ghost">
            <circle r={R} fill={ghostColor === BLACK ? 'url(#gB)' : 'url(#gW)'} />
          </g>
        )}
      </svg>
    </div>
  );
}

function koMark(ko: number, size: number, v: Window) {
  if (ko < 0) return null;
  const x = ko % size;
  const y = (ko / size) | 0;
  if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) return null;
  return <rect x={x - 0.2} y={y - 0.2} width={0.4} height={0.4} className="komark" />;
}
