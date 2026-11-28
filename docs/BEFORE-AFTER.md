# Before and after

What changed on screen in 1.1.0-beta.1, in 1.1.0, in 1.2.0, in 1.3.0 and since (the first section, which says how its
pictures were taken). Every other image is a capture of the samples in this repository, taken in Chrome on
an Apple M4 (the desktop quality tier unless noted). "Before" is the first working pass of each demo or the engine's
earlier output; "after" is this release. The city demos' camera poses moved between the two, so the pairs show the
same place and subject rather than the same pixel.

The work was held to a reference standard for tone (a low-key dusk frame: dark, nothing clipped, one warm hue family),
which became a gate in `npm run smoke`, and then to asset detail: materials, construction and objects that hold up
close. On 2026-11-17 the brighter open look became the demos' default (next section) and the gate now holds that
look. `CHANGELOG.md` has the full list.

## Unreleased: the balance pass, new people, and Atlanta from data

These pictures were not taken on the Apple M4: they are software-rendered (headless Chrome on SwiftShader, 1280 x
720, desktop tier), each pair the same bench pose from the code before and after. The pixels are what a GPU draws; no
frame time was measured for them.

The method was to measure what each effect adds to the frame before moving anything (`docs/DESIGN-NOTES.md`,
"Graphics balance"): in the night city, reflections changed the frame by under half a level of 255 and bloom by a
tenth, because nothing on the street was bright enough to reflect or to glow, and a haze lay over everything past 50 m.

### Night NYC: the lights carry the picture

Signs, lit windows and lamp pools brighter, bloom that reaches them, half the haze, a firmer curve, a wet film whose
gloss varies, a drizzle that shows in lamp light, and no volumetric pass.

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/balance-nyc-drive-before.jpg" alt="Night NYC behind the car, before: a grey, evenly damp road and dim signs"></td><td><img src="before-after/balance-nyc-drive-after.jpg" alt="Night NYC behind the car, after: glowing signs, lamp light and brake lights in a patchy wet road"></td></tr></table>

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/balance-nyc-square-before.jpg" alt="The square, before"></td><td><img src="before-after/balance-nyc-square-after.jpg" alt="The square, after: screens light the trees and show in the road"></td></tr></table>

### Miami drive: colour and depth

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/balance-miami-chase-before.jpg" alt="Miami dune road, before: one mauve band"></td><td><img src="before-after/balance-miami-chase-after.jpg" alt="Miami dune road, after: green palms against an orange sky, deeper darks"></td></tr></table>

### The driving starter: natural daylight, aimed at the sun

The engine's default daylight now has a clear sky's ratio of sun to sky (a shadow on level ground measures 23 % of the
sunlit ground at noon, was 35 %; 41 % at golden hour, was 62 %), and the starter's road heads toward its low sun.

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/balance-starter-drive-before.jpg" alt="Driving starter, before: flat light, a black road, a hazy horizon"></td><td><img src="before-after/balance-starter-drive-after.jpg" alt="Driving starter, after: the low sun ahead, glare on the asphalt, long shadows, backlit trees"></td></tr></table>

### People

Eight clothed, textured adults (Microsoft Rocketbox, MIT) replace the low-poly figures; each picture is before (left)
and after (right).

<img src="before-after/people-group-before-after.jpg" alt="A group under a park lamp: low-poly figures on the left, clothed adults on the right" width="960">

<img src="before-after/people-nyc-before-after.jpg" alt="Pedestrians at a Night NYC crossing, before and after" width="960">

### Atlanta, built from data

The same baked footprints as extruded boxes, and with the 129 descriptors of `landmarks.json` (test page, flat ground):

<table><tr><th>Footprints only</th><th>Described</th></tr><tr><td><img src="before-after/atlanta-footprints.jpg" alt="Atlanta skyline from footprints only: plain boxes"></td><td><img src="before-after/atlanta-described.jpg" alt="Atlanta skyline described: granite towers with pyramid crowns, a glass tower with a sign, the stadium"></td></tr></table>

