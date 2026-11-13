# Performance log

One row per change that was measured with `npm run perf`: kept (the baseline moved), accepted (a regression or an image change taken on purpose) or dropped (tried, measured, reverted). Newest last.

| date | commit | machine | score | Δ | change | verdict |
|---|---|---|---|---|---|---|
| 2026-11-12 | 3f2c6f1 | apple-m4 | 132.9 |  | First baseline: main after 1.1.0-beta.1 (3f2c6f1) | kept |
| 2026-11-12 | 7a0c720 | apple-m4 | 136.3 | +4.3 | Miami dune road: each ground zone's samples and noise run only where its weight is non-zero (explicit gradients on the branched reads); chase -2.0 ms, car -1.5 ms, mobile chase / car -0.5 ms. City views re-recorded together (Halloween rows unchanged) | kept |
