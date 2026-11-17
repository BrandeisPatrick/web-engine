# Wiring note: P2 Game shell (`feat/game-shell`)

For the integration agent. Delete this file after wiring.

What the branch adds, all under `src/ui/` (plus two tests):

- `src/ui/GameShell.js`: `GameShell` (loading bar, start card over the blurred live scene, pause card with volume,
  game toggles / sliders and the quality tiers, all saved; the start click calls `audio.start()`).
- `src/ui/Settings.js`: `createSettings(key, defaults, { version, storage, ranges })`.
- `src/ui/shellState.js`: `ShellState`, `SHELL_STATES`, `skipStartCard(search)`, `isBenchRun(search)`.
- `src/ui/LoadingScreen.js`: new opt-in `compositor: true` (default unchanged).
- `src/ui/QualityMenu.js`: exports `buildTierRows`, `chooseTier`, `injectQualityStyle`; the menu itself is unchanged.
- `src/ui/index.js`: exports all of the above (`src/index.js` re-exports `ui` with `export *`, so nothing to add there).
- `test/shell.mjs` (Node, 51 checks), `test/browser/shell.mjs` (headless Chrome, 33 checks).

## 1. `test/all.mjs`

Add after `{ file: 'quality.mjs' },`:

```js
  // ui: the game shell's state machine and saved settings (the DOM half is test/browser/shell.mjs)
  { file: 'shell.mjs' },
```

That makes this branch's count 48 (47 on main + 1); update the suite counts in the docs with the other packages'.

Browser script (not in `npm test`; GPU lock): `node test/browser/shell.mjs [--out=<dir>]`. If a doc lists the browser
scripts, add it there: "the game shell on starter-walk: start card, click starts and calls audio.start, Esc pauses the
clock, a slider survives a reload, ?autostart=1 skips, fits 375 px".

## 2. `test/types/check.ts`

Append (checked: `npm run types:check` passes with it; `engine` and `AudioBus` are already in scope there):

```ts
// ui: the game shell
import { GameShell, createSettings, LoadingScreen } from '@vibe/engine/ui';
const shell = new GameShell({ title: 'T', controls: [['W', 'Go']], storageKey: 't', defaults: { volume: 0.5, assist: true }, pauseCorner: 'tl' });
shell.setProgress(0.5, 'Loading').use({ engine, audio: new AudioBus(), inputs: [{ enabled: true }] });
const shellState: 'loading' | 'title' | 'playing' | 'paused' = shell.state; void shellState;
void shell.ready().then(() => shell.pause());
shell.onStart(() => {}).onPause((paused: boolean) => { void paused; }).addToggle('assist', 'Assist').addSlider('fov', 'Field of view', { min: 50, max: 90, step: 1 });
const offAssist: () => void = shell.settings.on('assist', (v) => { void v; }); offAssist();
const store = createSettings('k.settings', { a: 1 }, { version: 2 }); store.set('a', 2);
new LoadingScreen({ title: 'T', compositor: true }).setProgress(0.5);
```

## 3. The starters

Tried locally on this branch (not committed): `check-page.mjs` on both gave `ready in 852 ms ... 0 errors` and
`ready in 585 ms ... 0 errors`; a real click on starter-drive started it, W drove the car, Esc paused the clock.
starter-walk goes from 176 to 182 lines, starter-drive from 145 to 153.

Two things to know first:
- The tiers now live in the pause card, so the starters drop their `new QualityMenu(...)` line (the gear would also sit
  where the touch pause button goes, top right). Keep the `resolveQuality()` line.
- Some edits fall inside `howto:` regions (`hud` and `sound` in starter-walk), so the HOWTO copies of those regions
  must be updated too (test/docs.mjs fails until they are). The `setProgress` line below sits just before the
  `ground-texture` region on purpose.

### `samples/starter-walk/main.js`

