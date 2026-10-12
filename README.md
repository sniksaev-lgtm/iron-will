# Iron Will

**Play:** https://sniksaev-lgtm.github.io/iron-will/

Iron Will is a personal, offline-capable strategy/motivation PWA. The deployed version is intentionally a dependency-free HTML/CSS/JavaScript app so GitHub Pages can serve it without a build step. There is no game server, account, analytics, or network request for gameplay.

## Current features

- Large deterministic country-shaped maps of 32×32, 36×36, or 40×40 cells, with irregular coastlines, bays, peninsulas, and water cells. Existing island saves are migrated to a larger country map while resampling current ownership.
- Orthogonal-only captures; movement is checked in the game logic, not only the UI.
- Terrain and fortifications affect capture costs.
- Two strategic objectives: a supply depot grants a one-time +2 command-point bonus, and a reconnaissance tower reveals the forecast target.
- Forecasted enemy pressure plus distinct advance, fortification, and raid phases.
- Enemy occupied-cell limits: adaptive 4/5/7 depending on previous-day activity and territory balance, standard 8, hard 10 including raids. Planned raids reserve part of the limit so they are not starved by expansion.
- Ending the player phase clears unused points and locks further actions until the next local calendar day. Calendar changes are checked on focus/visibility and while the app remains open.
- The map persists across weeks: territory is not reset after a weekly result. Each week records a win/loss/draw, territory counts, and action count; the front only changes when the user explicitly starts a new one. Missed weeks are recorded on return without resetting the map.
- The refreshed UI performs a one-time local reset on first load, clearing the previous map, weekly results, and action journal so the updated game starts cleanly.
- Repeated identical custom actions are capped per day; common presets have their own limits.
- Weekly action statistics are separated from the lifetime action journal. Weekly results keep territory counts and the map seed; the active front itself is saved continuously.
- IndexedDB persistence, localStorage fallback, JSON export/import with size/schema/real-date validation, offline cache, sound toggle, reduced-motion setting, and visible runtime errors.
- Smoke tests live in tests/smoke.mjs.

## Run the smoke tests

Requires Node.js 20 or later; no npm packages are required.

    node tests/smoke.mjs

The smoke suite checks first launch/navigation, all map sizes and connected starts, seeded country generation, daily action limits, capture costs and adjacency, one-time supply reward, enemy caps, end-of-day lock/unlock, weekly result recording with territory persistence, persistence reload, real calendar dates, live calendar sync, and missed-week reports.

## Backup

Open Арсенал и настройки → Экспортировать сохранение regularly. Saves belong to this browser/profile and are not synchronized between devices. Import validates basic schema, supported map size, coordinates, owners, terrain, fortification range, and current points before replacing the save.

## Self-critique / known limitations

- **Client-only honesty boundary:** there is no server-side anti-cheat. Daily caps reduce accidental farming, but someone can still enter fictitious tasks, rename a task, or edit an exported JSON file. This app is a self-management tool, not a tamper-proof record.
- **Statistics UI:** weekly results and territory counts are saved in history, but there is not yet an interactive replay/viewer for historical map states.
- **Customization:** action rewards can be chosen at entry time, but there is not yet a full saved action-template editor or custom-category manager.
- **Adaptive balance:** the adaptive mode currently uses previous-day action count and current territory ratio. It is deliberately simple; it does not infer task difficulty or psychological state. Reserving raid slots can also mean the enemy uses fewer than its maximum expansion count if the planned raid has no reachable target.
- **Calendar semantics:** the campaign uses the device's local date. If the computer clock is moved backwards, the game does not rewind completed enemy turns; it may wait until the local date catches up.
- **Testing pipeline:** the deployment workflow publishes the static site, but it does not yet require the smoke suite to pass. The gameplay logic was additionally exercised in a browser-like harness; a real Playwright/browser/mobile/offline-install matrix has not been run.
- **Architecture trade-off:** this deployed edition is plain JavaScript rather than the originally proposed React/TypeScript stack. That made direct static hosting simpler, but it also means the app could benefit from being split into modules if it grows significantly.

All player data stays in the browser. Clearing site data can remove progress, so export a backup before clearing browser data or moving devices.