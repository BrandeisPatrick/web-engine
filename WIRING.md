# Wiring note: P1 sound kit (`feat/sound-kit`)

For the integration agent. Delete this file when done. Nothing below is applied on this branch: it touches only
`src/audio/**`, `test/audio-*.mjs`, `test/browser/sound-check.mjs` and `samples/sound-check/`.

## 1. `test/all.mjs`: three suites (47 -> 50 from this package)

Add before the `docs.mjs` entry:

```js
  // audio (sound kit): the DSP and every preset measured (peak, DC, ends / loop seam, centroid band, seeds), the voice
  // policy and the mixer graphs on a fake AudioContext, SoundBank / analyseMix without Web Audio
  { file: 'audio-dsp.mjs' },
  { file: 'audio-voices.mjs' },
  { file: 'audio-bank.mjs' },
```

No shim needed (they import three, never touch the DOM). Together about 1.5 s.

## 2. `vite.config.js`: build `sound-check` in the extras pass

```js
const isExtra = (name) => name === 'assets' || name === 'sound-check' || name.startsWith('starter-');
```

and add "the sound check page (samples/sound-check/)" to the comment above it. The dev server already finds the page.

## 3. `test/browser/smoke.mjs`: page list

In the default `pages` list, after `'assets'`:

```js
  // the Asset library page
  'assets',
  // the sound kit page: its selfTest() renders the ten-second scene offline and checks the mix limits
  'sound-check',
```

No `PAGE_QUERY` entry. It has no poses, so smoke calls `__sample.selfTest()` (checked: `node test/browser/smoke.mjs
sound-check` -> `[smoke] OK (1 ready, 0 skipped)`).

