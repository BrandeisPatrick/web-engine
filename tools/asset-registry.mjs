// Hand-kept part of the asset catalogue: the assets made in code, the downloaded files that no manifest describes,
// and the files under samples/public that are not assets. tools/catalog-assets.mjs merges this with the texture-set
// manifests and the CREDITS.md files, checks everything, and writes samples/public/catalog/catalog.json and
// docs/ASSETS.md. Edit this file, then run `node tools/catalog-assets.mjs` (and `node tools/render-asset-thumbs.mjs
// --only=<id>` for a new or changed entry's thumbnail).
//
// Entry fields (code entries):
//   id, name, category (CATEGORIES), module (repo path), export (the exported name the snippet uses; `symbol` instead
//   for something the module does not export), usedBy (demo ids), via ('MapWorld': a demo gets it through the engine's
//   MapWorld rather than calling it), tags, description, facts (static facts; measured ones come from
//   tools/asset-measurements.json), snippet (runs in samples/assets/runtime.js: see its header for the conventions),
//   preview ({ mode, result, frames, az, el, zoom, ... }), reusable (false: cannot be created outside its demo without
//   changing the demo; give `reason`).
// File entries add files (repo paths) and credit: { file: CREDITS.md path, row: text that finds the table row or
//   paragraph, plus any of author / licence / source / url the row does not state }.

import * as THREE from 'three';
import { VEHICLE_SPECS } from '../src/world/Vehicles.js';
import { makeFurnitureGeometry } from '../src/world/Furniture.js';

export const DEMOS = {
  'nyc-night': 'Night NYC drive',
  'miami-drive': 'Miami drive',
};

export const CATEGORIES = {
  vehicle: 'Vehicle', character: 'Character', building: 'Building', prop: 'Prop', vegetation: 'Vegetation', boat: 'Boat',
  'texture-set': 'Texture set', texture: 'Texture', road: 'Road and ground', water: 'Water', sign: 'Sign', sky: 'Sky',
  environment: 'Environment', effect: 'Effect', grade: 'Colour grade', map: 'Map data', sound: 'Sound',
};

/** Files under samples/public that are not catalogue entries, with the reason. A path ending in / covers a folder. */
export const IGNORE = [
  { path: 'samples/public/catalog/', reason: 'the catalogue itself (catalog.json and the thumbnails)' },
  { path: 'samples/public/miami/basis/', reason: 'Basis Universal transcoder (from three/examples/jsm/libs/basis, Apache-2.0): a runtime library for the KTX2 textures, not an asset' },
  { path: 'samples/public/miami/textures-lite/manifest.json', reason: 'phone-tier texture manifest of the Miami drive: it lists no sets (procedural layers)' },
];

// ------------------------------------------------------------------------------------------------ file assets
const B = 'import.meta.env.BASE_URL';
const gltfModel = (o) => ({
  snippet: `import * as THREE from 'three';
import { Assets } from '@vibe/engine/core';
import { registerRenderLoaders } from '@vibe/engine/render';
const assets = new Assets({ base: ${B} + '${o.base}' });
registerRenderLoaders(assets, renderer, { ktx2: false, meshopt: false });
assets.add('${o.key}', { type: 'gltf', url: '${o.url}' });
await assets.load();
const gltf = assets.get('${o.key}');
const person = gltf.instantiate();                  // a skinning-safe clone (geometry and materials shared)
scene.add(person);
const mixer = new THREE.AnimationMixer(person);
mixer.clipAction(gltf.animations.find((c) => ${o.walk})).play();
// every frame: mixer.update(dt);`,
  ...o.rest,
});

const STREET_KIT = [
  // [id, name, mesh names, Poly Haven id, author]
  ['hydrant', 'Fire hydrant', ['hydrant', 'hydrant_aged'], 'fire_hydrant', 'Gonçalo Felício'],
  ['can', 'Trash can', ['can', 'can_rust'], 'metal_trash_can', 'GurJas Studios'],
  ['bag', 'Garbage bag', ['bag', 'bagclear'], 'trashbag', 'Benny Weimer'],
  ['barrier', 'Jersey barrier', ['barrier'], 'concrete_road_barrier_02', 'Amal Kumar'],
  ['ubox', 'Signal controller box', ['ubox'], 'utility_box_01', 'James Ray Cock'],
  ['crate', 'Milk crate', ['crate'], 'plastic_crate_02', 'Fabi_G'],
  ['box', 'Cardboard box', ['box'], 'cardboard_box_01', 'Rahul Chaudhary'],
  ['manhole', 'Manhole cover (scan)', ['manhole'], 'water_manhole_cover', 'Raunox'],
];
const STREET_FILES = ['street.gltf', 'street.bin', 'atlas_diff.jpg', 'atlas_nor.jpg', 'atlas_arm.jpg', 'atlas512/atlas_diff.jpg', 'atlas512/atlas_nor.jpg', 'atlas512/atlas_arm.jpg']
  .map((f) => `samples/public/nyc/street/${f}`);

const streetKit = ([key, name, meshes, pid, author]) => ({
  id: `nyc-street-${key}`, name, category: 'prop', usedBy: ['nyc-night'], files: STREET_FILES, gltfMeshes: meshes,
  credit: { file: 'samples/public/nyc/CREDITS.md', row: `| ${pid} |`, author, licence: 'CC0 1.0', url: `https://polyhaven.com/a/${pid}` },
  tags: ['street kit', 'poly haven', 'scan', 'new york', ...meshes],
  description: `${name} from the Night NYC drive's street kit: a Poly Haven scan merged, simplified and UV-packed into one shared atlas by samples/nyc-night/tools/bake-street.mjs (meshes ${meshes.map((m) => `'${m}'`).join(', ')}${meshes[0] === 'manhole' ? '' : ', each with a _lod1'} in street.gltf). The demo places them along its streets (streetkit.js).`,
  snippet: `import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const dir = ${B} + 'nyc/street/';                    // atlas512/ holds the phone atlas
const gltf = await new GLTFLoader().loadAsync(dir + 'street.gltf');
const tex = (f, srgb) => new THREE.TextureLoader().loadAsync(dir + f).then((t) => { t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t; });
const [map, normalMap, arm] = await Promise.all([tex('atlas_diff.jpg', true), tex('atlas_nor.jpg'), tex('atlas_arm.jpg')]);
const material = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap: arm, metalnessMap: arm, aoMap: arm, roughness: 0.85, metalness: 1 });
material.normalScale.set(1, -1);
const mesh = new THREE.Mesh(gltf.scene.getObjectByName('${meshes[0]}').geometry, material);
scene.add(mesh);`,
});

const NYC_ENV = [
  ['comfy_cafe', 'Comfy Cafe', 'Sergej Majboroda', 'shop interior'],
  ['decor_shop', 'Decor Shop', 'Sergej Majboroda', 'shop interior'],
  ['gear_store', 'Gear Store', 'Dimitrios Savva, Jarod Guest', 'shop interior'],
  ['warm_bar', 'Warm Bar', 'Greg Zaal, Jarod Guest', 'shop interior'],
  ['warm_restaurant_night', 'Warm Restaurant (Night)', 'Greg Zaal, Jarod Guest', 'shop interior'],
  ['cinema_lobby', 'Cinema Lobby', 'Sergej Majboroda', 'lobby interior'],
  ['modern_buildings_night', 'Modern Buildings (Night)', 'Greg Zaal', 'night environment'],
];
const envEntry = ([pid, name, author, use]) => ({
  id: `nyc-env-${pid}`, name: `${name} panorama`, category: 'environment', usedBy: ['nyc-night'],
  files: [`samples/public/nyc/env/${pid}.jpg`],
  credit: { file: 'samples/public/nyc/CREDITS.md', row: `\`env/${pid}.jpg\``, author, licence: 'CC0 1.0', url: `https://polyhaven.com/a/${pid}` },
  tags: ['hdri', 'panorama', 'equirectangular', 'poly haven', use],
  facts: { projection: 'equirectangular, tone-mapped to sRGB JPEG (the HDR is not committed)', use },
  description: pid === 'modern_buildings_night'
    ? 'Night city panorama: the Night NYC drive turns it into the scene environment (PMREM) for glass, cars and the damp street.'
    : `Small interior panorama: the Night NYC drive stacks these into an atlas and shows them as parallax interiors behind its shop windows (signage.js buildInteriorAtlas).`,
  snippet: `import * as THREE from 'three';
const tex = await new THREE.TextureLoader().loadAsync(${B} + 'nyc/env/${pid}.jpg');
tex.mapping = THREE.EquirectangularReflectionMapping;
tex.colorSpace = THREE.SRGBColorSpace;
scene.background = tex;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromEquirectangular(tex).texture;`,
  preview: { mode: 'env' },
});

