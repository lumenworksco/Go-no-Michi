# ごのみち (Go no Michi)

A small, polished Go (囲碁) web app and installable PWA — play against a built-in AI or
pass-and-play with a friend, solve capturing puzzles, and learn the rules. The entire UI is
written in **hiragana and katakana only** (no kanji), so it also works as reading practice for
early Japanese learners. Dark, minimal design inspired by the Offsuit poker app.

**Live:** [go.braunf.com](https://go.braunf.com/)

![screenshot](docs/screenshot.png)

## Features

- **Play** on a 9×9, 13×13 or 19×19 board, against the built-in AI (入門/初級/中級 — three
  real strength levels, see below) or locally with a friend on one device.
- **Japanese rules scoring**: territory + prisoners, with a dead-stone marking phase after two
  passes (auto-suggested, and you can correct it) and configurable komi / handicap stones.
- **詰碁 (tsumego)**: 16 short capturing puzzles. Every puzzle is proven solvable in exactly the
  stated number of moves by an exhaustive game-tree solver (`src/tsumego/solver.ts`), not just
  authored by hand — see `src/tsumego/problems.test.ts`.
- **あそびかた**: an illustrated rules page (liberties, capture, ko) for complete beginners.
- Move review/stepper after a finished game, **SGF export** (copy or download), an AI hint, an
  atari callout, and keyboard shortcuts on desktop (P pass, U undo, H hint, arrows to step
  through a finished game's review, Esc to close dialogs).
- Autosaves the game in progress (resume from the home screen) and keeps a simple win/loss
  record — both in `localStorage` only, nothing leaves your device.
- **Installable PWA**, works fully offline once visited, responsive from phone to desktop.

## Stack

Vite + React + TypeScript, no UI framework. The Go rules engine, scoring, the tsumego solver and
the AI are all plain, dependency-free TypeScript under `src/engine/`, `src/tsumego/` and
`src/ai/`. The AI is a small Monte Carlo tree search that runs in a Web Worker so the UI never
blocks; see `src/ai/mcts.ts`.

## Commands

```bash
npm install
npm run dev              # dev server

npm test                 # vitest: engine, AI, and every tsumego puzzle (proved, not asserted)
npm run build             # typecheck + production PWA build
npm run e2e               # playwright: builds, then drives the built app in
                           #   mobile/desktop × Chromium/WebKit
npm run arena             # AI-vs-AI strength check (slow)
npx tsx scripts/bench.ts  # AI response time per board size

node scripts/make-icons.mjs     # regenerate PWA icons
node scripts/make-og-image.mjs  # regenerate the social share image
```

## AI strength

The three levels (入門/初級/中級) are the same search given a larger time/playout budget, not
marketing names — `npm run arena` plays them against each other and reports the result. On 9×9
and 13×13, 中級 beats 入門 every time in that check. It is a lightweight search, not a strong
engine like KataGo; expect it to play more weakly, and more slowly, on 19×19.

## Known limitations

- Simple (positional) ko only, no superko cycle detection.
- Online/networked play is intentionally out of scope.
- No automated test currently covers the installed (Add to Home Screen) experience on a real
  iOS or Android device — `npm run e2e` verifies offline-reload and PWA basics in a headless
  browser only.

## License

Not yet decided — no license file is included, so all rights are reserved by default.
