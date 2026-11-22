# lab/: the experimental track

Experiments that live beside the engine and never affect it. Nothing here is part of the engine: it is not in the npm
package (`files` in package.json), not in `npm run build` or the deployed site (vite.config.js builds `samples/`), and
not in `npm test` or `npm run check`. Nothing in `lab/` is covered by the engine's API promises: pages and scripts
here may break, change or disappear without notice.

## Run it

```sh
npm run lab                         # dev server at http://localhost:5192 (the repo root: /lab/..., /samples/...)
node lab/webgpu/bench.mjs           # the WebGPU experiment in headless Chrome, one table (see the file's header)
```

## Experiments

| Folder | Question |
|---|---|
| `webgpu/` | Is three.js's `WebGPURenderer` faster than the classic `WebGLRenderer` on our city? Open `/lab/webgpu/?r=gl`, `?r=gpu`, `?r=gpu-gl` (one renderer per load); the results show on the page with a Copy button. |

## Rules

- An experiment imports the engine (`@vibe/engine`) and the samples like any game; it never changes `src/`. A hook it
  would need in `src/` is written down in its notes, not added.
- An experiment moves to production only when it beats production on our own measurements (the same scene, poses and
  size, repeated runs) and then passes the full check (`npm run check:full`) as production code.
- Every experiment writes down what it measured and what it could not do, whichever way the result points.
