# Mobile basics (step 1 of the mobile plan)

* **Save:** `src/game/save.ts`. Whole world as JSON in storage key `frostline.save.v1`
  (layout, RNG and effects are rebuilt on load). Saves every 8 s while playing,
  on pause, when the app goes to the background and on page close.
* **Storage:** `src/platform/storage.ts` (localStorage). When wrapping with
  Capacitor, switch it to `@capacitor/preferences` so iOS never clears saves.
* **Pause / resume:** pause button (top right); going to the background pauses
  and saves; coming back shows the pause menu.
* **Away earnings:** 10% of the recent income rate ($/s, smoothed over ~2 min of
  play) for up to 4 hours away; only once you have workers; minimum 1 minute.
* **Sound:** `src/platform/audio.ts`, all synthesised (no audio files): footsteps,
  chopping, mining, fishing, items landing, coins, cooking, builds, upgrades,
  missions, level-ups, fire, wolves; soft generative music with wind.
  Unlocked on the first tap (Play), as iOS requires.
* **Vibration:** `src/platform/haptics.ts`. Native Haptics plugin inside the app;
  `navigator.vibrate` on Android browsers; none in iPhone Safari (iOS has no
  web vibration), so on iPhone it works only once the game is an app.
* **Menus:** `src/ui/Menus.tsx` — main menu (Play / Continue / New game with
  confirm / Settings), pause menu, welcome-back card. Settings persist.
