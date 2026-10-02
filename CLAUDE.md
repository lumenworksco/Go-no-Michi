# 碁の道 — Go (囲碁) PWA, fully in Japanese

Vite + React + TypeScript. Dark, minimal UI modelled on the Offsuite poker app. The whole UI is
written in hiragana + katakana only (no kanji) — see `src/ja.ts` below. `README.md` has the
user-facing feature list and a screenshot; this file is operational/architecture notes for
picking the project back up.

**Live:** https://go.braunf.com/ — custom domain (GitHub Pages, `CNAME` file), deployed by
`.github/workflows/deploy.yml` on every push to `main`. No `BASE_PATH` build var is needed
(`base: '/'` in `vite.config.ts`) because it's served from the domain root, not a
`github.io/<repo>/` subpath.

## Status (as of the last session)

Feature-complete for a v1 and hardened: rules engine, AI, 16 tsumego puzzles (all proven
solvable by exhaustive search, not just authored), full Japanese-beginner UI, responsive
phone↔desktop layout, installable offline PWA, SGF export, game review, error boundary, and an
e2e suite covering phone/desktop × Chromium/WebKit. 81 unit tests + ~22 e2e tests, all green, and
re-verified against the live production URL after each deploy.

**Open items / known gaps** (not blocking, just not done):
- No testing on a real iOS/Android device — only headless Chromium/WebKit via Playwright.
- The offline-reload e2e test is skipped on WebKit: Playwright's WebKit driver throws an
  internal error on `offline + reload` regardless of the app (confirmed — identical flow passes
  on Chromium). iOS Safari offline behaviour itself is unverified.
- AI strength (`npm run arena`) has only been spot-checked: 中級 beats 入門 convincingly on 9×9
  and 13×13. 中級 vs 初級, and play quality (not just speed) on 19×19, haven't been checked.
- Single save slot: starting a new game from Setup asks for confirmation before discarding a
  paused one, but there's no way to keep more than one paused game.
- Simple (positional) ko only, no superko cycle detection. Online/networked play is intentionally
  out of scope.
- License is MIT (`LICENSE`), chosen as a reasonable default for a project like this — change it
  if you want something else.

## Commands

```bash
npm run dev      # dev server
npm test         # engine, AI, and every tsumego puzzle (proved by exhaustive search)
npm run build    # typecheck + PWA build
npm run e2e      # playwright: builds, then drives mobile/desktop × Chromium/WebKit (e2e/*.spec.ts)
npm run arena    # AI-vs-AI strength check (scripts/arena.ts, slow). Override with env vars,
                 # e.g. SZ=13 A=chukyu B=shokyu N=4 npm run arena
npx tsx scripts/bench.ts         # AI response time per board size
node scripts/make-icons.mjs      # regenerate PWA icons
node scripts/make-og-image.mjs   # regenerate the OG/social share image (needs @playwright/test)
```

To check a change against the live site instead of a local build:
`BASE_URL=https://go.braunf.com/ npm run e2e:live`.

## Architecture map

- `src/engine/` — pure rules: captures, suicide, simple ko, handicap, Japanese scoring (territory + prisoners, dead-stone marking), SGF export (`sgf.ts`).
- `src/ai/` — MCTS in a Web Worker (`mcts.ts`, `worker.ts`, `client.ts`). Levels are 入門/初級/中級 by playout budget; no 段 claims. `client.ts` falls back to computing on the main thread if the worker fails to start or crashes, so the UI never hangs on "かんがえちゅう" forever.
- `src/tsumego/` — `solver.ts` proves puzzles; `problems.ts` holds them (each has a fixed `id` so solved-progress in localStorage stays valid if the list is reordered — `puzzleNumber()` computes the displayed "第N問" from list order). Add a puzzle → `problems.test.ts` checks it is capturable in exactly N moves.
- `src/ja.ts` — all UI strings. The whole UI is **hiragana + katakana only (no kanji)**, with spaces between words, for beginners. `src/ja.test.ts` fails if a kanji appears in the strings or UI code (scans `src/ui/*`, `src/App.tsx`, `src/notation.ts`, `src/audio.ts`, `src/rulesDiagrams.ts`, `index.html`, `vite.config.ts` — add a new file there if it can contain user-visible text). Board axes use digits; moves read like `3の4`. The app is called ごのみち.
- `src/save.ts` — autosave of the game in progress (resumed from Home) and win/loss record, in localStorage.
- `src/App.tsx` — routing is a `Route` union pushed/replaced onto real browser history (`history.pushState`/`replaceState`/`back()`), so the hardware/browser back button works correctly: `go()` (push) for moving one level deeper, `replace()` for a same-depth swap (setup→game, rematch, next tsumego puzzle) so leaving a game always returns to Home in a single "back", not through a stale Setup entry. See `e2e/history.spec.ts` for the regression tests this protects against.
- `src/ui/ErrorBoundary.tsx` — catches render errors app-wide (wraps `<App/>` in `main.tsx`) so a bug shows a kana error screen with reload / "clear saved game and reload" instead of a blank page.
- Game screen extras: review/step through a finished game, SGF export, AI hint (separate worker channel so it never delays the opponent's move), アタリ toast, keyboard shortcuts (P pass, U undo, H hint, ←/→/Home/End in review, Esc).
- `e2e/` — Playwright end-to-end tests (`npm run e2e`), run against `mobile-chromium`/`mobile-webkit`/`desktop-chromium`/`desktop-webkit` projects (`playwright.config.ts`). Covers the main walkthroughs, the back-button history regression, and the offline-reload check above.
- Icons are generated from scratch (no image assets checked in as source) by `scripts/make-icons.mjs` (app icons, pure PNG encoder, no deps) and `scripts/make-og-image.mjs` (OG/social card, renders HTML via headless Chromium).
- `AGENTS.md` is just a one-line pointer back to this file, for AI tools that look for `AGENTS.md` specifically instead of `CLAUDE.md`. Keep real guidance here, not there.

## Deployment / repo operations
  
  - GitHub repo: `lumenworksco/Go-no-Michi`. It is deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push
    to `main` (Pages `build_type: workflow`, i.e. from the Actions artifact, not a branch).
  - Machine- and account-specific notes (which `gh` account is logged in, how to push from this machine) live in the
    untracked `CLAUDE.local.md`.
  - Commit attribution: this repo's commits are authored solely by the user (no `Co-Authored-By` trailer), per an
    explicit standing instruction - keep doing that for commits here regardless of the default attribution convention
    elsewhere.
  