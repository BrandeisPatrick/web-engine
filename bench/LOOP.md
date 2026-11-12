# Optimisation loop: runbook

Run with `/loop Follow bench/LOOP.md in web-engine`. Each firing is ONE iteration: one hypothesis, measured, kept or
dropped. The goal is a higher score from `npm run perf` (see `README.md` in this folder) with every guard green.

## Before the first iteration

- Work in the repository root on a branch named `perf/<topic>` cut from the branch the samples are on. Never on
  `main`.
- The working tree is clean, `npm test` and `npm run smoke` pass, and nothing else is using the GPU (another bench, a
  running demo, a video call).
- `bench/baseline/<machine>.json` exists for this machine and `npm run perf` reports no problems against it. If the
  baseline or its golden images are missing, stop and tell the owner: creating a baseline is a decision (it defines
  "the picture that must not change").

## One iteration

1. **Measure.** `npm run perf -- --costs`. Read `bench/last.json`: the score, the "over budget" list, each view's
   pixel share and knob costs. Exit code 2 (noise): wait a minute and run again, at most three times, then stop.
2. **Choose one target**: the pose furthest over budget. Read `bench/LOG.md` first and do not repeat a dropped
   experiment unless something it depended on has changed.
3. **Form one hypothesis** from the numbers, and say what it predicts (for example: "SSR costs 3.0 ms in nyc-night
   and the pixel share is 81 %, so tracing at 0.33 scale with the denoise carrying the upsample should save about
   1 ms with an image change under the noise floor"). If the cost table cannot explain the frame, add a knob that
   can, in the sample's harness, as its own iteration.
4. **Implement it small**: one change, as an engine option that defaults to off, then switched on in the tier presets
   (`src/core/Quality.js`) or the sample's tier overrides.
5. **Verify**, in this order, stopping at the first failure:
   - `npm test`
   - `npm run perf` (not `--costs`): the score is up by at least 0.5 and there are no problems
   - `npm run smoke`
6. **Keep or drop.**
   - Kept: `npm run perf -- --update --log="<what changed, the ms it saved, where>"`, then commit the change, the
     baseline and `LOG.md` together with a message that states the score before and after.
   - Dropped (slower, within noise, or a guard failed): revert the change (`git restore` the files you touched,
     nothing else), then `npm run perf -- --dropped="<what was tried and the measured reason it lost>"` and commit
     `LOG.md`.
7. **Report one line**: the score before and after, what was tried, kept or dropped.

## Rules the loop does not break

- It never edits what it is measured by: `bench/budgets.json`, the tolerances in `test/browser/perf.mjs`, the look
  limits in `test/browser/smoke.mjs`, a sample's bench poses, the pinned hashes in `test/`. If one of those looks
  wrong, it stops and says so.
- It never uses `--accept`. A slower frame or a changed picture is the owner's call.
- It does not remove or weaken a visual feature, lower a resolution, shorten a draw distance or drop a light to gain
  score unless the image guard shows the picture is unchanged. The mobile tier's look was chosen; it is not a place
  to cut either.
- It does not push, open pull requests, or touch `main`. It commits to its own branch only.
- One hypothesis per iteration. No refactors, no clean-ups, no unrelated fixes.

## When to stop

- Every pose is within budget, or
- three iterations in a row were dropped, or the last five kept changes moved the score by less than 1 in total
  (the remaining cost needs a design decision: report the cost table and the options instead of grinding), or
- a guard fails on a clean tree, a baseline is missing, or the machine stays noisy.

On stopping, write a short summary: the starting and final score, what was kept, what was dropped and why, and what
the cost table says is left.
