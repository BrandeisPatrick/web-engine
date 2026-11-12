# Credits: Midnight Candy Run assets

The ground scans in `ground/` are from **[Poly Haven](https://polyhaven.com)**, released under **CC0 1.0 Universal
(public domain)**: <https://creativecommons.org/publicdomain/zero/1.0/>. No attribution is required; it is given
here anyway. Each set is the 1K JPG albedo (`-diff.jpg`) and OpenGL normal map (`-nor.jpg`), re-encoded (JPEG
quality 82 / 85), plus a 512 px albedo for phones (`-diff-512.jpg`). Downloaded with `tools/fetch-textures.mjs`
(generic User-Agent) on 2026-11-11. Used by `samples/halloween/world.js` (loadGroundSets) and `looks.js`
(patchGround) for the remastered look; `?look=classic` does not load them.

| Use | Poly Haven asset | Author | Licence | Real size | Files (bytes) |
|---|---|---|---|---|---|
| grass | [Forest Ground 01](https://polyhaven.com/a/forrest_ground_01) (`forrest_ground_01`) | Rob Tuytel | CC0 1.0 | 2 x 2 m | diff 778780, nor 1473728, diff-512 142117 |
| leaf litter (graveyard, knoll, patch, hills) | [Forest Leaves 02](https://polyhaven.com/a/forest_leaves_02) (`forest_leaves_02`) | Rob Tuytel | CC0 1.0 | 3 x 3 m | diff 593680, nor 839406, diff-512 159152 |
| the lane's gravel, the creek's bed | [Rocky Trail](https://polyhaven.com/a/rocky_trail) (`rocky_trail`) | Amal Kumar | CC0 1.0 | 2 x 2 m | diff 531338, nor 797779, diff-512 133991 |

Total: 5,449,971 bytes (desktop loads the 1K albedo + normal of each set, 5.0 MB; phones the three 512 px albedos,
435 KB).

The material scans in `props/` (round 2 of the remaster: the merged props mesh picks one per part, looks.js
patchSurfaces) are from Poly Haven too, CC0 1.0, same encoding (JPEG quality 78 albedo / 80 normal / 76 for the
512 px albedo), downloaded the same way on 2026-11-11:

| Use | Poly Haven asset | Author | Licence | Real size | Files (bytes) |
|---|---|---|---|---|---|
| boards (cottage and house walls, trim, porches, fences, signpost) | [Green Rough Planks](https://polyhaven.com/a/green_rough_planks) (`green_rough_planks`) | Rob Tuytel | CC0 1.0 | 1.5 x 1.5 m | diff 458770, nor 535876, diff-512 99530 |
| slate roofs | [Roof Slates 02](https://polyhaven.com/a/roof_slates_02) (`roof_slates_02`) | Rob Tuytel | CC0 1.0 | 3 x 3 m | diff 440136, nor 715510, diff-512 111002 |
| masonry (footings, chimneys, the crypt, the well, gate posts) | [Old Stone Wall](https://polyhaven.com/a/old_stone_wall) (`old_stone_wall`) | Charlotte Baglioni | CC0 1.0 | 2 x 2 m | diff 408117, nor 560099, diff-512 102423 |
| lichened stone (gravestones, standing stones, bank walls, path stones) | [Lichen Rock](https://polyhaven.com/a/lichen_rock) (`lichen_rock`) | Rico Cilliers | CC0 1.0 | 2 x 2 m | diff 516821, nor 611207, diff-512 137596 |
| bark (the dead trees, the hollow oak) | [Bark Brown 02](https://polyhaven.com/a/bark_brown_02) (`bark_brown_02`) | Rob Tuytel | CC0 1.0 | 1 x 1 m | diff 574760, nor 964885, diff-512 129543 |

Total: 6,366,275 bytes (desktop loads 5,786,181; phones 580,094).

Everything else in the game (the moon, the tree line, the window interiors, the grain) is procedural, made at load.
