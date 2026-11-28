# Atlanta: data credits

Everything under `samples/public/atlanta/` that came from outside this repository. So far this folder holds data only
(the map and the landmark descriptors); no textures, models or sounds.

## Map data

| File | Source | Licence | Bytes |
|---|---|---|---|
| `map/city.json` (Downtown Atlanta and SoNo: a 2.8 km square centred on 33.7606, -84.3905, from 3rd Street and the Fox Theatre in the north to the State Capitol and City Hall in the south, from Mercedes-Benz Stadium in the west to the Downtown Connector in the east; baked with `tools/bake-map.mjs --lat 33.7606 --lon -84.3905 --size 2800 --outer 9000 --bridge-ext 0,0 --keep-outlines 0.6` from the Overpass API (the `maps.mail.ru` mirror, OSM data of 2026-11-28, generic User-Agent)) | © OpenStreetMap contributors, <https://www.openstreetmap.org/copyright> | ODbL 1.0 (attribution required: "© OpenStreetMap contributors") | 961,677 |

Atlanta has no coastline, so `land` is empty (the engine reads that as "all land"). No `terrain.json` or `farland.json`
was baked: the NYC and Miami demos run on flat ground (`terrain: false`) and this bake follows them. The real ground is
not flat: Terrarium elevation tiles give 279 to 331 m over the square, with Peachtree Street on a ridge at about
320 to 328 m and the Downtown Connector 20 to 35 m lower.

## Landmark descriptors

| File | Source | Licence | Bytes |
|---|---|---|---|
| `map/landmarks.json` (129 buildings: 30 iconic ones with facts read from the pages below, 99 further named buildings with a lighter, mostly deduced descriptor) | Written for this repository. `match` (name, OSM id, a point in the footprint) and some heights, levels, materials and colours come from OpenStreetMap tags; heights, floor counts, years, architects, styles and the quoted phrases come from English Wikipedia; every entry lists its pages in `sources` and names in `notes` ("deduced: ...") the fields that were not read from a source but estimated | OpenStreetMap: ODbL 1.0, © OpenStreetMap contributors. Wikipedia text: CC BY-SA 4.0, <https://creativecommons.org/licenses/by-sa/4.0/> (short quotations in `notes` are marked with quotation marks) | 142,979 |

`night.sign.text` records what the sign on the real building says (WESTIN, Coca-Cola, FOX and so on): a fact about the
building. No logo artwork is included.

Wikipedia articles read on 2026-11-28 (`https://en.wikipedia.org/wiki/<title>`):

- List of tallest buildings in Atlanta (heights, floors and years of 41 buildings)
- Towers: Bank of America Plaza (Atlanta), Truist Plaza, 191 Peachtree Tower, Westin Peachtree Plaza Hotel,
  Georgia-Pacific Tower, Tower Square (Atlanta), State of Georgia Building, Atlanta Marriott Marquis,
  101 Marietta Street, Equitable Building (Atlanta), Hyatt Regency Atlanta, Peachtree Center, Peachtree Summit,
  Georgia Power Company Corporate Headquarters, Sam Nunn Atlanta Federal Center, Richard B. Russell Federal Building,
  One Park Tower (Atlanta), 25 Park Place, 55 Marietta Street, TWELVE Centennial Park, AmericasMart,
  The Coca-Cola Company (for One Coca-Cola Plaza)
- Historic buildings: Georgia State Capitol, Atlanta City Hall, Flatiron Building (Atlanta),
  Candler Building (Atlanta), Healey Building, Hurt Building, Rhodes–Haverty Building, William–Oliver Building,
  The Metropolitan (Atlanta condominium building), Olympia Building, Carnegie Building (Atlanta),
  Winecoff Hotel fire, Fox Theatre (Atlanta), Georgian Terrace Hotel, Underground Atlanta,
  Fulton County Courthouse (Georgia), Elbert P. Tuttle United States Court of Appeals Building,
  Atlanta Central Library
- Venues: Mercedes-Benz Stadium, State Farm Arena, Georgia Aquarium, World of Coca-Cola, Centennial Olympic Park
  (for SkyView Atlanta), CNN Center, Georgia World Congress Center, College Football Hall of Fame,
  National Center for Civil and Human Rights, Bobby Dodd Stadium, The Varsity (restaurant)
- Churches and hospitals: Central Presbyterian Church (Atlanta), Big Bethel AME Church,
  First Congregational Church (Atlanta), Basilica of the Sacred Heart of Jesus (Atlanta),
  North Avenue Presbyterian Church, All Saints' Episcopal Church (Atlanta), Grady Memorial Hospital,
  Emory University Hospital Midtown
