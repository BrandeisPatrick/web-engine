// The nyc-night city for the renderer comparison, built with the engine's world code (MapWorld) and the sample's own
// geometry builders, the way samples/nyc-night/main.js builds it on the desktop tier, then reduced to plain built-in
// materials that both three.js renderers draw (plainScene). What the comparison leaves out, and why:
//   - traffic, pedestrians, the walker, steam, air glow, wet streets: they move or need per-frame engine updates;
//   - streaming: off (every tile built at load, the scene never changes between renderers or poses);
//   - the Atmosphere (sky shader, cascaded shadows, fog) and clustered lights: replaced by plainLights();
//   - every ShaderMaterial / RawShaderMaterial mesh, Points, Lines and Sprites: dropped and counted (no built-in twin).
// MapWorld needs a WebGLRenderer while it builds (PBR texture loading, the Atmosphere); the page builds with a
// throw-away one and loses its context before the measured renderer is made.
import * as THREE from 'three';
import { MapWorld } from '@vibe/engine/world';
import { TextureSets } from '@vibe/engine/render';
import { buildSignage, quietBuildingSigns } from '../../samples/nyc-night/signage.js';
import { buildStructures } from '../../samples/nyc-night/structures.js';
import { buildGroundFloors, Kit, groundMaterial, kitMeshes } from '../../samples/nyc-night/groundfloors.js';
import { buildWindowKit } from '../../samples/nyc-night/windowkit.js';
import { buildCrowns } from '../../samples/nyc-night/crowns.js';
import { buildRooftops } from '../../samples/nyc-night/rooftops.js';
import { duskLooks, NYC_SUN, DUSK_HOURS } from '../../samples/nyc-night/look.js';

const BASE = import.meta.env.BASE_URL;
const NYC = `${BASE}nyc/`;
const DEG = Math.PI / 180, R_EARTH = 6378137;

/** Build the city into a new scene. Returns { scene, world, offset, buildMs }. */
export async function buildCity() {
  const t0 = performance.now();
  TextureSets.configure({ base: `${NYC}textures/`, manifestIds: true, maxAnisotropy: 8 }); // as nyc-night's desktop tier
  const canvas = document.createElement('canvas');
  const helper = new THREE.WebGLRenderer({ canvas, antialias: false });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 3200);
  const world = new MapWorld({
    scene, renderer: helper,
    data: { mapUrl: `${NYC}map/city.json`, farlandUrl: false }, terrain: false, filler: true, timeOfDay: DUSK_HOURS,
    atmosphere: { camera, sun: NYC_SUN, looks: duskLooks('open'), shadows: { cascades: 1 } },
    spawn: { road: /^7th Avenue$/ },
    buildings: { style: { oldProb: () => 0.42, victorianProb: () => 0.01, storeProb: { prewar: 1, other: 0.95, curtain: 0.92, anyType: true }, storeDressing: false } },
    traffic: false, streaming: false, physics: true, pbrSize: 1024,
  });
  await world.load(() => {});
  const data = world.data, C = data.center, COS0 = Math.cos(C.lat * DEG);
  const SQUARE = { x: (-73.9857 - C.lon) * DEG * R_EARTH * COS0 - world.offset.x, z: -(40.7576 - C.lat) * DEG * R_EARTH - world.offset.z };
  // the sample's builders, desktop-tier arguments (no interiors: the shop fronts' parallax rooms are shader-only)
  quietBuildingSigns(world);
  const signs = buildSignage({ world, square: SQUARE, squareRadius: 210, shopRadius: 560, maxScreens: 90, lightScale: 0.6, interiors: [] });
  scene.add(signs.group);
  const kit = new Kit(), mat = groundMaterial();
  const ground = buildGroundFloors({ world, scene, signs, kit, material: mat, center: SQUARE, radius: 220, lobbyIndex: 0, clutter: 1 });
  buildWindowKit({ world, scene, kit, material: mat, center: SQUARE, frameRadius: 150, acRadius: 230, frames: true });
  ground.group.add(kitMeshes(kit, mat, { center: SQUARE }));
  const crowns = buildCrowns({ world, scene, center: SQUARE, radius: 950, max: 400 });
  buildStructures({ world, scene, square: SQUARE, skip: crowns.crowned, facades: signs.facades, lights: signs.lights, towers: 90, sheds: 14 });
  buildRooftops({ world, scene, center: SQUARE, skip: crowns.crowned, facades: signs.facades, max: 900, ac: 0 });
  // keep the world's geometry and the builders' groups; the Atmosphere's sky, lights and helpers go
  const city = new THREE.Scene();
  for (const o of [...scene.children]) if (!o.isLight && o !== world.atmo.sky && !(o.material && o.material.isShaderMaterial && o.frustumCulled === false)) city.add(o);
  helper.dispose(); helper.forceContextLoss();
  return { scene: city, world, offset: { x: world.offset.x, z: world.offset.z }, buildMs: Math.round(performance.now() - t0) };
}