The demo (`samples/atlanta-drive/`):

<img src="before-after/atlanta-skyline.jpg" alt="Atlanta from the air: Bank of America Plaza on the left, downtown on the right, tree-lined streets" width="960">

<table><tr><td><img src="before-after/atlanta-drive.jpg" alt="Driving south on Peachtree Street toward the low sun"></td><td><img src="before-after/atlanta-westin.jpg" alt="The Westin's cylinder from Centennial Olympic Park Drive"></td></tr><tr><td colspan="2"><img src="before-after/atlanta-capitol.jpg" alt="The Georgia State Capitol's gold dome above the trees" width="640"></td></tr></table>

## 1.3.0: a smaller internal picture stops shimmering

When frames run long, the desktop tier now draws the 3D scene at 87 % and then 75 % of its size and rebuilds a
full-size picture over a few frames. Before this release a still view drawn that way shimmered more than at full size:
tree and building edges, thin lines and the wet road's reflections flashed from frame to frame. The upscaling step now
weighs each smaller frame by how many samples it really carries, so a still view at 75 % flickers no more than at full
size. The sheet below shows where nyc-night's three bench views flicker while standing still at 75 % size, before
(left) and after (right); bright means flicker. At full size nothing changed.

<img src="before-after/flicker-at-75-percent.jpg" alt="Flicker maps of three Night NYC views at 75 % internal size: bright flickering edges on trees, towers and wet road before (left), much less after (right)" width="960">

## 1.2.0: far glass towers stop flickering

The glass towers' window frames have rounded faces that reflect the city. Seen down the street, a frame is thinner
than a pixel, and each small camera move picked a different face, so the tower flashed while walking and drew a wavy
pattern standing still. The faces now flatten once a frame is under about a pixel and a half wide. The pair below is
nyc-night's square pose on the mobile tier (no TAA there, so the pattern shows in a still frame), cropped from 1280 x
720: 1.1.0 on the left, 1.2.0 on the right.

<img src="before-after/nyc-tower-flicker.jpg" alt="Night NYC square on the mobile tier: the far glass tower with a wavy pattern in 1.1.0 (left), and without it in 1.2.0 (right)" width="960">

## 1.1.0: the open look is the default

On 2026-11-17 the owner compared the two looks side by side and made the brighter, two-temperature open look the
default in nyc-night and miami-drive. The low-key look is still there with `?look=low`. Each sheet shows every bench
pose at 1280 x 720 on the desktop tier: on the left the low-key look, on the right the open look. The labels are the
ones from the comparison, made before the switch.

<img src="before-after/nyc-night-looks.jpg" alt="Night NYC, every bench pose: the low-key look on the left, the open look on the right" width="960">

<img src="before-after/miami-drive-looks.jpg" alt="Miami drive, every bench pose: the low-key look on the left, the open look on the right" width="960">

## 1.1.0: the look pass and the fix pass

The round after 1.1.0-beta.1 (see `CHANGELOG.md`, 1.1.0). "Before" is `main` before the round, "this round" is
the low-key look that was the default then (now `?look=low`), each captured in the same bench pose at 1280 x 720 on
the desktop tier. It stayed inside the smoke test's look gate of the time (low key: a dark mean, nothing clipped, one
warm hue family). The round also added the open look, a brighter two-temperature grade of the same scene (more
exposure, cool shade against warm lamps, a small lifted black), the default since the section above: one example
per demo below.

### Night NYC

