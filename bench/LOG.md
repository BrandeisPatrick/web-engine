# Performance log

One row per change that was measured with `npm run perf`: kept (the baseline moved), accepted (a regression or an image change taken on purpose) or dropped (tried, measured, reverted). Newest last.

| date | commit | machine | score | Δ | change | verdict |
|---|---|---|---|---|---|---|
| 2026-11-12 | 3f2c6f1 | apple-m4 | 132.9 |  | First baseline: main after 1.1.0-beta.1 (3f2c6f1) | kept |
| 2026-11-12 | 7a0c720 | apple-m4 | 136.3 | +4.3 | Miami dune road: each ground zone's samples and noise run only where its weight is non-zero (explicit gradients on the branched reads); chase -2.0 ms, car -1.5 ms, mobile chase / car -0.5 ms. City views re-recorded together (Halloween rows unchanged) | kept |
| 2026-11-12 | efc7ea7 | apple-m4 | 137 | +0.9 | SSR denoise: where the centre and all eight taps are 0 the blur writes 0 without the depth / normal reads (bit-identical); 0.2-0.4 ms on the NYC desktop poses, 0.1-0.4 ms on Miami | kept |
| 2026-11-12 | efc7ea7 |  |  |  | SSR denoise guide: a packed RGBA16F normal / depth / roughness target at the SSR size, read by the blur instead of the full-resolution G-buffer. 0.05-0.11 ms SLOWER than the zero skip alone on 6 of 7 desktop poses (in-page A/B): the extra pass and its scattered full-resolution reads cost more than the blur saved once the zero skip was in. Removed | dropped |
