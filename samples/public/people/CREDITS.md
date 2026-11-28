# People: asset credits

Rigged, textured, animated adults for the samples (`samples/starter-walk/`, the pedestrians of `samples/nyc-night/`).

| | |
|---|---|
| Source | Microsoft Rocketbox Avatar Library, <https://github.com/microsoft/Microsoft-Rocketbox> (archived; its LICENSE.md, and the README: "12/2020: Updated license to MIT") |
| Author | Rocketbox (the original avatar creation team), Microsoft Research and the contributors named in the library's README |
| Licence | MIT License, Copyright (c) 2020 Microsoft. The full text is in [LICENSE-Rocketbox.md](LICENSE-Rocketbox.md) and must stay with the files; each GLB also names it in `asset.copyright` |
| Changes | Converted and reduced by `tools/bake-people.mjs`: metres, feet at y = 0, the body skeleton only (facial bones folded into the head), body and head textures on one 1536 x 1024 JPEG atlas, hair cards on a 512 px PNG, quantised vertices, a cloth / occlusion vertex attribute, three clips with the travel taken out |

| File | Avatar | Triangles | Bytes |
|---|---|---|---|
| `man-grey-jacket.glb` | `Assets/Avatars/Adults/Male_Adult_07` (grey jacket, jeans) | 7,588 | 615,956 |
| `man-blazer.glb` | `Assets/Avatars/Adults/Male_Adult_03` (older, grey blazer, dark trousers) | 7,200 | 816,824 |
| `man-hooded-jacket.glb` | `Assets/Avatars/Adults/Male_Adult_04` (dark hooded jacket, khaki trousers) | 8,684 | 707,956 |
| `man-denim-jacket.glb` | `Assets/Avatars/Adults/Male_Adult_12` (denim jacket, light jeans) | 6,722 | 571,968 |
| `woman-leather-jacket.glb` | `Assets/Avatars/Adults/Female_Adult_04` (brown leather jacket, khaki trousers, boots) | 9,284 | 724,476 |
| `woman-dark-jacket.glb` | `Assets/Avatars/Adults/Female_Adult_07` (dark jacket, jeans, boots) | 8,308 | 670,064 |
| `woman-blazer.glb` | `Assets/Avatars/Adults/Female_Adult_09` (beige blazer, black trousers) | 9,032 | 727,052 |
| `woman-beige-jacket.glb` | `Assets/Avatars/Adults/Female_Adult_14` (beige jacket, dark jeans, boots) | 8,724 | 823,696 |

Clips in every file (the `m_` set for men, `f_` for women): `Idle` = `Assets/Animations/all_animations_max_motextr_static/{m,f}_idle_neutral_01.max.fbx`, `Walk` = `Assets/Animations/all_animations_max_motextr_xy/{m,f}_walk_neutral_02.max.fbx`, `Run` = `Assets/Animations/all_animations_max_motextr_xy/{m,f}_run_fast_01.max.fbx`.

To add a person: a row in `PEOPLE` of `tools/bake-people.mjs`, `node tools/bake-people.mjs --src <library> --fetch --only <id>`,
then this table and `tools/asset-registry.mjs`. Cite the library's paper when you use the avatars in research:
Gonzalez-Franco et al., "The Rocketbox library and the utility of freely available rigged avatars", Frontiers in
Virtual Reality, 2020, doi:10.3389/frvir.2020.561558.