const LUTS = [
  ['warm', 'Warm grade', 'a warm procedural grade'],
  ['bleach', 'Bleach bypass grade', 'a desaturated, contrasty procedural grade'],
  ['identity', 'Identity LUT', 'the identity: applying it must leave the image unchanged (a test gate)'],
];
const lutEntry = ([name, title, what]) => ({
  id: `lut-${name}`, name: title, category: 'grade', usedBy: [], files: [`samples/public/luts/${name}.cube`],
  credit: { selfMade: true },
  tags: ['lut', '.cube', '3d lut', 'post'],
  facts: { format: 'Adobe .cube, 16 x 16 x 16, display-referred sRGB in and out' },
  description: `3D LUT made for the engine's samples (generated, no outside source): ${what}. No demo loads it by default; samples/shared/fx-flags.js loadLut can (?lut=${name}), but no page imports that module today.`,
  snippet: `import { parseCubeLUT, PostFX } from '@vibe/engine/render';
const lut = parseCubeLUT(await (await fetch(${B} + 'luts/${name}.cube')).text());
// then: new PostFX(renderer, scene, camera, { ..., lut: { texture: lut.texture, size: lut.size, strength: 1 } })`,
  preview: { mode: 'lut', result: 'lut' },
});

export const FILE_ENTRIES = [
  {
    id: 'miami-coral_gravel', name: 'Coral Gravel', category: 'texture-set', usedBy: ['miami-drive'],
    files: ['diff', 'nor_gl', 'rough'].map((m) => `samples/public/miami/roadside/coral_gravel_${m}.jpg`),
    credit: { file: 'samples/public/miami/CREDITS.md', row: '| Coral Gravel |', licence: 'CC0 1.0' },
    tags: ['poly haven', 'pbr', 'gravel', 'roadside'],
    facts: { maps: 'albedo, normal (OpenGL, 512 px), roughness (256 px)' },
    description: 'Poly Haven gravel scan for the Miami drive\'s road shoulders (roadside.js).',
    snippet: `import * as THREE from 'three';
const loader = new THREE.TextureLoader(), base = ${B} + 'miami/roadside/';
const [map, normalMap, roughnessMap] = await Promise.all(['diff', 'nor_gl', 'rough'].map((m) => loader.loadAsync(base + 'coral_gravel_' + m + '.jpg')));
map.colorSpace = THREE.SRGBColorSpace;
const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap }));
scene.add(ball);`,
  },
  {
    id: 'miami-car-concept', name: 'Car Concept (hero car)', category: 'vehicle', usedBy: ['miami-drive'],
    files: ['samples/public/miami/models/car-concept.glb'],
    credit: { file: 'samples/public/miami/CREDITS.md', row: '"Car Concept" by Eric Chadwick', author: 'Eric Chadwick (Darmstadt Graphics Group); based on a CC0 model by Unity Fan', licence: 'CC-BY 4.0 (attribution required)', source: 'Khronos glTF Sample Assets', url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept' },
    tags: ['car', 'glb', 'pbr', 'khronos', 'hero'],
    description: 'The Miami drive\'s desktop hero car. CC-BY 4.0: credit "Car Concept by Eric Chadwick, © 2024 Darmstadt Graphics Group GmbH" wherever it is shown. The Khronos and 3D Commerce logos were removed from the file. loadCarGlb (samples/miami-drive/car-glb.js) re-rigs it: wheels split out, tinted glass, paint colour, lamps as uniforms.',
    snippet: `import { loadCarGlb } from '../miami-drive/car-glb.js';
const car = await loadCarGlb({ url: ${B} + 'miami/models/car-concept.glb', paint: 0x4c0a20 });
scene.add(car.root);
for (const w of car.wheels) scene.add(w.root);   // the wheels are not children of root
car.lamps.uHead.value = 1;`,
    preview: { result: 'car', az: 140, el: 14 },
  },
  {
    id: 'miami-rock_07', name: 'Rock 07 (two LODs)', category: 'prop', usedBy: ['miami-drive'],
    files: ['samples/public/miami/roadside/rock_07_lo.glb', 'samples/public/miami/roadside/rock_07_hi.glb'],
    credit: { file: 'samples/public/miami/CREDITS.md', row: '| Rock 07 |', licence: 'CC0 1.0' },
    tags: ['rock', 'scan', 'poly haven', 'glb', 'lod', 'roadside'],
    description: 'Poly Haven rock scan decimated to two levels (rock_07_lo.glb, rock_07_hi.glb), scattered as pebbles and rocks along the Miami drive\'s road (roadside.js).',
    snippet: `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const gltf = await new GLTFLoader().loadAsync(${B} + 'miami/roadside/rock_07_hi.glb');   // or rock_07_lo.glb
scene.add(gltf.scene);`,
  },
  {
    id: 'miami-shrub_04', name: 'Shrub 04 (three LODs)', category: 'vegetation', usedBy: ['miami-drive'],
    files: ['samples/public/miami/roadside/shrub_04.glb', 'samples/public/miami/roadside/shrub_04_mid.glb', 'samples/public/miami/roadside/shrub_04_lo.glb'],
    credit: { file: 'samples/public/miami/CREDITS.md', row: '| Shrub 04 |', licence: 'CC0 1.0' },
    tags: ['shrub', 'bush', 'scan', 'poly haven', 'glb', 'lod', 'roadside'],
    description: 'Poly Haven shrub scan at three levels (5,623 / 1,561 / 529 triangles): the Miami drive bakes impostors from the full one and draws the other two near the road (roadside.js; desktop only).',
    snippet: `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const gltf = await new GLTFLoader().loadAsync(${B} + 'miami/roadside/shrub_04_mid.glb');   // shrub_04.glb, shrub_04_lo.glb
scene.add(gltf.scene);`,
  },
  ...[
    ['BusinessMan', 'Business Man', 'business', 'JFrLIKqvCH', 'One of the Night NYC drive\'s pedestrians.', "c.name === 'CharacterArmature|Walk'"],
    ['ManInSuit', 'Man in Suit', 'suit', 'mQnGoME1ez', 'One of the Night NYC drive\'s pedestrians.', "c.name === 'HumanArmature|Man_Walk'"],
    ['Woman', 'Animated Woman', 'woman', '9kF7eTDbhO', 'One of the Night NYC drive\'s pedestrians (tinted per person).', "c.name === 'Armature|Walking'"],
  ].map(([file, name, key, pp, use, walkRe]) => gltfModel({
    base: 'nyc/', key, url: `models/${file}.glb`, walk: walkRe,
    rest: {
      id: `nyc-${file}`, name, category: 'character', usedBy: ['nyc-night'], files: [`samples/public/nyc/models/${file}.glb`],
      credit: { file: 'samples/public/nyc/models/CREDITS.md', row: `\`${file}.glb\``, source: 'Quaternius via poly.pizza', url: `https://poly.pizza/m/${pp}` },
      tags: ['character', 'person', 'rigged', 'animated', 'glb', 'quaternius', 'low poly'],
      description: `Rigged, animated low-poly character by Quaternius (CC0). ${use} The demo plays its walk and idle clips through an AnimationMixer per person (pedestrians.js).`,
      preview: { az: 30, el: 10, frames: 20, result: 'gltf' },
    },
  })),
  ...STREET_KIT.map(streetKit),
  ...NYC_ENV.map(envEntry),
  ...LUTS.map(lutEntry),
  {
    id: 'nyc-map', name: 'Midtown Manhattan map', category: 'map', usedBy: ['nyc-night'], files: ['samples/public/nyc/map/city.json'],
    credit: { file: 'samples/public/nyc/CREDITS.md', row: '`map/city.json`', author: 'OpenStreetMap contributors', licence: 'ODbL 1.0 (attribution required: "© OpenStreetMap contributors")', source: 'OpenStreetMap (Overpass API), baked by tools/bake-map.mjs', url: 'https://www.openstreetmap.org/copyright' },
    tags: ['openstreetmap', 'osm', 'city', 'roads', 'buildings', 'manhattan', 'times square'],
    facts: { area: '1.5 km square around 40.7565, -73.9865 (Times Square), outer ring 4 km', bakedWith: 'tools/bake-map.mjs --lat 40.7565 --lon -73.9865 --size 1500 --outer 4000' },
    description: 'Baked OpenStreetMap data (roads, buildings, parks, water) for the engine\'s MapWorld: the Night NYC drive builds its city from it.',
    snippet: `import { loadMapData } from '@vibe/engine/world';
const map = await loadMapData(${B} + 'nyc/map/city.json');
// a whole city: new MapWorld({ scene, renderer, camera, data: { mapUrl: ${B} + 'nyc/map/city.json', farlandUrl: false } })`,
    preview: { mode: 'card', result: 'map', label: 'Map data', note: 'OpenStreetMap, ODbL' },
  },
  {
    id: 'miami-map', name: 'South Beach map', category: 'map', usedBy: ['miami-drive'], files: ['samples/public/miami/map/city.json'],
    credit: { file: 'samples/public/miami/CREDITS.md', row: '`map/city.json`', author: 'OpenStreetMap contributors', licence: 'ODbL 1.0 (attribution required: "© OpenStreetMap contributors")', source: 'OpenStreetMap (Overpass API), baked by tools/bake-map.mjs', url: 'https://www.openstreetmap.org/copyright' },
    tags: ['openstreetmap', 'osm', 'city', 'roads', 'buildings', 'miami', 'beach'],
    facts: { area: '2.6 km square around 25.7785, -80.1365 (South Beach, Miami Beach)', bakedWith: 'tools/bake-map.mjs --lat 25.7785 --lon -80.1365 --size 2600' },
    description: 'Baked OpenStreetMap data for the engine\'s MapWorld: the Miami drive builds South Beach from it (plus its own beach and buildings plugins).',
    snippet: `import { loadMapData } from '@vibe/engine/world';
const map = await loadMapData(${B} + 'miami/map/city.json');`,
    preview: { mode: 'card', result: 'map', label: 'Map data', note: 'OpenStreetMap, ODbL' },
  },
];

// ------------------------------------------------------------------------------------------------ engine: vehicles
const VEH = {
  sedan: ['Sedan', 'car'], hatchback: ['Hatchback', 'car'], suv: ['SUV', 'car'], pickup: ['Pickup truck', 'car'], minivan: ['Minivan', 'car'],
  police: ['Police SUV', 'police'], taxi: ['Taxi', 'taxi'], police_sedan: ['Police sedan', 'police'], boxtruck: ['Box truck', 'truck'], bus: ['City bus', 'bus'],
};
const HD = new Set(['sedan', 'hatchback', 'suv', 'pickup', 'minivan', 'police', 'taxi', 'police_sedan']);
const vehicleEntry = ([type, [name, palette]]) => ({
  id: `engine-vehicle-${type}`, name, category: 'vehicle', module: 'src/world/Vehicles.js', export: 'makeVehicleGeometry',
  usedBy: type === 'police_sedan' ? [] : ['nyc-night', 'miami-drive'], via: type === 'police_sedan' ? null : 'MapWorld',
  tags: ['car', 'traffic', 'procedural', 'lod', type, palette],
  facts: { lods: HD.has(type) ? "0, 1, 'mid', 'hd' (two draw groups: body, glass)" : "0, 1 ('hd' returns the LOD 0 build)", paint: `pickVehicleColor palette '${palette}'` },
  description: `${name} built in code by the engine (src/world/Vehicles.js). Faces -Z like VehicleController, with its origin on the ground between the axles, so it goes on a controller's body with no flip or offset; ${VEHICLE_SPECS[type].L} x ${VEHICLE_SPECS[type].W} x ${VEHICLE_SPECS[type].H} m long x wide x high (VEHICLE_SPECS.${type}, wheelbase ${VEHICLE_SPECS[type].WB} m)${HD.has(type) ? '; for wheels that roll and steer, makeVehicleParts gives body, glass and wheels apart' : ''}. MapWorld's traffic and parked cars use it${type === 'police_sedan' ? ' (this type is not in the traffic mix: TrafficSim leaves it out)' : ''}; samples/dev/vehicles.html shows every type. Paint comes from the instance colour; the lamps glow with the material's userData.u.uDark uniform (0 day .. 1 night, set in the snippet).`,
  snippet: HD.has(type) ? `import * as THREE from 'three';
import { makeVehicleGeometry, createVehicleMaterial, pickVehicleColor } from '@vibe/engine/world';
const geometry = makeVehicleGeometry('${type}', { lod: 'hd' });          // shared and cached: do not modify
const body = createVehicleMaterial({ hd: true, brake: false }), glass = createVehicleMaterial({ hd: true, glass: true, brake: false });
const car = new THREE.InstancedMesh(geometry, [body, glass], 1);
car.setMatrixAt(0, new THREE.Matrix4());
car.setColorAt(0, pickVehicleColor(Math.random, '${palette}', new THREE.Color()));
for (const m of [body, glass]) m.userData.u.uDark.value = 1;          // lamps on: 0 day .. 1 night
scene.add(car);` : `import * as THREE from 'three';
import { makeVehicleGeometry, createVehicleMaterial, pickVehicleColor } from '@vibe/engine/world';
const geometry = makeVehicleGeometry('${type}', { lod: 0 });
const material = createVehicleMaterial({ brake: false });
material.userData.u.uDark.value = 1;                                     // lamps on: 0 day .. 1 night
const car = new THREE.InstancedMesh(geometry, material, 1);
car.setMatrixAt(0, new THREE.Matrix4());
car.setColorAt(0, pickVehicleColor(Math.random, '${palette}', new THREE.Color()));
scene.add(car);`,
  preview: { az: 140, el: 16, seedRandom: true },
});

// ------------------------------------------------------------------------------------------------ engine: furniture
const FURN = {
  cobra: ['Cobra-head street light', 'street light', '9 m arterial cobra head; the arm points along +X'],
  cobraRes: ['Residential street light', 'street light', '7.6 m residential cobra head'],
  pathOfGold: ['Path of Gold lamp', 'street light', 'ornate trident lamp post with gold lanterns'],
  doubleGlobe: ['Double-globe promenade lamp', 'street light', 'twin-globe lamp; the crossarm runs along the kerb'],
  acorn: ['Acorn lamp', 'street light', 'plaza lamp post'],
  mastPole: ['Signal mast pole', 'traffic signal', '7 m pole for a mast arm'],
  mastArm: ['Signal mast arm', 'traffic signal', 'unit length along +X: scale X to the span'],
  pedPole: ['Signal pedestal pole', 'traffic signal', '4.6 m pole'],
  sigHead: ['Traffic signal head', 'traffic signal', 'three-section head with visors, facing -Z'],
  pedHead: ['Pedestrian signal head', 'traffic signal', 'walk / don\'t walk head with push button'],
  signPost: ['Sign post', 'sign', 'unit height: scale Y'],
  hydrant: ['Fire hydrant', 'street item', ''],
  bollard: ['Bollard', 'street item', ''],
  trashCan: ['Trash can', 'street item', 'green or black by instance colour'],
  bench: ['Bench', 'street item', ''],
  bikeRack: ['Bike rack', 'street item', ''],
  newsBox: ['Newspaper box', 'street item', ''],
  mailbox: ['Mailbox', 'street item', 'USPS-style blue'],
  meter: ['Parking meter', 'street item', ''],
  shelter: ['Bus shelter', 'street item', 'frame only; the glass is makeShelterGlassGeometry + createShelterGlassMaterial'],
  utilityPole: ['Utility pole', 'street item', 'wire attachment points in FURNITURE_META'],
  utilityPoleTx: ['Utility pole with transformer', 'street item', ''],
  aframe: ['A-frame sandwich board', 'frontage', ''],
  cafeSet: ['Cafe table and chairs', 'frontage', ''],
  pot: ['Shrub pot', 'frontage', ''],
  planter: ['Planter', 'frontage', ''],
};
// what the source header (src/world/Furniture.js) says about each frame; checked against the geometry's bounds
const FURN_FRAME = {
  cobra: 'the arm reaches along +X from the pole', cobraRes: 'the arm reaches along +X from the pole',
  doubleGlobe: 'the crossarm runs along X', mastArm: 'unit length along +X from the origin', signPost: 'unit height',
  sigHead: 'faces -Z', pedHead: 'faces -Z, the head 1 to 3 m up on the pole side',
  bench: 'the seat faces -Z', shelter: 'open side towards -Z', meter: 'the front faces -Z', newsBox: 'the front faces -Z',
  mailbox: 'the front faces -Z', utilityPole: 'the crossarm runs along X', utilityPoleTx: 'the crossarm runs along X',
};
const GLOWS = new Set(['cobra', 'cobraRes', 'pathOfGold', 'doubleGlobe', 'acorn', 'meter', 'shelter']); // parts with night emission
const furnitureSize = (type) => {
  const g = makeFurnitureGeometry(type);
  if (!g.boundingBox) g.computeBoundingBox();
  const s = g.boundingBox.getSize(new THREE.Vector3());
  return [s.x, s.y, s.z].map((v) => (v < 1 ? v.toFixed(2) : v.toFixed(1))).join(' x ');
};
const furnitureEntry = ([type, [name, group, note]]) => ({
  id: `engine-furniture-${type}`, name, category: type === 'signPost' ? 'sign' : 'prop', module: 'src/world/Furniture.js', export: 'makeFurnitureGeometry',
  usedBy: ['nyc-night', 'miami-drive'], via: 'MapWorld',
  tags: ['street furniture', group, 'procedural', type],
  facts: { type, origin: 'on the ground' },
  description: `${name} built in code by the engine (src/world/Furniture.js)${note ? `: ${note}` : ''}. ${type === 'sigHead' ? 'Origin at the hanger, the head hangs below it' : type === 'mastArm' ? 'Origin at one end of the arm (x = 0), on its axis' : 'Origin on the ground (pavement top)'}, +Y up${FURN_FRAME[type] ? `, ${FURN_FRAME[type]}` : ''}; ${furnitureSize(type)} m along X x Y x Z. MapWorld's Props places street furniture along the map's roads; one cached geometry per type, vertex coloured, painted parts take the instance colour${GLOWS.has(type) ? "; lamp heads and screens glow with the material's userData.u.uNight uniform (0 day .. 1 night, set in the snippet)" : ''}.`,
  snippet: `import * as THREE from 'three';
import { makeFurnitureGeometry, createFurnitureMaterial } from '@vibe/engine/world';
const geometry = makeFurnitureGeometry('${type}');                       // cached: shared by every caller
const item = new THREE.InstancedMesh(geometry, createFurnitureMaterial(), 1);
item.setMatrixAt(0, new THREE.Matrix4());
item.setColorAt(0, new THREE.Color(${type === 'trashCan' ? '0x2f5d3a' : type === 'bench' ? '0x2e4a35' : '0xffffff'}));       // paint of the painted parts${GLOWS.has(type) ? `
item.material.userData.u.uNight.value = 1;                               // ${/^(meter|shelter)$/.test(type) ? 'screen' : 'lamp head'} on: 0 day .. 1 night` : ''}
scene.add(item);`,
  preview: { az: type === 'cobra' || type === 'cobraRes' || type === 'mastArm' ? 20 : type === 'sigHead' || type === 'pedHead' ? 215 : 35, el: 14 },
});

// ------------------------------------------------------------------------------------------------ engine: others
const SPECIES_NAMES = { planeA: 'London plane tree', planeB: 'London plane tree (variant)', round: 'Round-crowned tree', oak: 'Coast live oak', palm: 'Canary date palm', cypress: 'Monterey cypress', pine: 'Pine' };
const treeEntry = ([sp, name]) => ({
  id: `engine-tree-${sp}`, name, category: 'vegetation', module: 'src/world/Vegetation.js', export: 'buildTreeMeshes',
  usedBy: ['nyc-night', 'miami-drive'], via: 'MapWorld',
  tags: ['tree', 'procedural', 'wind', 'impostor', sp],
  facts: { species: sp, lod: 'instanced mesh near, baked billboard impostors far (150-185 m cross-fade)' },
  description: `${name} built in code by the engine (src/world/VegModels.js), with wind sway and a baked impostor for distance. MapWorld plants street, park and OSM trees with buildTreeMeshes; a mix override picks the species.`,
  snippet: `import { buildTreeMeshes } from '@vibe/engine/world';
const trees = buildTreeMeshes([{ x: 0, z: 0, s: 1, hue: 0.5, kind: 'park', ctx: { park: 'park' } }], { mix: { park: [['${sp}', 1]] } });
scene.add(trees.group);
// every frame: trees.update(dt, camera.position, 0, t);`,
  preview: { frames: 4, az: 30, el: 10, zoom: 1.05 },
});

const BOATS = [
  ['ferryGeometry', 'Bay ferry', '42 m two-deck ferry with nav lights', 'ferryGeometry()'],
  ['shipGeometry', 'Container ship', '210 m ship with stacked containers', 'shipGeometry()'],
  ['sailboatGeometry', 'Sailboat', '11 m sloop; sailboatGeometry(colour, false) furls the main', 'sailboatGeometry()'],
  ['fishingBoatGeometry', 'Fishing boat', '14 m', 'fishingBoatGeometry()'],
  ['launchGeometry', 'Motor launch', '9 m', 'launchGeometry()'],
];
const boatEntry = ([fn, name, note, call]) => ({
  id: `engine-boat-${fn.replace('Geometry', '')}`, name, category: 'boat', module: 'src/world/Boats.js', export: fn,
  usedBy: [], tags: ['boat', 'ship', 'procedural', 'water'],
  facts: { note },
  description: `${name} built in code by the engine (src/world/Boats.js): ${note}. Bow towards -Z. MapWorld moves ferries, the ship and sailboats along routes and moors small boats at piers when a map defines them; neither city demo does, so no demo shows it today.`,
  snippet: `import * as THREE from 'three';
import { ${fn}, createBoatMaterial } from '@vibe/engine/world';
const boat = new THREE.Mesh(${call}, createBoatMaterial());
scene.add(boat);`,
  preview: { az: 130, el: 14 },
});

const SKY = { dawn: 7.25, morning: 9.5, noon: 13, afternoon: 15.5, golden: 17.55, sunset: 18.45, dusk: 18.95, night: 22 };
const skyEntry = ([preset, hours]) => ({
  id: `engine-sky-${preset}`, name: `Sky: ${preset}`, category: 'sky', module: 'src/render/Atmosphere.js', export: 'Atmosphere',
  usedBy: ['nyc-night', 'miami-drive'], via: null,
  tags: ['sky', 'time of day', 'sun', 'clouds', 'fog', preset],
  facts: { hours, preset },
  description: `The engine's physical sky at the '${preset}' preset (${hours} h): sun and moon, procedural clouds, stars, fog, hemisphere light, cascaded sun shadows and an environment map from the sky. Every demo runs an Atmosphere (the city demos through MapWorld, with their own sun model and looks).`,
  snippet: `import { Atmosphere } from '@vibe/engine/render';
const atmo = new Atmosphere({ scene, renderer, camera, timeOfDay: '${preset}' });
// every frame: atmo.update(camera.position, dt);`,
  preview: { mode: 'sky', result: 'atmo', frames: 6 },
});

const PROC_TEX = [
  ['makeAsphaltTexture', 'Asphalt (procedural)', 'asphalt with aggregate, patches and cracks; 1024 px, an 8 m tile'],
  ['makePavingTexture', 'Paving (procedural)', 'concrete paving; 512 px'],
  ['makeGroundTexture', 'Ground (procedural)', 'urban ground; 1024 px'],
  ['makeGrassTexture', 'Grass (procedural)', 'grass; 512 px'],
  ['makeWaterNormalTexture', 'Water normal map (procedural)', 'tileable ripple normal map; 512 px'],
];
const procTexEntry = ([fn, name, note]) => ({
  id: `engine-tex-${fn.replace(/^make|Texture$/g, '').toLowerCase()}`, name, category: 'texture', module: 'src/render/TextureSets.js', export: fn,
  usedBy: ['nyc-night', 'miami-drive'], via: 'MapWorld',
  tags: ['procedural', 'canvas', 'tileable', 'fallback'],
  facts: { note },
  description: `Tileable canvas texture painted in code (${note}). MapWorld uses the painters where no photo set is configured.`,
  snippet: `import * as THREE from 'three';
import { ${fn} } from '@vibe/engine/render';
const map = ${fn}(renderer);
map.repeat.set(2, 2);
const tile = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ map }));
scene.add(tile);`,
  preview: { mode: 'flat', studio: false },
});

export const CODE_ENTRIES = [
  ...Object.entries(VEH).map(vehicleEntry),
  {
    id: 'engine-car-visual', name: 'Drivable car (createCarVisual)', category: 'vehicle', module: 'src/world/CarVisual.js', export: 'createCarVisual',
    usedBy: ['nyc-night'], tags: ['car', 'drivable', 'hd', 'wheels', 'lamps', 'procedural', 'player'],
    facts: { types: "VEHICLE_HD_TYPES (sedan, hatchback, suv, pickup, minivan, police, taxi, police_sedan)", physics: 'visual.spec = ROAD_CAR_SPEC resized to the body' },
    description: 'A drivable HD car in one call: makeVehicleParts body, glass, interior and four wheels that roll, steer and ride the suspension of a VehicleController built from visual.spec (ROAD_CAR_SPEC resized to the body, so the wheels sit where the physics has them), brake / reverse / head lamps and a soft contact shadow. Faces -Z; the origin is on the ground at the middle of the body length, the controller\'s reference point. Call visual.update(dt, car, { darkness }) each frame after placing visual.root on the car\'s pose. The starter-drive page drives one.',
    snippet: `import * as THREE from 'three';
import { createCarVisual } from '@vibe/engine/world';
import { VehicleController } from '@vibe/engine/physics';
const visual = createCarVisual('hatchback', { color: 0x9e1416 });
scene.add(visual.root);
const car = new VehicleController(visual.spec);
visual.update(0, car, { darkness: 0 });`,
    preview: { az: 140, el: 16 },
  },
  {
    id: 'engine-country-road', name: 'Country road (countryRoad)', category: 'road', module: 'src/world/Scenery.js', export: 'countryRoad',
    usedBy: [], tags: ['road', 'lay-by', 'lane lines', 'verge', 'fence', 'utility poles', 'trees', 'procedural', 'starter'],
    description: 'A quiet two-lane road along -Z to start a driving game on, in one call: the asphalt with a lay-by, lane and edge lines, gravel verges, a timber fence, utility poles with wires, a side track with a name sign, trees and a tree line, built from the engine\'s furniture, vegetation and PartBuilder. Static colliders go into a PhysicsWorld when one is given. Call place.update(dt, cameraPos, darkness) each frame (tree wind, the near / far tree split); place.paths feed groundCover, place.surfaces the road texture. starter-drive drives on it.',
    snippet: `import { countryRoad } from '@vibe/engine/world';
const place = countryRoad({ from: 20, to: -140 });
for (const s of place.surfaces) s.mesh.material.color.set(0x34363a); // untextured asphalt (starter-drive puts a texture set on place.surfaces)
scene.add(place.group);
// every frame: place.update(dt, camera.position, 0);`,
    preview: { frames: 4, target: [0, 0, -30], az: 30, el: 22, dist: 60 },
  },
  {
    id: 'engine-park-corner', name: 'Park corner (parkCorner)', category: 'environment', module: 'src/world/Scenery.js', export: 'parkCorner',
    usedBy: [], tags: ['park', 'gravel path', 'bench', 'fence', 'boulders', 'trees', 'procedural', 'starter'],
    description: 'A small park corner to start a walking game in, in one call: a gravel path past a lamp, a bench under it, a fence run, boulders, trees and a tree line. Static colliders (bench, fence, boulders, near trunks) go into a PhysicsWorld when one is given. Call place.update(dt, cameraPos, darkness) each frame; place.paths feed groundCover({ paths }) for the path and the grass patches on your ground. starter-walk is set in one.',
    snippet: `import { parkCorner } from '@vibe/engine/world';
const place = parkCorner({ lamp: [3, -6] });
scene.add(place.group);
// every frame: place.update(dt, camera.position, 0);`,
    preview: { frames: 4, target: [2, 0.4, -6], az: 35, el: 22, dist: 16 },
  },
  ...Object.entries(FURN).map(furnitureEntry),
  ...Object.entries(SPECIES_NAMES).map(treeEntry),
  ...BOATS.map(boatEntry),
  ...Object.entries(SKY).map(skyEntry),
  ...PROC_TEX.map(procTexEntry),
  {
    id: 'engine-water', name: 'Water surface', category: 'water', module: 'src/world/Water.js', export: 'createWaterMaterial',
    usedBy: ['nyc-night', 'miami-drive'], via: 'MapWorld',
    tags: ['water', 'waves', 'gerstner', 'foam', 'reflection', 'refraction'],
    description: 'The engine\'s water: Gerstner swell (CPU and GPU agree, so boats can float), procedural normal and noise maps, shore foam from a distance field, optional refraction. pond: true is the calm open-water version used here; MapWorld passes its own shore field.',
    snippet: `import { Atmosphere } from '@vibe/engine/render';
import { Water, createWaterMaterial, makeWaterNormalMap, makeNoiseTexture } from '@vibe/engine/world';
const atmo = new Atmosphere({ scene, renderer, camera, timeOfDay: 'golden' });   // sky, sun and the environment it reflects
const material = createWaterMaterial({ normalMap: makeWaterNormalMap(renderer, 512), noiseMap: makeNoiseTexture(renderer, 256), pond: true });
const water = new Water({ material, level: 0 });
scene.add(water.build());
// every frame: atmo.update(camera.position, dt); water.update(t, 0);`,
    preview: { mode: 'sky', frames: 6, look: [0, -0.18, -1] },
  },
  {
    id: 'engine-street-signs', name: 'Street sign atlas', category: 'sign', module: 'src/world/Furniture.js', export: 'buildSignAtlas',
    usedBy: ['nyc-night', 'miami-drive'], via: 'MapWorld',
    tags: ['signs', 'atlas', 'street names', 'stop', 'speed limit', 'posters', 'canvas'],
    facts: { size: '2048 x 2048 canvas', icons: 'stop, all-way, speed 25 / 30, no parking, street cleaning, one way, bus, back, manhole, drain, 6 posters; green street-name blades per road name' },
    description: 'Canvas atlas of US street signs and street-name blades, painted in code. MapWorld\'s Props mounts them on sign posts, signal masts and decals (createPanelMaterial with per-instance atlas rectangles).',
    snippet: `import * as THREE from 'three';
import { buildSignAtlas } from '@vibe/engine/world';
const atlas = buildSignAtlas(['Main Street', 'Ocean Drive']);
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: atlas.texture, transparent: true }));
scene.add(sheet);`,
    preview: { mode: 'flat', studio: false },
  },
  {
    id: 'engine-cloud-texture', name: 'Cloud noise atlas', category: 'texture', module: 'src/render/skyTextures.js', export: 'makeCloudTexture',
    usedBy: ['nyc-night', 'miami-drive'], via: 'Atmosphere',
    tags: ['clouds', 'noise', 'sky', 'procedural'],
    description: 'RGBA cloud noise (cumulus, cirrus, detail) the Atmosphere\'s sky draws its drifting clouds from.',
    snippet: `import * as THREE from 'three';
import { makeCloudTexture } from '@vibe/engine/render';
const clouds = makeCloudTexture(512);
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ map: clouds.texture }));
scene.add(sheet);`,
    preview: { mode: 'flat', studio: false },
  },
  {
    id: 'engine-vegetation-atlas', name: 'Vegetation atlas', category: 'texture', module: 'src/world/VegTextures.js', export: 'makeVegAtlas',
    usedBy: ['nyc-night', 'miami-drive'], via: 'MapWorld',
    tags: ['leaves', 'bark', 'atlas', 'procedural', 'trees'],
    facts: { size: '2048 x 2048', regions: 'plane, small, cypress, pine, shrub, grass, frond, barkPlane, barkDark, barkPalm' },
    description: 'Leaf, frond, grass and bark atlas painted in code; every engine tree and its impostor samples it.',
    snippet: `import * as THREE from 'three';
import { makeVegAtlas } from '@vibe/engine/world';
const atlas = makeVegAtlas(1);
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: atlas.texture, transparent: true }));
scene.add(sheet);`,
    preview: { mode: 'flat', studio: false },
  },
  {
    id: 'engine-city-ambience', name: 'City ambience', category: 'sound', module: 'src/audio/Ambience.js', export: 'CityAmbience',
    usedBy: [], tags: ['ambience', 'wind', 'city hum', 'traffic', 'gulls', 'synth'],
    description: 'Synthesised city ambience: wind with gusts, distant city hum and traffic swell (quieter at night), gull calls near water. No demo uses it today. Needs a user gesture before the AudioContext runs.',
    snippet: `import { AudioBus, CityAmbience } from '@vibe/engine/audio';
const bus = new AudioBus({ volume: 0.8 });
bus.unlockOnGesture();                      // audio starts on the first click / key
const ambience = new CityAmbience(bus, { level: 1, gulls: true });
ambience.setEnvironment({ nearWater: 1, darkness: 0.2 });
// every frame: ambience.update(dt, { speedN: 0, altitude: 0 });`,
    preview: { mode: 'card', label: 'Sound', note: 'Synthesised in code' },
  },
  {
    id: 'engine-vehicle-audio', name: 'Electric vehicle sound', category: 'sound', module: 'src/audio/VehicleAudio.js', export: 'VehicleAudio',
    usedBy: [], tags: ['vehicle', 'engine', 'ev', 'motor whine', 'tyres', 'wind', 'synth'],
    description: 'Synthesised vehicle sound: EV motor whine, inverter whistle, thruster roar, tyre slip, wind and impact thumps, plus a city ambience bed. No demo uses it today (the Miami drive has its own CarAudio).',
    snippet: `import { VehicleAudio } from '@vibe/engine/audio';
const audio = new VehicleAudio({ volume: 0.7, topSpeed: 200 });
addEventListener('pointerdown', () => audio.start(), { once: true });   // needs a user gesture
// every frame: audio.update(dt, { speedKmh: 60, rpmLike: 0.4, thrust: 0.5, grounded: true, wheelSlip: 0 });`,
    preview: { mode: 'card', label: 'Sound', note: 'Synthesised in code' },
  },
  {
    id: 'engine-facade-windows', name: 'Facade window styles', category: 'texture', module: 'src/world/FacadeTextures.js', export: 'makeFacadeTextures',
    usedBy: ['nyc-night', 'miami-drive'], via: 'MapWorld',
    tags: ['facade', 'windows', 'buildings', 'texture array', 'procedural'],
    facts: { layers: 'PUNCHED, PAIR, CLASSIC, RIBBON, VERTICAL, INDUSTRIAL, GARAGE, MODERN_RES, STOREFRONT, VICTORIAN, OFFICE_MODERN, SMALL' },
    description: 'Twelve window styles painted in code into texture arrays (albedo and data); the engine\'s building facades pick one per building style. Shown here: the albedo layers side by side.',
    snippet: `import * as THREE from 'three';
import { makeFacadeTextures } from '@vibe/engine/world';
const facade = makeFacadeTextures(renderer);       // { albedo, data: DataArrayTextures, layers }
// facade.albedo feeds createFacadeMaterials(facade, pbr); it is an array texture, so a plain material cannot show it`,
    preview: { mode: 'card', label: 'Texture array', note: 'Used through createFacadeMaterials' },
  },
];

// ------------------------------------------------------------------------------------------------ Miami drive
CODE_ENTRIES.push(
  {
    id: 'miami-sedan', name: 'Corsa Vela sedan', category: 'vehicle', module: 'samples/miami-drive/car-model.js', export: 'buildCarModel', usedBy: ['miami-drive'],
    tags: ['car', 'sdf', 'procedural', 'hero', 'lod', '90s'],
    facts: { lods: "'high' (SDF voxel 1.7 cm), 'low' (3.5 cm)", size: '4.86 x 1.80 x 1.40 m' },
    description: 'An early-90s three-box sedan meshed in code from a signed distance field, with one shader that draws glass, lamps, grille, plate and panel gaps. The Miami drive\'s hero car on phones (and with ?car=sedan). Lamps are uniforms: model.lamps.uHead.value = 1.',
    snippet: `import { buildCarModel } from '../miami-drive/car-model.js';
const car = buildCarModel({ lod: 'high', paint: 0x5c0c18 });
scene.add(car.root);
for (const w of car.wheels) scene.add(w.root);   // the wheels are not children of root`,
    preview: { result: 'car', az: 140, el: 14 },
  },
  {
    id: 'miami-near-palms', name: 'Coconut palm (detailed)', category: 'vegetation', module: 'samples/miami-drive/palm.js', export: 'buildNearPalms', usedBy: ['miami-drive'],
    tags: ['palm', 'tree', 'tropical', 'wind', 'procedural'],
    description: 'Detailed coconut palms (ringed trunk, two crown variants with dead fronds and coconuts, wind) built in code for the Miami drive\'s beach, instanced per 60 m chunk; they dither in near the camera.',
    snippet: `import { buildNearPalms } from '../miami-drive/palm.js';
const palms = buildNearPalms([{ x: 0, y: 0, z: 0, h: 9, yaw: 0.4, lean: 0.12, leanDir: 1 }], { near: 400 });
scene.add(palms.group);
// every frame: palms.update(camera, dt);`,
    preview: { frames: 4, az: 30, el: 8 },
  },
  {
    id: 'miami-dune-road', name: 'Dune road', category: 'road', module: 'samples/miami-drive/dune-road.js', export: 'buildDuneRoad', usedBy: ['miami-drive'],
    tags: ['road', 'asphalt', 'lane markings', 'stones', 'grass', 'procedural'],
    description: 'The Miami drive\'s beach road built in code: a worn two-lane asphalt corridor with a double yellow line, patches, cracks and wheel tracks, plus scattered stones, rocks, scrub and grass tufts. Rows give its centre line; sandHeight its ground.',
    snippet: `import { buildDuneRoad } from '../miami-drive/dune-road.js';
const rows = Array.from({ length: 181 }, (_, i) => ({ z: -180 + 2 * i, x0: 0 }));
const road = buildDuneRoad({ rows, sandHeight: () => 0, lod: 'high' });
scene.add(road.group);`,
    preview: { target: [0, 0, 0], az: 25, el: 16, zoom: 3.2 },
  },
  {
    id: 'miami-dusk-sky', name: 'Dusk sky with cumulus', category: 'sky', module: 'samples/miami-drive/sky.js', export: 'DuskSky', usedBy: ['miami-drive'],
    tags: ['sky', 'dusk', 'clouds', 'procedural'],
    description: 'The Miami drive\'s dusk sky dome with procedural cumulus. It switches itself on when the sun is just below the horizon (it reads atmo.sunDir), so a stand-in with a low sun is enough.',
    snippet: `import * as THREE from 'three';
import { DuskSky } from '../miami-drive/sky.js';
const atmo = { sunDir: new THREE.Vector3(0, -0.02, 1).normalize(), version: 0 };   // or a real engine Atmosphere
const sky = new DuskSky({ scene, renderer, atmo, glowAzimuth: 0, exposure: 1 });
await sky.load();
// every frame: sky.update(camera);`,
    preview: { mode: 'sky', frames: 4, look: [0, 0.12, 1] },
  },
  {
    id: 'miami-car-env', name: 'Car reflection environment', category: 'environment', module: 'samples/miami-drive/car-model.js', export: 'makeCarEnvironment', usedBy: ['miami-drive'],
    tags: ['environment', 'reflections', 'pmrem', 'procedural'],
    description: 'A procedural dusk environment (sky gradient, horizon, glowing lamp and neon cards) baked to a PMREM map for the car paint\'s reflections.',
    snippet: `import { makeCarEnvironment } from '../miami-drive/car-model.js';
scene.environment = makeCarEnvironment(renderer, 0.5);   // darkness 0..1`,
    preview: { mode: 'env' },
  },
  {
    id: 'miami-hotel-signs', name: 'Hotel lettering atlas', category: 'sign', module: 'samples/miami-drive/building-materials.js', export: 'signAtlas', usedBy: ['miami-drive'],
    tags: ['signs', 'lettering', 'art deco', 'atlas', 'canvas'],
    description: 'Canvas atlas of invented hotel names in two styles (cream canopy fascia, coloured roof board) with an emissive map, for the Miami drive\'s buildings.',
    snippet: `import * as THREE from 'three';
import { signAtlas } from '../miami-drive/building-materials.js';
const atlas = signAtlas();
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), atlas.material);
scene.add(sheet);`,
    preview: { mode: 'flat' },
  },
  {
    id: 'miami-car-audio', name: 'Petrol car sound', category: 'sound', module: 'samples/miami-drive/audio.js', export: 'CarAudio', usedBy: ['miami-drive'],
    tags: ['car', 'engine', 'turbo', 'tyres', 'surf', 'synth'],
    description: 'The Miami drive\'s synthesised car: engine with firing pulses and intake, turbo whistle and blow-off, tyre squeal, road and wind noise, surf, plus thumps, knocks and backfires.',
    snippet: `import { CarAudio } from '../miami-drive/audio.js';
const audio = new CarAudio({ volume: 0.7 });
audio.bus.unlockOnGesture();                 // starts on the first click / key
// every frame: audio.update(dt, { rpm: 3000, throttle: 0.6, speed: 20, slip: 0, grounded: true, surface: 'asphalt', beach: 0, gear: 3 });`,
    preview: { mode: 'card', label: 'Sound', note: 'Synthesised in code' },
  },
);

const MIAMI_PROPS = { cone: 'Traffic cone', bin: 'Litter bin', crate: 'Wooden crate', box: 'Cardboard box', chair: 'Cafe chair', table: 'Cafe table with parasol', lounger: 'Beach lounger', parasol: 'Beach umbrella' };
for (const [type, name] of Object.entries(MIAMI_PROPS)) {
  CODE_ENTRIES.push({
    id: `miami-prop-${type}`, name, category: 'prop', module: 'samples/miami-drive/props.js', export: 'Props', usedBy: ['miami-drive'],
    tags: ['physics', 'dynamic', 'knock over', 'beach', type],
    description: `${name}: a physics prop of the Miami drive (built in code, vertex coloured, one instanced mesh per type) that the car can knock over. Props needs the engine's PhysicsWorld for ground height and runs its own DynamicsWorld.`,
    snippet: `import { PhysicsWorld } from '@vibe/engine/physics';
import { Props } from '../miami-drive/props.js';
const physics = new PhysicsWorld({ groundLevel: 0 });
const props = new Props({ scene, physics, spots: [{ type: '${type}', x: 0, z: 0, yaw: 0.5 }], lod: 'high' });
props.render();
// every frame: props.step(dt); props.render();`,
    preview: { az: 35, el: 20 },
  });
}

// ------------------------------------------------------------------------------------------------ Night NYC drive
const NYC_STUB = `const world = {                      // the bits of a MapWorld this builder reads
  data: { buildings: [{ p: [[-12, -8], [12, -8], [12, 8], [-12, 8]], h: 48 }] },
  raster: { any: () => true }, getGroundHeight: () => 0, colliders: { add() {} },
};`;
CODE_ENTRIES.push(
  {
    id: 'nyc-steam', name: 'Street steam', category: 'effect', module: 'samples/nyc-night/steam.js', export: 'Steam', usedBy: ['nyc-night'],
    tags: ['steam', 'particles', 'manhole', 'smoke', 'stack'],
    description: 'Steam from manholes and orange-and-white steam stacks, as engine particles (GPU when available), tinted by nearby lamps and signs.',
    snippet: `import { Steam } from '../nyc-night/steam.js';
const steam = new Steam({ scene, renderer, gpu: false, vents: [{ x: 0, y: 0, z: 0, stack: true }], lights: [], lamps: [] });
steam.preroll(4, camera);
// every frame: steam.update(dt, camera);`,
    preview: { frames: 30, target: [0, 2.6, 0], dist: 13, el: 8 },
  },
  {
    id: 'nyc-signage', name: 'Neon and LED signs', category: 'sign', module: 'samples/nyc-night/signage.js', export: 'buildSignage', usedBy: ['nyc-night'],
    tags: ['neon', 'led screen', 'billboard', 'marquee', 'shop sign', 'animated', 'times square'],
    description: 'Times Square signage built in code: giant LED screen stacks, corner wraps, rooftop screens, theatre marquees, neon shop fascias, blade signs and a news ticker, all animated in one shader from a painted atlas (every brand and show invented). It places them on the street-facing walls of the buildings it is given.',
    snippet: `import { buildSignage, updateSignage } from '../nyc-night/signage.js';
${NYC_STUB}
const signs = buildSignage({ world, square: { x: 0, z: 0 }, squareRadius: 60, shopRadius: 60 });
scene.add(signs.group);
// every frame: updateSignage(signs, t);`,
    preview: { frames: 4, studio: true, az: 20, el: 8 },
  },
  {
    id: 'nyc-sign-atlas', name: 'Times Square sign atlas', category: 'sign', module: 'samples/nyc-night/signage.js', export: 'buildSignAtlas', usedBy: ['nyc-night'],
    tags: ['neon', 'led', 'marquee', 'atlas', 'canvas'],
    facts: { size: '2048 x 2048 canvas', content: '12 LED ads, 4 theatre marquees, 16 shop fascias, 16 blade signs' },
    description: 'The painted atlas behind the Night NYC drive\'s signs: LED ads, theatre marquees, neon shop fascias and vertical blades (all names invented).',
    snippet: `import * as THREE from 'three';
import { buildSignAtlas } from '../nyc-night/signage.js';
const atlas = buildSignAtlas();
const map = new THREE.CanvasTexture(atlas.canvas);
map.colorSpace = THREE.SRGBColorSpace;
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map }));
scene.add(sheet);`,
    preview: { mode: 'flat', studio: false },
  },
  {
    id: 'nyc-shop-interiors', name: 'Shop interiors atlas', category: 'texture', module: 'samples/nyc-night/signage.js', export: 'buildShopAtlas', usedBy: ['nyc-night'],
    tags: ['shop', 'interior', 'window', 'atlas', 'canvas'],
    description: 'Eight shop interiors painted in code (deli, cafe, clothes, pharmacy, electronics, bar, pizza, lobby): the fallback for the parallax shop windows when the panoramas do not load.',
    snippet: `import * as THREE from 'three';
import { buildShopAtlas } from '../nyc-night/signage.js';
const atlas = buildShopAtlas();
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: atlas.texture }));
scene.add(sheet);`,
    preview: { mode: 'flat', studio: false },
  },
  {
    id: 'nyc-rooftops', name: 'Rooftop plant', category: 'building', module: 'samples/nyc-night/rooftops.js', export: 'buildRooftops', usedBy: ['nyc-night'],
    tags: ['rooftop', 'hvac', 'antenna', 'satellite dish', 'bulkhead', 'parapet'],
    description: 'Rooftop clutter built in code for the buildings it is given: mechanical penthouses, stair bulkheads, HVAC boxes, parapets, antenna masts with beacons, satellite dishes and sign frames (two instanced draws).',
    snippet: `import { buildRooftops } from '../nyc-night/rooftops.js';
${NYC_STUB}
const roofs = buildRooftops({ world, scene, center: { x: 0, z: 0 }, radius: 100, ac: 0 });`,
    preview: { az: 35, el: 30 },
  },
  {
    id: 'nyc-water-tower', name: 'Rooftop water tank', category: 'building', module: 'samples/nyc-night/structures.js', export: 'buildStructures', usedBy: ['nyc-night'],
    tags: ['water tower', 'water tank', 'rooftop', 'new york', 'sidewalk shed'],
    description: 'New York wooden water tanks on steel legs (and green sidewalk sheds, given street facades), built in code and placed on 30 % of the mid-rise roofs it is given.',
    snippet: `import { buildStructures } from '../nyc-night/structures.js';
const world = { data: { buildings: [] }, getGroundHeight: () => 0, colliders: { add() {} } };
for (let i = 0; i < 12; i++) world.data.buildings.push({ p: [[i * 30, 0], [i * 30 + 14, 0], [i * 30 + 14, 14], [i * 30, 14]], h: 30 });
buildStructures({ world, scene, square: { x: 165, z: 7 }, radius: 400, towers: 1, sheds: 0 });`,
    preview: { az: 35, el: 14, zoom: 1 },
  },
  {
    id: 'nyc-shop-fronts', name: 'Shop fronts and lobbies', category: 'building', module: 'samples/nyc-night/groundfloors.js', export: 'buildGroundFloors', usedBy: ['nyc-night'],
    tags: ['storefront', 'awning', 'roller shutter', 'revolving door', 'lobby', 'canopy'],
    description: 'Ground floors built in code along the shop bays that buildSignage finds: open shop fronts with recessed doors and awnings, roller shutters, service doors, loading docks, lobbies with canopies and revolving doors, and wall clutter (standpipes, drainpipes, cameras, wall lights).',
    snippet: `import { buildSignage } from '../nyc-night/signage.js';
import { buildGroundFloors } from '../nyc-night/groundfloors.js';
${NYC_STUB}
const signs = buildSignage({ world, square: { x: 0, z: 0 }, squareRadius: 60, shopRadius: 60 });
const ground = buildGroundFloors({ world, scene, signs, center: { x: 0, z: 0 }, radius: 100 });`,
    preview: { az: 25, el: 10 },
  },
  {
    id: 'nyc-city-env', name: 'City night environment (procedural)', category: 'environment', module: 'samples/nyc-night/wet.js', export: 'makeCityEnv', usedBy: ['nyc-night'],
    tags: ['environment', 'night', 'city lights', 'pmrem', 'procedural'],
    description: 'A night-city reflection environment painted in code (sodium band, coloured light blobs), the fallback when the night panorama does not load.',
    snippet: `import { makeCityEnv } from '../nyc-night/wet.js';
scene.environment = scene.background = makeCityEnv(renderer);`,
    preview: { mode: 'env' },
  },
  {
    id: 'nyc-night-lut', name: 'NYC night grade', category: 'grade', module: 'samples/nyc-night/look.js', export: 'nightLut', usedBy: ['nyc-night'],
    tags: ['lut', 'night', 'grade', 'post'],
    description: 'The Night NYC drive\'s colour grade as a LUT built in code: a long toe, warm hues kept, cool hues desaturated (look.js also has the matching night sky, looks and PostFX grade keyframes).',
    snippet: `import { nightLut } from '../nyc-night/look.js';
const lut = nightLut();
// then: new PostFX(renderer, scene, camera, { ..., lut: { texture: lut.texture, size: lut.size, strength: 1 } })`,
    preview: { mode: 'lut', result: 'lut' },
  },
  {
    id: 'nyc-night-sky', name: 'NYC night sky', category: 'sky', module: 'samples/nyc-night/look.js', export: 'cityNightSky', usedBy: ['nyc-night'],
    tags: ['sky', 'night', 'light pollution', 'stars'],
    description: 'The engine sky retuned for a city night: light-polluted horizon, few stars, darker zenith (cityNightSky plus nightLooks for fog and ambient).',
    snippet: `import { Atmosphere } from '@vibe/engine/render';
import { cityNightSky, nightLooks, NYC_SUN } from '../nyc-night/look.js';
const atmo = new Atmosphere({ scene, renderer, camera, timeOfDay: 22, sun: NYC_SUN, looks: nightLooks() });
cityNightSky(atmo);
// every frame: atmo.update(camera.position, dt);`,
    preview: { mode: 'sky', result: 'atmo', frames: 6 },
  },
);

// ------------------------------------------------------------------------------------------------ not reusable as is
const notReusable = (o) => ({ reusable: false, snippet: null, preview: { mode: 'card', label: CATEGORIES[o.category], note: 'Not reusable as is' }, ...o });
CODE_ENTRIES.push(
  notReusable({ id: 'nyc-window-kit', name: 'Window frames and AC units', category: 'building', module: 'samples/nyc-night/windowkit.js', export: 'buildWindowKit', usedBy: ['nyc-night'], tags: ['windows', 'sash', 'air conditioner'], reason: 'reads a loaded MapWorld\'s private building footprints and style (world._footprints, world._bopts)', description: 'Sash window frames, open and boarded windows and window AC units, laid out to match the engine\'s facade windows.' }),
  notReusable({ id: 'nyc-crowns', name: 'Tower crowns', category: 'building', module: 'samples/nyc-night/crowns.js', export: 'buildCrowns', usedBy: ['nyc-night'], tags: ['skyscraper', 'crown', 'art deco', 'spire'], reason: 'reads a loaded MapWorld\'s footprints and draws with its facade material set (world._footprints, world.mat.facadeSet)', description: 'Skyscraper tops: glass setbacks with mechanical screens, pre-war wedding cakes with copper pyramids, lanterns and turrets, masts with beacons.' }),
  notReusable({ id: 'nyc-facade-grade', name: 'Facade grade and wall dressing', category: 'building', module: 'samples/nyc-night/facades.js', export: 'gradeFacades', usedBy: ['nyc-night'], tags: ['facade', 'weathering', 'shader patch'], reason: 'string-patches the engine\'s facade shader of a loaded MapWorld (gradeFacades, dressWalls in walls.js, quietBuildingSigns in signage.js)', description: 'Canyon ambient grade, lamp wash, sparse lit windows, rain streaks, soot and sill stains on the engine\'s building facades.' }),
  notReusable({ id: 'nyc-street-surface', name: 'Street surface wear and wet streets', category: 'road', module: 'samples/nyc-night/streetsurface.js', export: 'makeStreetSurface', usedBy: ['nyc-night'], tags: ['asphalt', 'cracks', 'puddles', 'sidewalk flags'], reason: 'patches the engine road and sidewalk materials of a loaded MapWorld and reads its road network (makeStreetSurface, wearTactile; makeStreetsWet in wet.js)', description: 'Cracks, tar seal, oil drips, gutter grime, worn paint, sidewalk flags, and damp asphalt with puddles.' }),
  notReusable({ id: 'nyc-street-kit-placement', name: 'Street kit placement', category: 'prop', module: 'samples/nyc-night/streetkit.js', export: 'buildStreetKit', usedBy: ['nyc-night'], tags: ['manholes', 'kerbs', 'grates', 'garbage piles'], reason: 'places the street-kit models and flat insets (manholes, grates, vault doors, kerb stones, garbage piles) along a loaded MapWorld\'s road network; the models themselves are catalogued as files (nyc-street-*)', description: 'Dresses the streets with the scanned street kit and atlas insets.' }),
  notReusable({ id: 'miami-buildings', name: 'Miami Beach buildings', category: 'building', module: 'samples/miami-drive/buildings.js', export: 'miamiBuildingsPlugin', usedBy: ['miami-drive'], tags: ['art deco', 'mid-century', 'condo tower', 'hotel'], reason: 'a MapWorld plugin: needs the world context, city.json and the world\'s facade texture arrays', description: 'Art Deco hotels, MiMo slabs, condo towers, shops and Mediterranean houses with windows, balconies, railings, lobbies and lettered signs.' }),
  notReusable({ id: 'miami-beach-dressing', name: 'Beach, huts and neon (Miami plugin)', category: 'prop', module: 'samples/miami-drive/world.js', export: 'miamiPlugin', usedBy: ['miami-drive'], tags: ['lifeguard hut', 'neon', 'sand', 'surf', 'palms'], reason: 'built inside the miamiPlugin MapWorld plugin from internal functions (hut, neonCanvas, coconutPalms, decoFrontage, sandMaterial); world.js also reads import.meta.env at load', description: 'Lifeguard huts, neon blade signs and marquees, deco frontage trim, beach sand with a wet band, surf foam, dune grass and the cheaper far coconut palms.' }),
  notReusable({ id: 'miami-dusk-grade', name: 'Miami dusk grade', category: 'grade', module: 'samples/miami-drive/main.js', symbol: 'duskLut', usedBy: ['miami-drive'], tags: ['lut', 'dusk', 'grade'], reason: 'defined inside main.js, which starts the demo when imported; about 25 lines to copy (lutFromFunction + DEFAULT_GRADE)', description: 'The Miami drive\'s dusk LUT and PostFX grade keyframes.' }),
  notReusable({ id: 'miami-car-effects', name: 'Car effects (skids, smoke, sparks, backfire)', category: 'effect', module: 'samples/miami-drive/car.js', export: 'HeroCar', usedBy: ['miami-drive'], tags: ['skid marks', 'tyre smoke', 'sparks', 'exhaust', 'backfire'], reason: 'part of the HeroCar rig, which needs a driven car (engine VehicleController + PhysicsWorld); the particle presets are a few lines in car.js to copy', description: 'Skid marks (DecalTrail), tyre smoke, sparks, exhaust and backfire flames (ParticleSystem), light pools and a tail glow.' }),
);
