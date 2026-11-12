# Before and after

What changed on screen in 1.1.0-beta.1. Every image is a capture of the samples in this repository, taken in Chrome on
an Apple M4 (the desktop quality tier unless noted). "Before" is the first working pass of each demo or the engine's
earlier output; "after" is this release. The city demos' camera poses moved between the two, so the pairs show the
same place and subject rather than the same pixel.

The work was held to a reference standard for tone (a low-key dusk frame: dark, nothing clipped, one warm hue family),
which is now a gate in `npm run smoke`, and then to asset detail: materials, construction and objects that hold up
close. `CHANGELOG.md` has the full list.

## Night NYC walk (`samples/nyc-night`)

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


## Midnight Candy Run (`samples/halloween`)

A look remaster only: rules, layout, controls and scoring are unchanged, and `?look=classic` shows the first look.

<table><tr><th>Classic look</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/halloween-gate-before.jpg" alt="Classic look"></td><td><img src="before-after/halloween-gate-after.jpg" alt="1.1.0-beta.1"></td></tr></table>

<table><tr><th>Classic look</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/halloween-graveyard-before.jpg" alt="Classic look"></td><td><img src="before-after/halloween-graveyard-after.jpg" alt="1.1.0-beta.1"></td></tr></table>

<table><tr><th>Classic look</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/halloween-village-before.jpg" alt="Classic look"></td><td><img src="before-after/halloween-village-after.jpg" alt="1.1.0-beta.1"></td></tr></table>

<table><tr><th>Classic look</th><th>1.1.0-beta.1</th></tr><tr><td><img src="before-after/halloween-house-before.jpg" alt="Classic look"></td><td><img src="before-after/halloween-house-after.jpg" alt="1.1.0-beta.1"></td></tr></table>


### Close up

Scanned boards, slate, stone and bark; engraved gravestones; smooth carved pumpkins; real porch lanterns.

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/halloween-wall-closeup-before.jpg" alt="Before"></td><td><img src="before-after/halloween-wall-closeup-after.jpg" alt="After"></td></tr></table>

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/halloween-grave-closeup-before.jpg" alt="Before"></td><td><img src="before-after/halloween-grave-closeup-after.jpg" alt="After"></td></tr></table>

<table><tr><th>Before</th><th>After</th></tr><tr><td><img src="before-after/halloween-pumpkin-closeup-before.jpg" alt="Before"></td><td><img src="before-after/halloween-pumpkin-closeup-after.jpg" alt="After"></td></tr></table>


## Engine: high-detail vehicles

`makeVehicleGeometry(type, { lod: 'hd' | 'mid' })`: the traffic cars at 36-40 k triangles near the camera (lamps with
depth, a grille, see-through glass over an interior, real wheels) and 8-9 k in the middle distance, beside the original
1 k-triangle level, which is unchanged.

<img src="before-after/cars-detail-levels.jpg" alt="High-detail sedan with the mid-distance and original levels beside it" width="720">

<img src="before-after/cars-in-street.jpg" alt="A high-detail car in a street at 5 m" width="720">
