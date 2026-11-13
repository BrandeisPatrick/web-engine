# tools: data bakers

Parameterised Node CLIs (Node >= 18, no npm deps except `compress-textures.mjs`) that produce the world data contracts MapWorld loads
(see [ENGINE.md, "World"](../ENGINE.md#world), "Data contracts"). Every tool takes `--help`, `--dry-run` (prints the plan, makes no requests and
writes nothing), `--refresh` (ignore caches), `--out`, `--cache` and `--config <file.json>` (same keys as the flags;
flags win). The defaults are the San Francisco bake of Roadster, the game the engine was extracted from (that repository
is retired: pass explicit `--lat` / `--lon` and paths for a new bake, as in the NYC example below); each tool also
exports an async function with the same options in camelCase, for a game's own scripts to call.

| Tool | Output | Main flags (defaults) | Function |
|---|---|---|---|
| `bake-map.mjs` | city.json from OpenStreetMap (Overpass, OSM API fallback) | `--lat 37.792 --lon -122.3965 --size 2200 --outer 9000 --bridge-ext 3200,2200 --ua ...` | `bakeMap(opts)` |
| `bake-terrain.mjs` | terrain.json from AWS Terrarium tiles (OpenTopoData fallback) | `--city public/map/city.json [--lat --lon --outer] --fine -2600,-2900,3500,2500 --fine-cell 10 --fine-zoom 15 --outer-cell 40 --outer-zoom 13 --bay-min -2 --checks file.json` | `bakeTerrain(opts)` |
| `bake-farland.mjs` | farland.json (distant relief ring) | `--city ... [--lat --lon] --half 24000 --cell 250 --zoom 11 --sea -5` | `bakeFarland(opts)` |
| `fetch-textures.mjs` | PBR texture sets + manifest.json + CREDITS.md | `--sets textures.default.json --out public/textures --res 1k [--ktx2]` | `fetchTextures(opts)` |
| `compress-textures.mjs` | `<id>/*.ktx2` (Basis Universal: ETC1S albedo / rough / AO, UASTC + Zstd normals, mips, Y-flipped) + manifest `ktx2Maps`; copies three's Basis transcoder | `--dir public/textures --sets a,b --quality 160 --effort 2 --uastc-level 2 --rdo 0 --uastc id/map --etc1s map --jobs 8 --basis public/basis --basis-only --force` (Node >= 20.6; npm: `ktx2-encoder`, `jpeg-js`, `ktx-parse`) | `compressTextures(opts)`, `copyTranscoder(dest)` |
| `fetch-models.mjs` | the CC0 RobotExpressive.glb (three.js r180 examples) + CREDITS.md. Its default `--out` is the removed character sample's folder (historical): pass `--out` | `--out <dir> [--refresh] [--dry-run]` | `fetchModels(opts)` |

```bash
node tools/bake-map.mjs --lat 40.7128 --lon -74.006 --size 1500 --bridge-ext 0,0 --out maps/nyc/city.json --dry-run
node tools/bake-terrain.mjs --city maps/nyc/city.json --fine -1600,-1600,1600,1600 --out maps/nyc/terrain.json
```
`cli.mjs` holds the shared flag parser / usage printer.

The `public/textures` and `public/basis` defaults of `fetch-textures.mjs` and `compress-textures.mjs` are the retired
Roadster game's layout; in this repository the texture sets live per demo (for example `samples/public/nyc/textures/`,
`samples/public/miami/textures/`, with the transcoder in `samples/public/miami/basis/`), so pass `--out` / `--dir` /
`--basis` explicitly. `fetch-models.mjs`'s default `--out` is likewise historical.

## Asset catalogue (repository only)

`catalog-assets.mjs` writes the asset catalogue (`samples/public/catalog/catalog.json` and `docs/ASSETS.md`) from
`asset-registry.mjs` (the hand-kept list of assets made in code and of files no manifest describes), the texture
manifests, the `CREDITS.md` files and `asset-measurements.json`; `--check` writes nothing and fails when either output is
stale or a check fails (`test/asset-catalog.mjs` runs the same build). `render-asset-thumbs.mjs` renders one 480 x 320
JPEG per entry in headless Chrome by running the entry's code snippet (`samples/dev/asset-thumbs.html`, the runtime in
`samples/assets/runtime.js`), records triangles and animation names in `asset-measurements.json`, then rebuilds the
catalogue: `--only=<id,...>`, `--category=<name>`, `--missing`. These read the samples, so they are of no use from the
npm package.
