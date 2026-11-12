# Miami drive: data and asset credits

Everything under `samples/public/miami/` that came from outside this repository. The hero car, the neon signage, the
lifeguard huts, the buildings (`buildings.js`, on the engine's facade material and the Poly Haven sets below), the
coconut palms, the props, the plate, the colour grade (LUT) and every sound are generated in code
(`samples/miami-drive/`) and have no external source.

## Map data

| File | Source | Licence | Bytes |
|---|---|---|---|
| `map/city.json` (South Beach, Miami Beach: a 2.6 km square centred on 25.7785, -80.1365, with the east end of the MacArthur Causeway; baked with `tools/bake-map.mjs --lat 25.7785 --lon -80.1365 --size 2600 --bridge-ext 0,0` from the Overpass API on 2026-11-11) | © OpenStreetMap contributors, <https://www.openstreetmap.org/copyright> | ODbL 1.0 (attribution required: "© OpenStreetMap contributors") | 471,728 |

## Textures (Poly Haven, CC0 1.0)

Fetched with `tools/fetch-textures.mjs --res 1k` into `textures/` (diffuse, OpenGL normal, roughness and AO JPGs per
set; `textures/manifest.json`, `textures/CREDITS.md`). CC0 1.0 Universal (public domain), no attribution required.
The phone tier reads `textures-lite/manifest.json` (no sets: procedural layers) and downloads only the sand.

| Set | Authors | Licence | Source | Bytes |
|---|---|---|---|---|
| Concrete Wall 004 (`concrete_wall_004/`) | Dario Barresi, Charlotte Baglioni | CC0 1.0 | https://polyhaven.com/a/concrete_wall_004 | 2,661,541 |
| Beige Wall 002 (`beige_wall_002/`) | Dimitrios Savva, Rico Cilliers | CC0 1.0 | https://polyhaven.com/a/beige_wall_002 | 186,747 |
| White Stucco (`white_stucco/`) | Amal Kumar | CC0 1.0 | https://polyhaven.com/a/white_stucco | 2,314,644 |
| Bitumen (`bitumen/`) | Rob Tuytel | CC0 1.0 | https://polyhaven.com/a/bitumen | 1,617,380 |
| Asphalt 02 (`asphalt_02/`) | Rob Tuytel | CC0 1.0 | https://polyhaven.com/a/asphalt_02 | 3,049,197 |
| Concrete Pavement (`concrete_pavement/`) | Charlotte Baglioni | CC0 1.0 | https://polyhaven.com/a/concrete_pavement | 3,453,308 |
| Leafy Grass (`leafy_grass/`) | Charlotte Baglioni | CC0 1.0 | https://polyhaven.com/a/leafy_grass | 4,229,130 |
| Coast Sand 01 (`coast_sand_01/`) | Rob Tuytel | CC0 1.0 | https://polyhaven.com/a/coast_sand_01 | 3,192,911 |

## Hero car (desktop tier): Car Concept (Khronos glTF Sample Assets, CC-BY 4.0)

**Credit (required by the licence):** "Car Concept" by Eric Chadwick, © 2024 Darmstadt Graphics Group GmbH, from the
Khronos glTF Sample Assets (https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), based on
a CC0 model by Unity Fan (https://sketchfab.com/3d-models/free-concept-car-004-public-domain-cc0-4cba124633eb494eadc3bb0c4660ad7e).
Licensed CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/). **Changes:** the Khronos and 3D Commerce logos
(trademarks, excluded from the licence) are removed: the logo image is replaced by a 4 x 4 black PNG, both marks are
painted out of the tyre sidewall colour and normal maps, and the steering-wheel badge mesh is hidden at load; four
PNG maps re-encoded as JPEG (AO at 1024 px); the transmission glass is replaced by a tinted glass and the paint
recoloured at load (`samples/miami-drive/car-glb.js`). The phone tier uses the generated sedan (`car-model.js`).

| File | Source file | Licence | Downloaded bytes | Committed bytes |
|---|---|---|---|---|
| `models/car-concept.glb` | `Models/CarConcept/glTF-Binary/CarConcept.glb` (raw.githubusercontent.com, main) | CC-BY 4.0 (logos excluded, removed) | 11,778,688 | 9,489,764 |

## Roadside scans (Poly Haven, CC0 1.0)

Downloaded at 1k from https://polyhaven.com (api.polyhaven.com file list), repacked into single GLBs (one mesh, its
textures embedded) by a script outside the repository; the rock is decimated (67 and ~1,000 triangles from 14,844),
the shrub to ~5,600 triangles, and the maps resampled (rock / shrub normals 256 px, grass maps 128-512 px, gravel
normal 512 px, roughness 256 px). CC0 1.0, no attribution required.