const keep = ['color', 'map', 'roughness', 'metalness', 'roughnessMap', 'metalnessMap', 'normalMap', 'normalScale', 'emissive', 'emissiveMap', 'emissiveIntensity',
  'aoMap', 'alphaMap', 'alphaTest', 'transparent', 'opacity', 'side', 'vertexColors', 'depthWrite', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits'];
/**
 * Replace every material with a plain built-in one (MeshBasicMaterial stays basic, every other mesh material becomes
 * MeshStandardMaterial with the original's colour, maps, roughness, metalness...): no onBeforeCompile, defines or
 * shader patches. Meshes whose material has no built-in twin, Points, Lines and Sprites are removed.
 * Returns { kept, dropped: { [reason]: count }, droppedNames: string[] }.
 */
export function plainScene(scene) {
  const cache = new Map(), dropped = {}, names = new Set(), out = [];
  let kept = 0, fixedInstanceCounts = 0, widened = 0;
  const conv = (m) => {
    if (cache.has(m)) return cache.get(m);
    let r = null;
    if (!m.isShaderMaterial && (m.isMeshBasicMaterial || m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) {
      r = m.isMeshBasicMaterial ? new THREE.MeshBasicMaterial() : new THREE.MeshStandardMaterial();
      for (const k of keep) if (m[k] !== undefined && k in r) { const v = m[k]; r[k] = v && v.isColor ? v.clone() : v && v.isVector2 ? v.clone() : v; }
      if (!m.isMeshStandardMaterial && !m.isMeshBasicMaterial) { r.roughness = 0.8; r.metalness = 0; }
      for (const k of ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'emissiveMap', 'aoMap', 'alphaMap']) if (r[k] && r[k].isRenderTargetTexture) r[k] = null;
      r.name = m.name;
    }
    cache.set(m, r);
    return r;
  };
  scene.traverse((o) => {
    const why = o.isPoints ? 'Points' : o.isLine ? 'Line' : o.isSprite ? 'Sprite' : null;
    if (why) { out.push([o, why]); return; }
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material], c = mats.map(conv);
    if (c.some((x) => !x)) { const m = mats[c.findIndex((x) => !x)]; out.push([o, m.type]); names.add(`${o.name || '(unnamed)'}: ${m.type}${m.name ? ` ${m.name}` : ''}`); return; }
    o.material = Array.isArray(o.material) ? c : c[0];
    // WebGLRenderer draws an InstancedBufferGeometry left at instanceCount Infinity with as many instances as its
    // instanced attributes hold; WebGPURenderer passes Infinity to the draw call and throws: give it the same count
    const g = o.geometry;
    // WebGPU needs every vertex buffer stride to be a multiple of 4 bytes: an 8-bit RGB colour (3 bytes) makes the
    // pipeline invalid, and with it the whole frame's command buffer. Such attributes become Float32 for every renderer.
    for (const [k, a] of Object.entries(g.attributes)) {
      if (a.isInterleavedBufferAttribute || (a.itemSize * a.array.BYTES_PER_ELEMENT) % 4 === 0) continue;
      const div = a.normalized ? (a.array instanceof Uint8Array ? 255 : a.array instanceof Int8Array ? 127 : a.array instanceof Uint16Array ? 65535 : 32767) : 1;
      const f = new (a.isInstancedBufferAttribute ? THREE.InstancedBufferAttribute : THREE.BufferAttribute)(Float32Array.from(a.array, (v) => v / div), a.itemSize);
      if (a.isInstancedBufferAttribute) f.meshPerAttribute = a.meshPerAttribute;
      g.setAttribute(k, f); widened++;
    }
    if (g.isInstancedBufferGeometry && !Number.isFinite(g.instanceCount)) {
      g.instanceCount = Math.min(...Object.values(g.attributes).filter((a) => a.isInstancedBufferAttribute || (a.data && a.data.isInstancedInterleavedBuffer)).map((a) => a.count));
      fixedInstanceCounts++;
    }
    o.onBeforeRender = THREE.Object3D.prototype.onBeforeRender;
    o.castShadow = true; o.receiveShadow = true;
    kept++;
  });
  for (const [o, why] of out) { dropped[why] = (dropped[why] || 0) + 1; o.removeFromParent(); }
  return { kept, fixedInstanceCounts, widenedAttributes: widened, materials: new Set([...cache.values()].filter(Boolean)).size, dropped, droppedNames: [...names].sort() };
}

/** The same simple lights for every renderer: a hemisphere fill and one shadow-casting directional "moon". */
export function plainLights(scene) {
  scene.background = new THREE.Color(0x10131c);
  scene.add(new THREE.HemisphereLight(0x8090b0, 0x302820, 1.2));
  const sun = new THREE.DirectionalLight(0xffe0c0, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 1, far: 1200 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  /** Centre the shadow box on a point (call after a pose). */
  return (p) => { sun.target.position.set(p.x, 0, p.z); sun.position.set(p.x + 300, 500, p.z + 200); sun.updateMatrixWorld(); sun.target.updateMatrixWorld(); };
}