```diff
-import { UILayer, Panel, Readout, QualityMenu } from '@vibe/engine/ui';
+import { UILayer, Panel, Readout, GameShell } from '@vibe/engine/ui';
@@ async function boot() {
+  // ---- loading bar, start card, pause with volume and quality (saved). The start click also starts the audio
+  // #region howto:game-shell
+  const shell = new GameShell({ title: 'Starter Walk', quality: Q, storageKey: 'starter-walk',
+    controls: [['W A S D', 'Walk'], ['Right-drag', 'Look'], ['Space', 'Jump'], ['Shift', 'Run']] });
+  // #endregion howto:game-shell
   // #region howto:walk-engine
@@ ground
+  shell.setProgress(0.1, 'Textures');
   // #region howto:ground-texture
@@ glb-load
-  await engine.load();
+  await engine.load((p, label) => shell.setProgress(0.3 + 0.6 * p, label));
@@ howto:hud
-  new QualityMenu({ quality: Q, corner: 'tr' });
@@ howto:sound
   const audio = new AudioBus({ volume: 0.7 });
-  audio.unlockOnGesture();
+  shell.use({ engine, audio, inputs: [input] }); // the start click calls audio.start(); pause mutes, Esc / P pause
@@ after the game system
   engine.start();
+  await shell.ready(); // shaders compiled, first frame drawn, the start card up (it does not wait for the click)
```

If P1's `SoundBank` / `Footsteps` arrive, pass the same bus; nothing else changes (`setPaused` is called when the bus
has it). `onStart` is not needed in the walker.

### `samples/starter-drive/main.js`

```diff
-import { UILayer, Panel, Readout, QualityMenu } from '@vibe/engine/ui';
+import { UILayer, Panel, Readout, GameShell } from '@vibe/engine/ui';
@@ async function boot() {
+  // ---- loading bar, start card, pause with volume, the assist toggle and quality (saved)
+  const shell = new GameShell({ title: 'Starter Drive', quality: Q, storageKey: 'starter-drive', defaults: { assist: true },
+    controls: [['W S', 'Drive, brake'], ['A D', 'Steer'], ['X', 'Handbrake'], ['C', 'Camera'], ['R', 'Reset']] });
   // ---- engine + physics. ...
@@ asphalt
+  shell.setProgress(0.2, 'Road');
   const texBase = `${BASE}nyc/textures/`;
@@ after // #endregion howto:drive-controls
+  shell.use({ engine, inputs: [input] }); // pass audio: bus here once the car has sound (P1)
+  shell.addToggle('assist', 'Steering assist');
+  shell.settings.on('assist', (on) => { if (input.assist) input.assist.enabled = on; }); // P3's VehicleInput assist
@@ HUD
-  new QualityMenu({ quality: Q, corner: 'tr' });
@@ after the game system
   engine.start();
+  await shell.ready();
+  shell.onStart(() => { car.reset(START, 0, physics); smooth.snap(); rig.snap(); }); // start the run from the line
```

With P3 merged, build the input with `new VehicleInput(renderer.domElement, { touch: 'auto', assist: true })` and the
`settings.on` line keeps it in step with the saved toggle (`on()` runs at once with the saved value). Drop the `if`
guard then. If the round decides the assist ships off (DECISION risk 2), set `defaults: { assist: false }`.

### Browser scripts that drive a starter

`window.__sample.ready` does not wait for the card, so smoke, bench (`?bench=1` skips the card) and the captures keep
working. But behind the card the starter's input is off, so a script that presses keys must add `?autostart=1`:
`test/browser/check-page.mjs` (holds W) and, to be safe, `test/browser/howto.mjs` (its third load drives the car).
Smoke captures read the framebuffer, which the CSS blur does not touch.

## 4. ENGINE.md, "Audio and UI": add a bullet after the UI one

