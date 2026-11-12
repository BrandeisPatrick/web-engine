# Performance: one score, a ratchet, a loop

Graphics performance is held to one number, measured by one command, against one committed file.

```bash
npm run perf              # measure everything, compare with the baseline (test/browser/perf.mjs)
npm run perf -- --costs   # also: where each view's frame goes
```

## The score

```
score = 100 x geometric mean, over every pose of every view, of (frame budget of the view / measured ms)
```

- A **view** is a sample on a quality tier at a fixed drawing-buffer size (`budgets.json`): the desktop tier at
  3024x1964 (a 14-inch MacBook Pro's native pixels) with a 12 ms budget, the mobile tier at 1280x720 with 4-5 ms.
- A **pose** is a fixed camera position the sample registered with its bench harness (`src/core/Bench.js`).
- **ms** is the median of 5 GPU-synchronised runs of 24 frames in headless Chrome on the real GPU.
- 100 means on budget on average. Higher is faster. The geometric mean makes a 10 % gain count the same on every
  pose, so the cheap poses cannot hide the expensive ones; the "over budget" list in the output is the backlog,
  worst first.

The run also records, per view: draw calls, triangles, JS heap after a forced GC, bytes of assets downloaded and
load time, each against its budget.

## The guards

A faster frame that breaks a guard is not an improvement, and the tool refuses to record it:

| guard | what it checks | where |
|---|---|---|
| image | every pose's picture against the golden image of the baseline: the same hash, or a pixel difference inside the baseline's own load-to-load noise. "Faster" cannot mean "renders less". | `npm run perf` |
| counters | draw calls and triangles (+5 %), JS heap (+10 %), asset bytes (+3 %) against the baseline | `npm run perf` |
| noise | a pose whose runs spread more than 6 % is inconclusive (exit code 2): nothing is concluded from it | `npm run perf` |
| look | tone and palette limits per pose (the art-direction standard: low-key exposure, nothing clipped, one hue family) | `npm run smoke` |
| stability | two captures of a pose are bit-identical | `npm run smoke` |
| correctness | the engine suites, including the pinned shader hashes and the determinism of the physics | `npm test` |

## The ratchet

- `bench/baseline/<machine>.json` (committed) holds the last accepted numbers for a machine class. Its git history
  is the performance history. `bench/.golden/` (local) holds the baseline's images.
- A change that makes the score better without tripping a guard is recorded with
  `npm run perf -- --update --log="what changed"`: the baseline moves and a row goes into `LOG.md`.
- A change that is slower or changes the picture on purpose (a new visual feature) is recorded with
  `npm run perf -- --update --accept="why"`. That is a decision for a person, not for the loop.
- An experiment that lost is reverted and recorded with `npm run perf -- --dropped="what, and why it lost"`, so it
  is not tried again blindly.
- `budgets.json` holds goals. They change when the owner changes the goal, never to make a run pass.

## Where a frame goes (`--costs`)

Timer queries are not trustworthy on ANGLE over Metal, so costs are measured by difference:

- **Pixel share**: the first pose at full size and at a quarter of the pixels. The part of the frame that scales with
  resolution is per-pixel work (shading, post passes, overdraw); the rest is per-frame work (geometry, shadow maps,
  CPU submission). It says which kind of optimisation can pay at all.
- **Knob costs**: every on / off setting the sample registered (`postfx.ssr`, `postfx.ao`, `lights.signs`, …) is
  switched off in turn: ms saved, and how much the picture changed. A new engine feature or a new optimisation
  registers a knob so it shows up here.

## How an optimisation lands

1. It is an option first (default off, the default output bit-identical: the suites pin this).
2. It is measured in the same page, on and off: ms and pixel difference (`window.__sample.run(plan)`, or the cost table).
3. If it wins, the tier presets in `src/core/Quality.js` (or the sample's tier overrides) turn it on. Performance
   decisions live in the tiers, not scattered through sample code.
4. `npm run perf -- --update --log="…"` moves the baseline.

## Real devices

The scripts drive this machine's GPU. For a phone or a tablet, open a sample with `?perfreport=1` (add
`&quality=mobile` to force the tier): it measures every pose at the size the device shows and offers the result as
JSON. Save it as `bench/devices/<device>.json`. Those numbers set the mobile budgets; the 1280x720 mobile view on a
desktop GPU is only a proxy for them.

## The loop

`LOOP.md` is the runbook for an unattended optimisation loop: `/loop Follow bench/LOOP.md in web-engine`.
