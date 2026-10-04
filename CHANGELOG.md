# Changelog

## Unreleased

### Open an SGF, more saved games, a resigning computer
- 「きふを ひらく」: open an SGF file or pasted text and step through it (`CA[...]` legacy encodings supported;
  9/13/19 only).
- The SGF review screen follows variations (pick a branch where the game splits; ↑/↓ cycles) and shows comments.
- Up to 5 paused games are kept; the old single save is migrated automatically.
- The computer (初級/中級) resigns when it is clearly lost: win rate below 4% on three of its turns in a row, after
  half the board is played.
- 13×13 AI strength measured (README); `scripts/resign-check.ts` added.
- E2E: SGF round trip, multiple saves, and a WebKit-capable check that the service worker precaches everything
  the game needs.

### Accessibility
- The board can be played with the keyboard (Tab, arrow keys, Enter/Space) and is announced to screen readers
  (cursor position, stone state, the computer thinking, the result).
- Dialogs trap focus, restore it on close, are labelled, and close with Esc.
- Visible keyboard focus; larger tap targets; slightly larger small text; text in results and rules can be selected.
- `prefers-reduced-motion` now also stops looping animations and transitions, and disables vibration.

### Features
- New せってい (settings) screen: sound, vibration, clear record / puzzle progress / all data, about and licences.
- 14 new tsumego puzzles (30 total), all proven by the solver; a completion message when all are solved.
- Rules page: placing stones, dead stones and seki, handicap.
- Positional superko in the game engine; the AI is told which points are banned.
- Games that used undo or hints are not added to the win/loss record.
- SGF export includes the date and escapes names; the downloaded file name is ASCII.

### Web / PWA
- Content-Security-Policy, referrer policy, `og:image:alt`, JSON-LD and keywords (kanji allowed in invisible metadata only),
  `robots.txt`, `sitemap.xml`, a kana 404 page, manifest `id` / `categories` / screenshots.
- Kana-only Noto Sans/Serif JP subsets bundled as a fallback for devices without Japanese fonts.
- CSS fallbacks for browsers without `dvh` / container queries.
- Navigation to lazily loaded screens no longer flashes blank.

### Cleanup
- Removed unused UI strings.

### Earlier in this release

- Fixed: pressing the browser's Forward button could reopen an old game and overwrite a newer save.
- Fixed: corrupt saved data (settings, progress, record, game) no longer crashes the app; the error
  screen now clears all saved data.
- Fixed: undoing back to move 0 left a stale game under "つづきから".
- Fixed: "すてる" (discard saved game) now asks for confirmation.
- Fixed: the AI can no longer leave the screen stuck on "かんがえちゅう" if its fallback fails.
- Changed: app updates are no longer applied silently; a "こうしん" prompt appears on the home screen.
- Changed: on 13×13 and 19×19, touch input is tap-to-preview, tap-again-to-place.
- Changed: keyboard `P` must be pressed twice to pass.
- Added: Esc closes every dialog; larger board coordinate labels.
- Engineering: unit/e2e coverage for storage, history, endgame, legality and SGF; e2e in CI;
  actions pinned to SHAs; Dependabot; dependency updates (vite-plugin-pwa 2).

## 0.1.0

Initial release: rules engine, AI (three levels), 16 tsumego puzzles, rules page, SGF export,
game review, offline PWA.
