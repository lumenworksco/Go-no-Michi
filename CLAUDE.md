# 碁の道 — Go (囲碁) PWA, fully in Japanese

Vite + React + TypeScript. Dark, minimal UI modelled on the Offsuite poker app.

```bash
npm run dev      # dev server
npm test         # engine, AI, and every tsumego puzzle (proved by exhaustive search)
npm run build    # typecheck + PWA build
npm run arena    # AI-vs-AI strength check (tsx scripts/arena.ts, slow)
npx tsx scripts/bench.ts      # AI response time per board size
node scripts/make-icons.mjs   # regenerate PWA icons
```

- `src/engine/` — pure rules: captures, suicide, simple ko, handicap, Japanese scoring (territory + prisoners, dead-stone marking).
- `src/ai/` — MCTS in a Web Worker (`mcts.ts`, `worker.ts`, `client.ts`). Levels are 入門/初級/中級 by playout budget; no 段 claims.
- `src/tsumego/` — `solver.ts` proves puzzles; `problems.ts` holds them. Add a puzzle → `problems.test.ts` checks it is capturable in exactly N moves.
- `src/ja.ts` — all UI strings. The whole UI is **hiragana + katakana only (no kanji)**, with spaces between words, for beginners. `src/ja.test.ts` fails if a kanji appears in the strings or UI code. Board axes use digits; moves read like `3の4`. The app is called ごのみち.
- `src/save.ts` — autosave of the game in progress (resumed from Home) and win/loss record, in localStorage.
- Game screen extras: review/step through a finished game, SGF export (`src/engine/sgf.ts`), AI hint, アタリ toast, keyboard shortcuts (P pass, U undo, H hint, ←/→/Home/End in review, Esc).