```md
- `GameShell` (`src/ui/GameShell.js`): a game's front door in one object. `new GameShell({ title, controls, quality,
  storageKey })` shows a loading bar that keeps moving (`setProgress(p, label)`); `shell.use({ engine, audio, inputs })`
  once they exist; `await shell.ready()` compiles the scene's shaders, draws a frame and shows the start card over the
  live scene, blurred and dimmed (it does not wait for the click: set `window.__sample` after it). The start click
  calls `audio.start()` (the audio gesture), clears the blur in 1 s and turns the inputs back on (`enabled`). Esc, P,
  the pad's Start or the touch pause button pause: `engine.clock.pause()`, `audio.setPaused(true)` when the bus has
  it, inputs off; it also pauses when the tab is hidden or the pointer lock is lost. The pause card has the volume,
  `addToggle(key, label)` / `addSlider(key, label, { min, max, step })` rows and the quality tiers. Settings are saved
  (`shell.settings.get(k)`, `shell.settings.on(k, fn)` runs fn now and on change); `createSettings(key, defaults,
  { version })` is the store on its own. `?autostart=1` and `?bench=1` skip the card. `shell.state` is `'loading' |
  'title' | 'playing' | 'paused'`; `onStart(fn)`, `onPause(fn(paused))`.
- `LoadingScreen({ compositor: true })` keeps its bar moving while the main thread is busy (transform animations).
```

## 5. AGENTS.md

API-by-task table, a new row (after "HUD text"):

```md
| Loading, start screen, pause, saved settings | `GameShell` (ui) | `new GameShell({ title, controls, quality, storageKey })`, `shell.use({ engine, audio, inputs })`, `await shell.ready()` | starters |
```

Change the "Desktop / phone tiers" row's call to: `const S = resolveQuality().settings`; `new GameShell({ quality })`
puts the tiers in the pause card (or `new QualityMenu({ quality })` without a shell).

Change the "A sound" row's call to: `new GameShell({ ..., audio: bus })` starts it on the start click (or
`bus.unlockOnGesture()` without a shell); `playTone(bus.ctx, bus.bus('ui'), { pitch, peak, decay })`.

Known traps, replace the audio bullet with:

```md
- Audio needs a user gesture: `bus.bus(name)` is null and nothing plays until `bus.start()` runs inside a click or a
  key press. `GameShell` does it on its start click (pass `audio: bus`); without a shell call `bus.unlockOnGesture()`.
- Behind the `GameShell` start card the inputs are off: a script that presses keys must load the page with
  `?autostart=1`.
```

## 6. docs/HOWTO.md: a recipe, e.g. after "HUD text"

````md
## Loading, a start screen and pause

`GameShell` (ui) gives a game a loading bar, a start card over the blurred scene, and pause with volume and quality,
all saved in localStorage. Build it first, so the bar shows while the rest loads:

<!-- from: samples/starter-walk/main.js#game-shell -->
```js
const shell = new GameShell({ title: 'Starter Walk', quality: Q, storageKey: 'starter-walk',
  controls: [['W A S D', 'Walk'], ['Right-drag', 'Look'], ['Space', 'Jump'], ['Shift', 'Run']] });
```

Then, as in the starter: `shell.setProgress(p, label)` around the loads (`engine.load((p, label) =>
shell.setProgress(0.3 + 0.6 * p, label))`), `shell.use({ engine, audio, inputs: [input] })` once they exist (the start
click calls `audio.start()`, so no `unlockOnGesture()`), and `await shell.ready()` after `engine.start()`, before the
page contract (it does not wait for the click). A game setting in the pause card: `shell.addToggle('assist', 'Steering
assist')` and `shell.settings.on('assist', (on) => { ... })`, which runs at once with the saved value. Esc or P pauses
(`engine.clock` stops, the loop keeps drawing); `shell.onPause((paused) => ...)` to react, e.g. to request the pointer
lock again on resume (it runs inside the Resume click). Load the page with `?autostart=1` to skip the card in tests.
````

(The marked block must match the `howto:game-shell` region exactly, dedented; adjust if the starter lines change.)

## 7. CHANGELOG

"GameShell (ui): loading bar that keeps moving, start card over the blurred scene, pause card with volume, game
toggles / sliders and quality tiers, saved settings (`createSettings`); the start click is the audio gesture.
`LoadingScreen({ compositor: true })`. `QualityMenu` exports its tier rows (`buildTierRows`, `chooseTier`)."