Lamps as shielded downward spots (round pools, the pole left dark), glass that reflects the street, lit and dim
rooms, lit street trees, weathered street kit, shop interiors with a counter and pendant lamps.

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/nyc-avenue-look-before.jpg" alt="Before (main)"></td><td><img src="before-after/nyc-avenue-look-after.jpg" alt="This round"></td></tr></table>

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/nyc-kerb-look-before.jpg" alt="Before (main)"></td><td><img src="before-after/nyc-kerb-look-after.jpg" alt="This round"></td></tr></table>

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/nyc-shop-look-before.jpg" alt="Before (main)"></td><td><img src="before-after/nyc-shop-look-after.jpg" alt="This round"></td></tr></table>

The open look (`?look=open` then, the default now):

<img src="before-after/nyc-avenue-look-open.jpg" alt="Night NYC, the avenue in the open look" width="720">

### Miami drive

A soft lit cloud deck, the afterglow as the key light, lit foliage, aged stucco with dirt runs, lifeguard huts with
form and aged paint, the neon tubes off by default (`?neon=1`).

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/miami-chase-look-before.jpg" alt="Before (main)"></td><td><img src="before-after/miami-chase-look-after.jpg" alt="This round"></td></tr></table>

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/miami-strip-look-before.jpg" alt="Before (main)"></td><td><img src="before-after/miami-strip-look-after.jpg" alt="This round"></td></tr></table>

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/miami-beach-look-before.jpg" alt="Before (main)"></td><td><img src="before-after/miami-beach-look-after.jpg" alt="This round"></td></tr></table>

The open look (`?look=open` then, the default now):

<img src="before-after/miami-chase-look-open.jpg" alt="Miami drive, the chase view in the open look" width="720">

### Starters

`starter-walk` is set in a park corner (`parkCorner`, `groundCover`) and `starter-drive` on a country road
(`countryRoad`) with the HD hatchback (`createCarVisual`). Each pair: the start frame, and four seconds of W held.

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/starter-walk-start-before.jpg" alt="Before (main)"></td><td><img src="before-after/starter-walk-start-after.jpg" alt="This round"></td></tr></table>

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/starter-walk-run-before.jpg" alt="Before (main)"></td><td><img src="before-after/starter-walk-run-after.jpg" alt="This round"></td></tr></table>

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/starter-drive-start-before.jpg" alt="Before (main)"></td><td><img src="before-after/starter-drive-start-after.jpg" alt="This round"></td></tr></table>

<table><tr><th>Before (main)</th><th>This round</th></tr><tr><td><img src="before-after/starter-drive-run-before.jpg" alt="Before (main)"></td><td><img src="before-after/starter-drive-run-after.jpg" alt="This round"></td></tr></table>


## Night NYC (`samples/nyc-night`)

Late dusk replaced the neon night: the hero view looks west down a cross street into the afterglow.

<table><tr><th>First pass</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/nyc-avenue-before.jpg" alt="First pass"></td><td><img src="before-after/nyc-avenue-after.jpg" alt="1.1.0-beta.1"></td></tr></table>

<table><tr><th>First pass</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/nyc-square-before.jpg" alt="First pass"></td><td><img src="before-after/nyc-square-after.jpg" alt="1.1.0-beta.1"></td></tr></table>

<table><tr><th>First pass</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/nyc-sidewalk-before.jpg" alt="First pass"></td><td><img src="before-after/nyc-sidewalk-after.jpg" alt="1.1.0-beta.1"></td></tr></table>


### Street surface and kerbs

Scanned asphalt with cracks, tar seams, patches and worn paint; granite kerb stones; manholes, plates and grates.

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/nyc-road-before.jpg" alt="Before"></td><td><img src="before-after/nyc-road-after.jpg" alt="After"></td></tr></table>

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/nyc-kerb-before.jpg" alt="Before"></td><td><img src="before-after/nyc-kerb-after.jpg" alt="After"></td></tr></table>


### Ground floors

Shop fronts as geometry (recessed doors, glazing bars, fascias, awnings) and roller shutters on the closed ones.

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/nyc-shop-before.jpg" alt="Before"></td><td><img src="before-after/nyc-shop-after.jpg" alt="After"></td></tr></table>

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/nyc-shutter-before.jpg" alt="Before"></td><td><img src="before-after/nyc-shutter-after.jpg" alt="After"></td></tr></table>


