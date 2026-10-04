# Changelog

## Unreleased

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