| File | Asset | Authors (Poly Haven) | Source | Downloaded bytes | Committed bytes |
|---|---|---|---|---|---|
| `roadside/coral_gravel_diff.jpg`, `_nor_gl.jpg`, `_rough.jpg` | Coral Gravel | Rob Tuytel | https://polyhaven.com/a/coral_gravel | 798,873 + 1,209,045 + 531,295 | 686,105 + 158,237 + 34,914 |
| `roadside/rock_07_lo.glb`, `rock_07_hi.glb` | Rock 07 | Jenelle van Heerden | https://polyhaven.com/a/rock_07 | 2,181,103 (gltf, bin, 3 maps) | 128,516 + 155,132 |
| `roadside/shrub_04.glb`, `shrub_04_mid.glb`, `shrub_04_lo.glb` (5,623 / 1,561 / 529 triangles, the scan's normals kept on the two LODs) | Shrub 04 | Rico Cilliers | https://polyhaven.com/a/shrub_04 | 1,907,514 (gltf, bin, 3 maps) + 1,594,051 (PNG diffuse, not used) | 312,376 + 168,100 + 121,200 |
| (not committed; evaluated in round 5 and dropped: it read as pale spikes) | Grass Bermuda 01 | Rico Cilliers | https://polyhaven.com/a/grass_bermuda_01 | 1,450,530 (gltf, bin, 3 maps) | 0 |

## Road and bank scans, 2k (Poly Haven, CC0 1.0) - round 5

`road/` holds two texture sets in the TextureSets layout (`road/manifest.json`), compressed to KTX2 by
`tools/compress-textures.mjs` (colour / roughness ETC1S, normals UASTC); the JPGs stay as the loader's fallback.
Desktop only. Diffuse at 2k, normal / roughness / displacement resampled to 1k.

| Folder | Asset | Author | Source | Downloaded bytes (2k JPG: diff, nor_gl, rough, disp) | Committed bytes (JPG + KTX2) |
|---|---|---|---|---|---|
| `road/asphalt_02_2k/` | Asphalt 02 (3 m) | Rob Tuytel | https://polyhaven.com/a/asphalt_02 | 3,075,676 + 4,943,950 + 2,230,457 + 1,131,595 (disp not used) | 4,029,912 + 2,281,712 |
| `road/coast_sand_rocks_02_2k/` | Coast Sand Rocks 02 (15 m) | Rob Tuytel | https://polyhaven.com/a/coast_sand_rocks_02 | 2,905,160 + 4,810,192 + 2,218,518 + 1,044,275 | 2,569,180 + 2,307,975 |

## KTX2 twins of the world texture sets and the Basis transcoder - round 5

`tools/compress-textures.mjs --dir samples/public/miami/textures --basis samples/public/miami/basis` wrote a `.ktx2`
next to each of the 32 JPGs in `textures/` (12,678,100 bytes; the JPGs stay as the fallback) and copied three.js's Basis
Universal transcoder to `basis/` (`basis_transcoder.js` 57,529 bytes, `basis_transcoder.wasm` 527,333 bytes; Basis
Universal, Apache-2.0, as shipped in three/examples/jsm/libs/basis). The page points TextureSets at
`${BASE_URL}miami/basis/`, so the deployed sub-path finds it.

## Removed this round

The round-3 sky photograph (`sky/dusk-sky.jpg` 420,695 bytes + JSON, from Poly Haven "Industrial Sunset (Pure Sky)",
CC0, Sergej Majboroda / Jarod Guest, https://polyhaven.com/a/industrial_sunset_puresky; its 16,409,672-byte HDR was
never committed) is no longer used: the dusk sky and its cumulus are procedural (`sky.js`).

Total committed for this demo: 55.8 MB (textures 20.7 MB JPG + 12.7 MB KTX2, road / bank 10.9 MB, car 9.5 MB, roadside
1.7 MB, transcoder 0.6 MB, map 0.47 MB). Downloaded by the desktop page: about 30 MB (KTX2 instead of the JPGs);
phones: the map, the sand and the gravel / rock scans (about 4 MB, no car file, no 2k sets).
KTX2 compression (`tools/compress-textures.mjs`) was not run: its encoder packages are not installed here; the JPGs
are the loader's fallback path.