## Miami drive (`samples/miami-drive`)

From a neon strip at night to a dusk drive on a dry dune road, with South Beach behind it.

<table><tr><th>First pass</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/miami-chase-before.jpg" alt="First pass"></td><td><img src="before-after/miami-chase-after.jpg" alt="1.1.0-beta.1"></td></tr></table>

<table><tr><th>First pass</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/miami-strip-before.jpg" alt="First pass"></td><td><img src="before-after/miami-strip-after.jpg" alt="1.1.0-beta.1"></td></tr></table>

<table><tr><th>First pass</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/miami-beach-before.jpg" alt="First pass"></td><td><img src="before-after/miami-beach-after.jpg" alt="1.1.0-beta.1"></td></tr></table>


### The hero car

Two cars generated in code, then the Khronos "Car Concept" sample model (CC-BY 4.0, logos removed, credited in
`samples/public/miami/CREDITS.md`) on the desktop tier. Phones keep the generated sedan.

<table><tr><th>Generated coupe</th><th>Generated sedan</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/miami-car-1-generated-coupe.jpg" alt="Generated coupe"></td><td><img src="before-after/miami-car-2-generated-sedan.jpg" alt="Generated sedan"></td><td><img src="before-after/miami-car-3-now.jpg" alt="1.1.0-beta.1"></td></tr></table>

<table><tr><th>First pass, dusk</th><th>1.1.0-beta.1, dusk</th></tr><tr><td><img src="before-after/miami-car-dusk-before.jpg" alt="First pass, dusk"></td><td><img src="before-after/miami-car-dusk-after.jpg" alt="1.1.0-beta.1, dusk"></td></tr></table>


The model ships with its wheels posed (the front pair steered 30 degrees, each wheel at its own roll angle). The loader
now sets them straight before it bakes them, so they point ahead, spin true and steer about their own axis.

<table><tr><th>Wheels as posed in the model</th><th>Wheels set straight</th></tr><tr><td><img src="before-after/miami-wheels-before.jpg" alt="Wheels as posed in the model"></td><td><img src="before-after/miami-wheels-after.jpg" alt="Wheels set straight"></td></tr></table>


### Buildings

The engine's generic boxes replaced by Art Deco hotels, mid-century balcony slabs, glass towers and shops, built from
the real OpenStreetMap footprints and heights.

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/miami-buildings-chase-before.jpg" alt="Before"></td><td><img src="before-after/miami-buildings-chase-after.jpg" alt="After"></td></tr></table>

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/miami-buildings-strip-before.jpg" alt="Before"></td><td><img src="before-after/miami-buildings-strip-after.jpg" alt="After"></td></tr></table>

<table><tr><th>Massing</th><th>Detail pass</th></tr><tr><td><img src="before-after/miami-hotel-massing.jpg" alt="Massing"></td><td><img src="before-after/miami-hotel-detail.jpg" alt="Detail pass"></td></tr></table>

<img src="before-after/miami-hotel-row.jpg" alt="The hotel row from 120 m" width="720">

<img src="before-after/miami-hotel-entrance.jpg" alt="A hotel entrance at 8 m" width="720">


## Engine: high-detail vehicles

`makeVehicleGeometry(type, { lod: 'hd' | 'mid' })`: the traffic cars at 36-40 k triangles near the camera (lamps with
depth, a grille, see-through glass over an interior, real wheels) and 8-9 k in the middle distance, beside the original
1 k-triangle level, which is unchanged.

<img src="before-after/cars-detail-levels.jpg" alt="High-detail sedan with the mid-distance and original levels beside it" width="720">

<img src="before-after/cars-in-street.jpg" alt="A high-detail car in a street at 5 m" width="720">
