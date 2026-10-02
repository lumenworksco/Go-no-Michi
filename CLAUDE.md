# 碁の道 — Go (囲碁) PWA, fully in Japanese

Vite + React + TypeScript. Dark, minimal UI modelled on the Offsuite poker app. See `README.md`
for the user-facing feature list. Live at https://go.braunf.com/ (custom domain, GitHub Pages via
Actions — `.github/workflows/deploy.yml`, no BASE_PATH needed since it's served from `/`).

```bash
npm run dev      # dev server
npm test         # engine, AI, and every tsumego puzzle (proved by exhaustive search)
npm run build    # typecheck + PWA build
npm run e2e      # playwright: builds, then drives mobile/desktop × Chromium/WebKit (e2e/*.spec.ts)
npm run arena    # AI-vs-AI strength check (tsx scripts/arena.ts, slow)
npx tsx scripts/bench.ts         # AI response time per board size
node scripts/make-icons.mjs      # regenerate PWA icons
node scripts/make-og-image.mjs   # regenerate the OG/social share image (needs @playwright/test)
```

- `src/engine/` — pure rules: captures, suicide, simple ko, handicap, Japanese scoring (territory + prisoners, dead-stone marking), SGF export (`sgf.ts`).
- `src/ai/` — MCTS in a Web Worker (`mcts.ts`, `worker.ts`, `client.ts`). Levels are 入門/初級/中級 by playout budget; no 段 claims. `client.ts` falls back to computing on the main thread if the worker fails to start or crashes, so the UI never hangs on "かんがえちゅう" forever.
- `src/tsumego/` — `solver.ts` proves puzzles; `problems.ts` holds them (each has a fixed `id` so solved-progress in localStorage stays valid if the list is reordered — `puzzleNumber()` computes the displayed "第N問" from list order). Add a puzzle → `problems.test.ts` checks it is capturable in exactly N moves.
- `src/ja.ts` — all UI strings. The whole UI is **hiragana + katakana only (no kanji)**, with spaces between words, for beginners. `src/ja.test.ts` fails if a kanji appears in the strings or UI code (scans `src/ui/*`, `src/App.tsx`, `src/notation.ts`, `src/audio.ts`, `src/rulesDiagrams.ts`, `index.html`, `vite.config.ts` — add a new file there if it can contain user-visible text). Board axes use digits; moves read like `3の4`. The app is called ごのみち.
- `src/save.ts` — autosave of the game in progress (resumed from Home) and win/loss record, in localStorage.
- `src/App.tsx` — routing is a `Route` union pushed/replaced onto real browser history (`history.pushState`/`replaceState`/`back()`), so the hardware/browser back button works correctly: `go()` (push) for moving one level deeper, `replace()` for a same-depth swap (setup→game, rematch, next tsumego puzzle) so leaving a game always returns to Home in a single "back", not through a stale Setup entry. See `e2e/history.spec.ts` for the regression tests this protects against.
- `src/ui/ErrorBoundary.tsx` — catches render errors app-wide (wraps `<App/>` in `main.tsx`) so a bug shows a kana error screen with reload / "clear saved game and reload" instead of a blank page.
- Game screen extras: review/step through a finished game, SGF export, AI hint (separate worker channel so it never delays the opponent's move), アタリ toast, keyboard shortcuts (P pass, U undo, H hint, ←/→/Home/End in review, Esc).
- `e2e/` — Playwright end-to-end tests (`npm run e2e`), run against `mobile-chromium`/`mobile-webkit`/`desktop-chromium`/`desktop-webkit` projects (`playwright.config.ts`). Covers the main walkthroughs, the back-button history regression above, and an offline-reload check of the service worker (skipped on WebKit — see comment in `e2e/offline.spec.ts`, it's a Playwright-WebKit driver limitation, not an app bug). Point it at a live URL instead of a local build with `BASE_URL=https://go.braunf.com/ npm run e2e:live`.
- Icons are generated from scratch (no image assets checked in as source) by `scripts/make-icons.mjs` (app icons, pure PNG encoder, no deps) and `scripts/make-og-image.mjs` (OG/social card, renders HTML via headless Chromium).
