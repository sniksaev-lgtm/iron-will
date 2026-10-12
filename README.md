# Iron Will

**Play:** https://sniksaev-lgtm.github.io/iron-will/

Iron Will is a personal, offline-capable strategy/motivation PWA. The deployed version is intentionally a dependency-free HTML/CSS/JavaScript app so GitHub Pages can serve it without a build step. There is no game server, account, analytics, or network request for gameplay.

## Current features

- Random weekly maps of 12×12, 16×16, or 20×20, with saved seeds and deterministic map generation.
- Orthogonal-only captures; movement is checked in the game logic, not only the UI.
- Terrain and fortifications affect capture costs.
- Two strategic objectives: a supply depot grants a one-time +2 command-point bonus, and a reconnaissance tower reveals the forecast target.
- Forecasted enemy pressure plus distinct advance, fortification, and raid phases.
- Enemy occupied-cell limits: adaptive 4/5/7 depending on recent activity and territory balance, standard 8, hard 10 including raids.
- Ending the player phase clears unused points and locks further actions until the next local calendar day.
- Repeated identical custom actions are capped per day; common presets have their own limits.
- Current-campaign statistics are separated from lifetime actions; finished campaigns keep a map snapshot and seed.
- IndexedDB persistence, localStorage fallback, JSON export/import, stricter import validation, offline cache, sound toggle, reduced-motion setting, and visible runtime errors.
- Smoke tests live in tests/smoke.mjs.

## Run the smoke tests

Requires Node.js 20 or later; no npm packages are required.

    node tests/smoke.mjs

The smoke suite checks first launch/navigation, all map sizes and connected starts, seeded generation, daily action limits, capture costs and adjacency, one-time supply reward, enemy caps, end-of-day lock/unlock, historical snapshots, campaign rollover, and persistence reload.

## Backup

Open Арсенал и настройки → Экспортировать сохранение regularly. Saves belong to this browser/profile and are not synchronized between devices. Import validates basic schema, supported map size, coordinates, owners, terrain, fortification range, and current points before replacing the save.

## Self-critique / known limitations

- **Client-only honesty boundary:** there is no server-side anti-cheat. Daily caps reduce accidental farming, but someone can still enter fictitious tasks, rename a task, or edit an exported JSON file. This app is a self-management tool, not a tamper-proof record.
- **Statistics UI:** completed maps and seeds are saved in history, but there is not yet an interactive replay/viewer for historical maps.
- **Customization:** action rewards can be chosen at entry time, but there is not yet a full saved action-template editor or custom-category manager.
- **Adaptive balance:** the adaptive mode currently uses previous-day action count and current territory ratio. It is deliberately simple; it does not infer task difficulty or psychological state.
- **Calendar semantics:** the campaign uses the device's local date. If the computer clock is moved backwards, the game does not rewind completed enemy turns; it may wait until the local date catches up.
- **Testing pipeline:** smoke tests are available for manual execution with Node, but the deployment workflow currently publishes on push without running this suite as a required gate.
- **Architecture trade-off:** this deployed edition is plain JavaScript rather than the originally proposed React/TypeScript stack. That made direct static hosting simpler, but it also means the app could benefit from being split into modules if it grows significantly.

All player data stays in the browser. Clearing site data can remove progress, so export a backup before clearing browser data or moving devices.