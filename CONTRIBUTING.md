# Contributing

Thanks for taking a look. A few project rules:

- **The UI is hiragana + katakana only (no kanji).** All user-visible text goes through `src/ja.ts`;
  `npm test` fails if a kanji appears in the UI strings or UI code.
- Online/networked play is out of scope. Rules are Japanese-style (territory + prisoners), simple ko.
- Add a tsumego puzzle in `src/tsumego/problems.ts` — `problems.test.ts` proves it is solvable in
  exactly the stated number of moves. `npx tsx scripts/gen-puzzles.ts` searches for candidates that the solver
  has already proven (unique first move).

## Setup

```bash
nvm use            # Node version from .nvmrc
npm ci
npx playwright install chromium webkit   # once, for the e2e tests
```

## Before opening a pull request

```bash
npm run typecheck
npm test           # unit tests (engine, AI, puzzles, storage)
npm run e2e        # builds, then runs the browser tests (Chromium + WebKit, phone + desktop)
```

CI runs the same checks. See `CLAUDE.md` for an architecture map.