Also run (or list in the round's checks) `node test/browser/sound-check.mjs [--wav=x.wav] [--shot=x.png]`, which prints
the measured numbers and can save the mix and a full-page screenshot.

## 4. `samples/index.html`

After the Asset library link:

```html
    <a href="./sound-check/"><b>Sound check</b><span>The sound kit's 18 named sounds made in code, each with its waveform and numbers, and a measured ten-second mix you can download.</span></a>
```

## 5. `test/types/check.ts`

Add `SoundBank, Footsteps, SOUND_PRESETS, audioSelfTest, encodeWav, analyseMix, dsp` to the existing
`@vibe/engine/audio` import (line 11 imports `AudioBus`), add
`import type { SoundVoice, LoopHandle, SelfTestReport, SoundPreset } from '@vibe/engine/audio';`, then:

```ts
// sound kit: safe master, bank, footsteps, self-test
const kitBus = new AudioBus({ master: 'safe', volume: 0.7 });
kitBus.setPaused(true, 0.2); kitBus.setMuffle(0.5); kitBus.duck('ambience', 0.5, 3.5);
const sfx = new SoundBank(kitBus, { listener: new THREE.PerspectiveCamera(), seed: 1 });
const hit: SoundVoice = sfx.play('impact.metal', { at: new THREE.Vector3(1, 0, 2), gain: 0.8, rate: 1 });
hit.stop(0.1);
const bed: LoopHandle = sfx.loop('amb.dusk', { gain: 0.14 });
bed.setGain(0.2).setRate(1).stop(0.5);
sfx.update(1 / 60);
const kitSamples: Float32Array = sfx.render('step.wood', 2);
const roarPreset: SoundPreset = SOUND_PRESETS['road.roar'];
const steps = new Footsteps(sfx, { surface: 'grass', at: new THREE.Object3D() });
const stepPlayed: string = steps.update(1 / 120, { speed: 2, grounded: true, landed: false, landingSpeed: 0 });
const kitWav: Uint8Array = encodeWav([kitSamples, kitSamples], 44100);
const kitMix = analyseMix([kitSamples], 44100, { peak: 0.9 });
const kitCentroid: number = dsp.spectralCentroid(kitSamples, 44100) + roarPreset.peak + kitMix.peak + kitWav.length + stepPlayed.length;
const kitReport: Promise<SelfTestReport> = audioSelfTest({ seconds: 2, build: (b) => { const s = new SoundBank(b); return (t: number) => { if (t > 1) s.play('ui.click'); }; } });
void kitReport; void kitCentroid;
```

Rename if a name collides with what is already in check.ts (it has an `audio` and an `aState`). Checked here in a
strict scratch consumer against `types/`: compiles. Also `new VehicleAudio({ ..., wind: false, tyres: false })` types.

## 6. ENGINE.md

Layer table, audio row, append to "Main exports":

`, the sound kit: `SoundBank` (named sounds, voice policy), `SOUND_PRESETS` (18), `Footsteps`, `VoicePool`, `audioSelfTest` / `analyseMix` / `MIX_LIMITS`, `encodeWav`, the `dsp` namespace; `AudioBus({ master: 'safe' })`, `SAFE_MASTER``

"Audio and UI" section, new bullets after the `AudioBus` one:

```md
- The sound kit: `new AudioBus({ master: 'safe' })` puts a compressor, a soft clipper (linear to 0.6, then
  0.6 + 0.4 tanh) and the volume after the buses (`SAFE_MASTER`), and suspends the context while the tab is hidden;
  the default chain is unchanged. Any bus: `setPaused(on, fade)` fades every bus but `ui`, `setMuffle(0..1)` low-passes
  them (20000 * 0.03^z Hz), `duck(name, to, recoverPerSec)`. `context` takes an `OfflineAudioContext` (no gesture).
- `new SoundBank(bus, { listener: camera })` plays the 18 `SOUND_PRESETS`: `ui.click`, `ui.confirm`, `ui.back`,
  `pickup.chime`, `step.grass|concrete|gravel|wood`, `land.soft|hard`, `impact.metal|wood|thud`, and the loops
  `tyre.squeal`, `road.roar`, `wind.rush`, `amb.dusk`, `lamp.hum`. `play(name, { at, gain, rate })` returns a voice
  (an inert one before the first gesture, never null); `loop(name, { at, gain })` returns `{ setGain, setRate, stop }`
  and, made before the gesture, starts with the bus; `update(dt)` per frame. 24 one-shot voices; per sound a cap and a
  priority decide what is stolen (`VoicePool`). Variants round-robin, pitch +-3.5 % and gain -0..8 % per play.
  Sounds are rendered in plain JavaScript (`src/audio/dsp.js`, `src/audio/presets.js`), so `bank.render(name, variant)`
  runs in Node; `bank.define(name, spec)` adds one.
- `new Footsteps(bank, { surface })`, then per step `steps.update(dt, { speed, grounded, landed, landingSpeed })`
  (`CharacterController`'s fields): a footfall every 0.95 m at a walk to 2.1 m at a run, `land.soft` / `land.hard` by
  landing speed.
- Measured, not listened to: `test/audio-dsp.mjs` holds every preset variant to its peak, DC, ends or loop seam and
  centroid band; `samples/sound-check/` renders a ten-second dusk-road scene offline (`audioSelfTest`) and checks no
  NaN, nothing clipped, peak <= 0.85, no silent half-second and none 12 dB over the median (`MIX_LIMITS`).
- `VehicleAudio({ wind: false, tyres: false })` leaves wind and tyre noise to the kit's loops (both default on).
```

## 7. AGENTS.md

API-by-task table, replace the "A sound" row and add two:

```md
| A sound | `AudioBus`, `SoundBank` (audio) | `new AudioBus({ master: 'safe' })`, `bus.unlockOnGesture()`; `new SoundBank(bus, { listener: camera }).play('impact.wood', { at })` | `samples/starter-walk/main.js` |
| Footsteps, ambience | `Footsteps`, `SoundBank` (audio) | `steps.update(dt, { speed, grounded, landed, landingSpeed })`; `sfx.loop('amb.dusk', { gain: 0.14 })` | `samples/starter-walk/main.js` |
| Car sounds | `VehicleAudio`, `SoundBank` (audio) | `motor.update(dt, { speedKmh, rpmLike, grounded })`; loops `road.roar`, `wind.rush`, `tyre.squeal` with `setGain` | `samples/starter-drive/main.js` |
```

(Keep the existing "Car engine sound" row or fold it into "Car sounds".) The "API by task" table also gets the
sound check page as a way to hear / check sounds: `samples/sound-check/`.

Known traps, replace the audio line with:

```md
- Audio needs a user gesture: `bus.bus(name)` is null until then, `SoundBank.play` returns an inert voice (never
  null) and `SoundBank.loop` waits and starts with the bus. Mix quietly: the kit's beds sit near -30 dBFS, so start
  loops at the gains the starters use, not at 1.
- Sound names are exact (`step.gravel`, not `gravel`); an unknown name throws and lists the 18.
```

"What nobody has verified", replace the audio bullet with:

```md
- Audio is measured, not listened to: every preset's peak, DC, loop seam and spectral band, and a ten-second mix
  (`samples/sound-check/`: no clipping, peak <= 0.85, no silent or over-loud half-second) are checked by machine, and
  the starters' sound was measured flowing in headless Chrome. No person has listened to any of it.
```

Commands table, optional row: `node test/browser/sound-check.mjs --wav=mix.wav` | Render the sound kit's ten-second
self-test scene in headless Chrome, print its measurements and save the mix.

## 8. docs/HOWTO.md

The "Play a sound" recipe is a copy of starter-walk's `howto:sound` region, so it changes with the starter. New text:

```md
## Play a sound

`AudioBus`, `SoundBank`, `Footsteps` (audio). Browsers start audio only after a click or key press;
`unlockOnGesture()` waits for the first one (a `GameShell` start click does too). `master: 'safe'` adds a compressor
and a soft clipper so nothing clips. `SoundBank` plays the kit's named sounds (`SOUND_PRESETS`, listed on
`samples/sound-check/`); before the gesture `play` returns an inert voice and `loop` waits for the start. Footsteps
take the character controller's fields each fixed step (`howto:walk-step`), and `sfx.update(dt)` per frame moves the
listener with the camera.
```

followed by the `<!-- from: samples/starter-walk/main.js#sound -->` block (unchanged mark, new content). Line 105's
"(`hop` is the sound in "Play a sound")" becomes "(`steps` is the Footsteps in "Play a sound")", and the copies of
`howto:walk-step`, `howto:walk-draw` and `howto:drive-draw` must be refreshed (test/docs.mjs fails until they are).
For starter-drive, wrap its sound block in a new `// #region howto:drive-sound` and add a "Car sounds" recipe from it
next to "Vehicle sound".

## 9. The starters (tried locally, not committed)

Applied to both starters in this worktree, `node test/browser/check-page.mjs` gave `starter-walk: ready in 575 ms,
39 draw calls, 0 errors` and `starter-drive: ready in 574 ms, 85 draw calls, 0 errors`. An analyser tap on the
destination (scratch script, headless Chrome, volume 0.7) measured sound flowing: starter-walk about -33 dBFS while
running (bed plus footsteps, peaks 0.04 to 0.08), starter-drive silent at rest (the electric motor has no idle
sound), about -28 dBFS driving and -25 dBFS sliding with X held (peak 0.16). Then the starters were reverted.
starter-walk ends at 180 lines, starter-drive at 162.

### starter-walk (`samples/starter-walk/main.js`)

Import line:

```js
import { AudioBus, SoundBank, Footsteps } from '@vibe/engine/audio';
```

Replace the body of `// #region howto:sound` with:

```js
  const audio = new AudioBus({ master: 'safe', volume: 0.7 }); // compressor + soft clipper: nothing can clip
  audio.unlockOnGesture();                                      // sound starts on the first click / key
  const sfx = new SoundBank(audio, { listener: camera });        // the named sounds (SOUND_PRESETS)
  const steps = new Footsteps(sfx, { surface: 'grass', at: player });
  sfx.loop('amb.dusk', { gain: 0.14 });                          // a quiet dusk bed
  sfx.loop('lamp.hum', { at: lampAt, gain: 0.2 });               // the lamp hums when you are near it
```

In `fixedUpdate`, replace `if (cc.jumpedThisStep) hop();` with:

```js
      steps.update(dt, { speed: cc.speed, grounded: cc.grounded, landed: cc.landedThisStep, landingSpeed: cc.landingSpeed });
```

In `update`, after `rig.update(dt);`:

```js
      sfx.update(dt);
```

With P2's GameShell: pass `audio` as its `audio:`; the start click starts it and pause calls `audio.setPaused`.
`unlockOnGesture()` can stay (harmless) or go.

### starter-drive (`samples/starter-drive/main.js`)

Import line, before the ui import:

```js
import { AudioBus, SoundBank, VehicleAudio } from '@vibe/engine/audio';
```

After `// #endregion howto:drive-controls` (suggested region `howto:drive-sound`):

```js
  // ---- sound: the safe mixer, the motor (VehicleAudio), road roar, wind and squeal loops, a thud on a hit
  const audio = new AudioBus({ master: 'safe', volume: 0.7 });
  audio.unlockOnGesture(); audio.setBusVolume('engine', 0.35);
  const motor = new VehicleAudio({ bus: audio, ambience: false, topSpeed: 200 / 3.6, wind: false, tyres: false });
  const sfx = new SoundBank(audio, { listener: camera });
  const roar = sfx.loop('road.roar', { gain: 0 }), wind = sfx.loop('wind.rush', { gain: 0 }), squeal = sfx.loop('tyre.squeal', { gain: 0 });
  let hitCool = 0;
```

In `fixedUpdate`, after `car.step(dt, controls, physics);`:

```js
      hitCool -= dt;
      if (car.impact > 3 && hitCool <= 0) { sfx.play('impact.thud', { at: body, gain: Math.min(1, car.impact / 12) }); hitCool = 0.25; }
```

In `update`, after `rig.update(dt);`:

```js
      const v = car.speed, w = Math.min(v / 55, 1), slide = Math.min(Math.max((car.wheelSlip - 0.15) * 1.4, 0), 1) * Math.min(v / 6, 1);
      motor.update(dt, { speedKmh: v * 3.6, rpmLike: controls.throttle, grounded: car.grounded });
      roar.setGain(car.grounded ? 0.22 * Math.min(v / 30, 1) : 0).setRate(0.8 + 0.6 * Math.min(v / 50, 1));
      wind.setGain(0.3 * w * w).setRate(0.9 + 0.3 * w);
      squeal.setGain(car.grounded ? 0.22 * slide : 0).setRate(0.96 + 0.08 * slide);
      sfx.update(dt);
```

These gains are the ones the self-test scene uses (`samples/sound-check/scene.js`, `driveLoops`), so the measured
mix is the starter's mix. The `car.impact` threshold of 3 m/s and the 0.25 s cool-down were not tuned against real
post hits (the local run drove straight); check that a post hit gives one thud and a landing on flat road none.

## 10. CHANGELOG (suggested line)

Sound kit: `SoundBank` with 18 named sounds rendered in plain JavaScript, `Footsteps`, a voice policy, the 'safe'
master chain and `setPaused` / `setMuffle` / `duck` on `AudioBus`, `audioSelfTest` and the `samples/sound-check/`
page; every sound and a ten-second mix are measured (no one has listened yet).
