# Wiring note: P3 drive feel (`feat/drive-feel`)

Integration deletes this file. Everything below was tried locally (registration lines, the type-check block, the
starter lines) and passed; none of it is committed on this branch.

## What the branch adds

| File | What |
|---|---|
| `src/input/SteeringAssist.js` | `new SteeringAssist(opts).apply(dt, steer, car, analog?, handbrake?)` -> assisted steer -1..1 |
| `src/input/VehicleHaptics.js` | `new VehicleHaptics(opts).update(dt, car, pad)`; `.weak` / `.strong` 0..1 |
| `src/input/VehicleInput.js` | `new VehicleInput(el, { assist: true \| {...} })`, `input.update(dt, car)`, `input.assist` (always built, off by default), `input.rawSteer` |
| `src/render/TyreFx.js` | `new TyreFx({ scene, atmosphere, budget: { marks, smoke, rate }, lift })`, `update(dt, car, body)`, `clear()`, `dispose()` |
| `src/physics/VehicleController.js` | output fields only: `steerLimit`, `slipFront`, `slipRear`, `slipPeakFront`, `slipPeakRear`, `wheels[i].slideHeat` (kW) |
| `src/input/index.js`, `src/render/index.js` | exports `SteeringAssist`, `VehicleHaptics`, `TyreFx` and their option typedefs |
| `test/steering-assist.mjs`, `test/tyre-fx.mjs` | Node suites (new) |
| `test/browser/drive-feel.mjs` | browser check on starter-drive (GPU lock) |

## 1. `test/all.mjs`

After `{ file: 'character-input.mjs' },`:

```js
  // drive feel: steering assist with and without on ROAD_CAR_SPEC (lock, handbrake catch, slalom, turning circle), rumble values
  { file: 'steering-assist.mjs' },
```

After `{ file: 'gpu-particles.mjs', shim: true },`:

```js
  // skid marks and tyre smoke from wheels[i].slideHeat (TyreFx): clean corner leaves nothing, a slide marks and smokes
  { file: 'tyre-fx.mjs', shim: true },
```

(`tyre-fx.mjs` also imports `./helpers/dom-shim.mjs` itself, so it runs standalone; `shim: true` is harmless.)
Suite count +2.

Browser script (not in `npm test`): `node test/browser/drive-feel.mjs [--out=<dir>]` through the GPU lock.

## 2. `test/types/check.ts`

Append (compiled with `npm run types:check` locally):

```ts
// drive feel: steering assist, tyre marks and smoke, rumble (feat/drive-feel)
import { SteeringAssist, VehicleHaptics, VehicleInput as DriveInput, type SteeringAssistOptions } from '@vibe/engine/input';
import { TyreFx, type TyreFxOptions } from '@vibe/engine/render';
import { VehicleController as DriveCar, ROAD_CAR_SPEC as DRIVE_SPEC } from '@vibe/engine/physics';
{
  const car = new DriveCar(DRIVE_SPEC);
  const input = new DriveInput(undefined, { assist: { peak: 0.95 } });
  input.update(1 / 60, car);
  const steer: number = input.steer + input.rawSteer;
  input.assist.enabled = false;
  const ao: SteeringAssistOptions = { fadeSpeed: [6, 12], slideCatch: [0.85, 1.65] };
  const out: number = new SteeringAssist(ao).apply(1 / 60, 0.5, car, true, false);
  const tyre: number = car.steerLimit + car.slipFront + car.slipRear + car.slipPeakFront + car.slipPeakRear + car.wheels[0].slideHeat;
  const fo: TyreFxOptions = { budget: { marks: 800, smoke: 120, rate: 20 }, lift: 0.04 };
  const fx = new TyreFx(fo);
  fx.update(1 / 60, car, null); fx.clear();
  const level: number = fx.markLevel[0] + fx.smokeLevel[0] + fx.stats.puffs;
  const rumble = new VehicleHaptics({ gain: 0.8 }).update(1 / 60, car, null);
  const weak: number = rumble.weak + rumble.strong;
  void steer; void out; void tyre; void level; void weak;
}
```

## 3. `samples/starter-drive/main.js` (7 lines changed, 147 lines total)

Recommendation: ship with the assist **on**. The with-and-without numbers show a clear gain (full lock at 30 m/s:
raw spins, assisted holds 0.93 g at 0.96 x peak front slip; key slaloms at 28 m/s: raw spins in 3 of 3, assisted
never past 12 degrees of sideslip; a 15 degree handbrake slide is caught 0.68 s after release, raw spins).

