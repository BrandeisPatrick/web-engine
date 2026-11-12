# Night NYC walk: asset credits

Everything here is used by `samples/nyc-night/`. Signage, window light, the LUT, the city-light environment and
the steam sprites are generated in code (no files), and so are the shop fronts, lobbies, window frames, AC units
and tower crowns (groundfloors.js, windowkit.js, crowns.js). Every sign, brand and show name is invented.

## Map data
| File | Source | Licence | Bytes |
|---|---|---|---|
| `map/city.json` | © OpenStreetMap contributors, baked by `tools/bake-map.mjs --lat 40.7565 --lon -73.9865 --size 1500 --outer 4000 --bridge-ext 0,0` from the Overpass API (2026-11-11) | ODbL 1.0 (<https://www.openstreetmap.org/copyright>) | 648,777 |

## Characters (walker and pedestrians)
| File | Author | Licence | Source | Bytes |
|---|---|---|---|---|
| `models/BusinessMan.glb` ("Business Man") | Quaternius | CC0 1.0 | <https://poly.pizza/m/JFrLIKqvCH> | 1,529,248 |
| `models/ManInSuit.glb` ("Man in Suit") | Quaternius | CC0 1.0 | <https://poly.pizza/m/mQnGoME1ez> | 583,416 |
| `models/Woman.glb` ("Animated Woman") | Quaternius | CC0 1.0 | <https://poly.pizza/m/9kF7eTDbhO> | 1,379,768 |

## HDRI panoramas (Poly Haven, CC0 1.0), `env/`
Downloaded at 1K (`.hdr`, from <https://api.polyhaven.com/files/<id>>), tone-mapped offline (ACES, sRGB) to
equirect JPEGs by a Node script; the HDR files are not committed. Shop interiors: 512 x 256, exposure 1.2. Night
environment (glass, cars, damp street): 1024 x 512, exposure 0.35. Source page: `https://polyhaven.com/a/<id>`.

| File | Poly Haven id | Author(s) | Bytes |
|---|---|---|---|
| `env/comfy_cafe.jpg` | comfy_cafe | Sergej Majboroda | 36,464 |
| `env/decor_shop.jpg` | decor_shop | Sergej Majboroda | 45,766 |
| `env/gear_store.jpg` | gear_store | Dimitrios Savva, Jarod Guest | 36,986 |
| `env/warm_bar.jpg` | warm_bar | Greg Zaal, Jarod Guest | 54,756 |
| `env/warm_restaurant_night.jpg` | warm_restaurant_night | Greg Zaal, Jarod Guest | 53,457 |
| `env/cinema_lobby.jpg` | cinema_lobby | Sergej Majboroda | 44,534 |
| `env/modern_buildings_night.jpg` | modern_buildings_night | Greg Zaal | 126,699 |

## PBR texture sets (Poly Haven, CC0 1.0)
Downloaded at 1K by `tools/fetch-textures.mjs --sets samples/nyc-night/texture-sets.json` (the wall sets on 2026-11-11
for the buildings pass, generic User-Agent), then re-encoded with macOS `sips`: `textures/` = 1024 px JPEG (quality 68,
normals 78; desktop tier), `textures-512/` = 512 px JPEG (ground sets: quality 70, normals 80; the wall sets: quality
64, normals 74, rough / AO 60, so the mobile tier downloads less than before; mobile has no `stucco_b` set: that layer
stays procedural there). Each set: `diff.jpg`, `nor_gl.jpg`, `rough.jpg`, `ao.jpg`. The page sets
`TextureSets.configure({ manifestIds: true })`, so each role reads its folder from the manifest `id`. Licence: CC0 1.0
(<https://creativecommons.org/publicdomain/zero/1.0/>). Source page: `https://polyhaven.com/a/<id>`.

| Role | Poly Haven id | Author(s) | Real size | Bytes (1K) | Bytes (512) |
|---|---|---|---|---|---|
| brick_red | brick_wall_006 | Jan Burghardt | 3 m | 1,286,259 | 382,876 |
| brick_painted | painted_worn_brick | Dimitrios Savva | 1.8 m | 1,218,958 | 277,138 |
| brick_dark | brick_wall_10 | Dimitrios Savva | 1.9 m | 910,505 | 241,093 |
| concrete_panel (limestone ashlar) | sandstone_blocks_08 | Rob Tuytel | 3 m | 424,960 | 74,725 |
| concrete_rough (ribbed precast panels) | concrete_panels | Amal Kumar | 8 m | 799,673 | 202,104 |
| stucco_a | beige_wall_002 | Dimitrios Savva, Rico Cilliers | 3 m | 221,078 | 71,266 |
| stucco_b (white glazed brick; desktop only) | whitewashed_brick | Charlotte Baglioni | 2 m | 969,236 | - |
| granite (weathered stone blocks, bases) | stone_block_wall | Amal Kumar | 2.1 m | 1,057,885 | 228,259 |
| metal_corrugated | corrugated_iron | Jenelle van Heerden, Dimitrios Savva | 1.12 m | 684,668 | 195,009 |
| roof_tar | bitumen | Rob Tuytel | 20 m | 398,209 | 106,350 |
| grass | leafy_grass | Charlotte Baglioni | 2 m | 1,795,271 | 456,411 |
| asphalt_a | asphalt_02 | Rob Tuytel | | 2,420,918 | 457,970 |
| asphalt_b | clean_asphalt | Dimitrios Savva | | 1,027,682 | 202,273 |
| sidewalk | concrete_pavement | Charlotte Baglioni | | 1,343,954 | 304,118 |

Replaced in the buildings pass (no longer shipped): red_bricks_04, brick_wall_08, concrete_wall_004, concrete_wall_008,
granite_tile_03 (whitewashed_brick moved from brick_painted to stucco_b).
Totals: 1K sets 14.3 MB, 512 sets 3.2 MB, map 0.65 MB, people 3.5 MB, HDRI panoramas 0.4 MB.
The desktop tier downloads about 21.9 MB, the mobile tier about 8.9 MB (bench/budgets.json: perf.mjs assets).

## Street kit (Poly Haven CC0 1.0 models), `street/`
Baked by `samples/nyc-night/tools/bake-street.mjs` from the 1k glTF downloads (`https://api.polyhaven.com/files/<id>`,
fetched 2026-11-11; the downloads are not committed): each prop's nodes merged and simplified with meshoptimizer
(LOD0 500-2,400 triangles, LOD1 about a fifth), UVs remapped into one texture atlas; the atlas also holds procedural
insets drawn by the script (manhole covers, road plate, grates, vault doors, hatches, tree-pit grate, cobbles, soil,
litter) and crops of the repo's `granite_tile_03`, `clean_asphalt` and `concrete_pavement` sets (credited above).
Source page: `https://polyhaven.com/a/<id>`. Licence of every model: CC0 1.0.

| Used as | Poly Haven id | Author(s) | Source bytes (glTF + bin + 1k maps downloaded) |
|---|---|---|---|
| hydrant (both finishes) | fire_hydrant | Gonçalo Felício | 5,521,480 |
| trash can (clean, rusty) | metal_trash_can | GurJas Studios | 4,994,983 |
| garbage bag (black, clear) | trashbag | Benny Weimer | 1,699,464 |
| cardboard box | cardboard_box_01 | Rahul Chaudhary | 2,168,437 |
| Jersey barrier | concrete_road_barrier_02 | Amal Kumar | 2,928,100 |
| signal controller box | utility_box_01 | James Ray Cock | 1,977,061 |
| milk crate | plastic_crate_02 | Fabi_G | 1,838,779 |
| scanned manhole cover | water_manhole_cover | Raunox | 2,333,492 |

| File | Tier | Bytes |
|---|---|---|
| `street/street.gltf` + `street/street.bin` (21 meshes, 18.8k triangles) | both | 18,419 + 675,112 |
| `street/atlas_diff.jpg`, `atlas_nor.jpg`, `atlas_arm.jpg` (2048 px) | desktop | 674,481 + 1,081,296 + 535,197 |
| `street/atlas512/atlas_{diff,nor,arm}.jpg` (1024 px) | mobile | 186,923 + 274,119 + 159,915 |

The street kit adds 2.98 MB to the desktop download and 1.31 MB to the mobile one.