```diff
-import { Atmosphere, PostFX, loadTextureManifest, loadTextureSet } from '@vibe/engine/render';
+import { Atmosphere, PostFX, loadTextureManifest, loadTextureSet, TyreFx } from '@vibe/engine/render';
@@ region howto:drive-controls
-  const input = new VehicleInput(renderer.domElement, { touch: 'auto' });
+  const input = new VehicleInput(renderer.domElement, { touch: 'auto', assist: true }); // assist: lock at the grip limit, catches slides
   const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false }; // what car.step() reads
   const state = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0 };
+  const tyres = new TyreFx({ scene, atmosphere, lift: 0.04 }); // skid marks + thin smoke from wheels[i].slideHeat
@@ region howto:drive-input
-      input.update(dt);
+      input.update(dt, car); // with the car: steer comes out assisted (input.assist.enabled toggles it)
-      if (input.reset) { car.reset(START, 0, physics); smooth.snap(); rig.snap(); } // back to the start
+      if (input.reset) { car.reset(START, 0, physics); smooth.snap(); rig.snap(); tyres.clear(); } // back to the start
@@ region howto:drive-draw
       smooth.apply(body, alpha);
+      tyres.update(dt, car, body);
@@ page contract
-  window.__sample = Object.assign(createBenchHarness(engine, { name: 'starter-drive' }), { car, body }).setReady();
+  window.__sample = Object.assign(createBenchHarness(engine, { name: 'starter-drive' }), { car, body, input, tyres }).setReady();
```

Notes:
- `lift: 0.04`: the starter's road plane sits at y = 0.02 over the physics ground at 0; the default lift (0.03) would
  put the marks just under the road in places. A game whose visible ground is the physics ground can leave it out, or
  pass `groundAt: (x, z) => height`.
- The changed lines sit inside `howto:drive-controls`, `howto:drive-input` and `howto:drive-draw`, so the copies of those
  regions in `docs/HOWTO.md` ("Drive a car") must be refreshed verbatim or `test/docs.mjs` fails.
- Exposing `input` and `tyres` on `__sample` lets `test/browser/drive-feel.mjs`-style checks read them; optional.
- Tried locally: starter loads with no console errors; W for 4.5 s then A + X for 0.5 s: 100 mark segments, 18 puffs,
  the assist countersteering (steer 0.63 with raw 0) after the release; `input.assist.enabled = false` works live.

Pause-menu toggle with P2's GameShell (the shell's API from the decision; not tried, the shell is on another branch):

```js
const shell = new GameShell({ /* ... */ inputs: [input], storageKey: 'starter-drive', defaults: { volume: 0.7, assist: true } });
shell.addToggle('assist', 'Steering assist');
input.assist.enabled = shell.settings.get('assist') !== false;
shell.settings.on('assist', (on) => { input.assist.enabled = !!on; });
```

Optional, not recommended for the starter's line budget: gamepad rumble, two lines.

```js
const haptics = new VehicleHaptics();                       // import from '@vibe/engine/input'
haptics.update(dt, car, input.map.gamepad);                 // in update(), after the step; nobody has felt it yet
```

## 4. ENGINE.md

Layer table rows (add the names):
- render row: add `` `TyreFx` `` after `` `DecalTrail` ``.
- input row: add `` `SteeringAssist`, `VehicleHaptics` `` after `` `VehicleInput` ``.

In "Vehicle model", after the paragraph ending "`PhysicsWorld.setSurfaceProvider(fn)` / `surfaceAt(x, z, out)` give
per-wheel `{ mu, crr, tag }` multipliers.", add:

> Tyre outputs, written by each grounded step and 0 in the air (they change nothing in the simulation): `steerLimit`
> (rad, the speed-sensitive lock the step allowed: `|steerAngle|` at full input), `slipFront` / `slipRear` (rad, the
> axle's signed slip angle), `slipPeakFront` / `slipPeakRear` (rad, the slip angle of peak grip, `tan(pi / 2C) / B`,
> fixed by the spec) and `wheels[i].slideHeat` (kW: load x sliding speed once a tyre is past 1.1 x its peak slip, x4
> for a handbrake-locked rear wheel; 0 while it grips). `TyreFx` (render) turns `slideHeat` into skid marks (from
> 12 kW) and thin smoke (from 25 kW) on one `DecalTrail` and one `ParticleSystem`: `new TyreFx({ scene, atmosphere,
> budget: { marks, smoke, rate } })`, per frame `tyres.update(dt, car, body)`, `tyres.clear()` on a reset. A clean
> corner leaves nothing; ABS and the drive-force cap mean straight braking and launches never mark either.

In "Animation, input and camera", after the `VehicleInput` bullet ("... the values `VehicleController.step` takes."), add:

> - Steering assist (opt-in): `new VehicleInput(el, { assist: true })` and `input.update(dt, car)` with the car being
>   driven: `steer` comes out of a `SteeringAssist` and `rawSteer` keeps the player's value; `input.assist.enabled`
>   switches it live (a pause-menu toggle). Full input asks for the wheel angle that holds the front tyre at 0.97 x its
>   peak slip against the front axle's direction of travel (inside the controller's `steerLimit`); with no input the
>   wheels self-steer toward the rear axle's travel, so a slide is caught; past the rear's peak a key (not a stick)
>   hands over to self-steer; a yaw guard trims lock when the car rotates faster than its path. It passes the input
>   through below 6 m/s (fully on from 12), in reverse, in the air and while the handbrake is held. Standalone:
>   `new SteeringAssist(opts).apply(dt, steer, car, analog, handbrake)`. Method: AC-Advanced-Gamepad-Assist (MIT).
> - `VehicleHaptics`: gamepad rumble from slides, a locked wheel, landings and hits, layered `acc + m (1 - acc)`:
>   `haptics.update(dt, car, input.map.gamepad)`. Not felt by anyone yet.

## 5. AGENTS.md

API-by-task table rows, after "Drive a car":

```md
| Keyboard steering that holds the grip limit and catches slides | `VehicleInput`, `SteeringAssist` (input) | `new VehicleInput(el, { assist: true })`; per frame `input.update(dt, car)`; `input.assist.enabled` toggles it | `samples/starter-drive/main.js` |
| Skid marks and tyre smoke | `TyreFx` (render) | `new TyreFx({ scene, atmosphere })`; per frame `tyres.update(dt, car, body)`; `tyres.clear()` on reset | `samples/starter-drive/main.js` |
```

Known traps, one line:

```md
- `VehicleInput.update(dt)` without the car never runs the assist, even with `{ assist: true }`: pass the car, `input.update(dt, car)`.
```

## 6. docs/HOWTO.md recipe

Add to the contents line `[Steering assist, skid marks and smoke](#steering-assist-skid-marks-and-smoke)` after
"Get in and out of a vehicle", and this section after "Get in and out of a vehicle" (its code blocks are the starter's
regions once wired, so `test/docs.mjs` checks them; the regions are the three listed in section 3):

```md
## Steering assist, skid marks and smoke

On a keyboard full lock at speed overshoots the front tyres' grip and a slide is hard to catch. The steering assist
(`VehicleInput` option `assist`, input) holds the lock at the tyres' grip limit and self-steers toward the direction of
travel when the rear steps out. `TyreFx` (render) lays skid marks and thin smoke only where a tyre slides: a clean fast
corner leaves nothing, a handbrake turn leaves dark marks.

<!-- from: samples/starter-drive/main.js#drive-controls -->
(the region, with `assist: true` and the TyreFx line)

Pass the car to `input.update` (without it the assist never runs), and clear the marks on a reset:

<!-- from: samples/starter-drive/main.js#drive-input -->
(the region)

Lay the marks after the body is drawn (`body` is the interpolated pose, so the ribbons are smooth):

<!-- from: samples/starter-drive/main.js#drive-draw -->
(the region)

A pause-menu switch is `input.assist.enabled = on`. Budget: `new TyreFx({ budget: { marks: 600, smoke: 120 } })` on
the mobile tier; one draw call each for marks and smoke, about 0.04 ms of CPU per frame while sliding.
```

## 7. CHANGELOG line

```md
- Drive feel: `SteeringAssist` (opt-in through `VehicleInput { assist }` and `update(dt, car)`), `TyreFx` (skid marks
  and thin smoke from tyre sliding heat), `VehicleHaptics` (gamepad rumble), and `VehicleController` tyre outputs
  (`steerLimit`, slip angles and peaks, `wheels[i].slideHeat`); dynamics unchanged bit for bit.
```
