// Miami Beach for the drive: the baked OpenStreetMap district (samples/public/miami/map/city.json, South Beach between
// South Pointe and 16th Street with the MacArthur Causeway's east end) dressed as a Miami dusk through MapWorld's
// options and one plugin:
//   - data prep: low buildings near Ocean Drive / Collins / Washington get pastel OSM colour tags (art-deco pinks,
//     mints, aquas, lemons, peaches, lavenders), everything else whites and creams; no brick / Victorian styles
//   - palms on every street (vegetation rules + mixes), acorn lamps on Ocean Drive, cobra heads elsewhere
//   - the `miami` plugin (afterProps): neon on the hotels that face Ocean Drive (parapet tubes + vertical blade signs
//     + marquees, each name invented, drawn on a canvas atlas), a sand beach east of the boardwalk with lifeguard huts,
//     tall coconut palms along the beach, glossy wet-look asphalt (puddle mask over the road material's roughness);
//     option decoTrim: false leaves the hotels' eyebrows / porches / lobbies to buildings.js (the neon stays put)
//   - extra lights: the plugin owns a slot list after the lamps in the world's ClusteredLights (desktop); neon,
//     the car's lamps (car.js) and anything else register with `lights.set(...)` each frame. Phones (no clustered
//     lights): neon and car tail-light glow are emissive + additive ground splashes only.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MapWorld } from '@vibe/engine/world';
import { buildDuneRoad } from './dune-road.js';

const BASE = import.meta.env.BASE_URL;
export const MIAMI_MAP_URL = `${BASE}miami/map/city.json`;

// ------------------------------------------------------------------ sun model: a Miami summer day (rise 6:30, set 20:15)
// Art-directed azimuth: the real June sun sets at ~297 deg (WNW), behind the hotel row of Ocean Drive, which runs
// 11 deg east of north. This sun sets at ~350 deg, at the north end of the strip, so the drive up Ocean Drive (and
// the 'chase' reference pose) looks straight into the afterglow. Elevation and timing are Miami's.
export const MIAMI_SUN = { rise: 6.5, set: 20.25, maxElevation: 87, nightDepth: 40, nightRate: 14, azimuthStart: 120, azimuthSpan: 228 };
export const MIAMI_PRESETS = { dawn: 6.8, morning: 9, noon: 13.2, afternoon: 16.5, golden: 19.4, sunset: 20.1, dusk: 20.42, night: 22.5 };

const PASTEL = ['#f6b8c8', '#a9e5d0', '#9ed6e6', '#f7e39a', '#f7c39c', '#cdb7ee', '#f3a7a0', '#b6e3a8', '#8fd3d0', '#fbd2df'];
const WHITE = ['#f6f1e6', '#efe8da', '#f9f6f0', '#e9e3d6', '#f2ece0'];
export const DECO_ROADS = /^(Ocean Drive|Collins Avenue|Washington Avenue|Española Way|Espanola Way)$/;

/** Hotel / diner names on the neon (invented). */
export const NEON_NAMES = [
  'AZURINE', 'CORALINE', 'MOONGLOW', 'SUNDIAL', 'VELVET TIDE', 'MARISOL', 'LA SIRENA', 'ORCHID', 'NEPTUNE', 'SEAGLASS',
  'PALOMA', 'LUNA AZUL', 'STARFISH', 'TIDEWATER', 'BAHIA', 'SOLANA', 'MANGO', 'CABANA', 'HIBISCUS', 'MIRAMAR',
];
// the reference's palette: warm white, red and amber, with one accent (a rose pink) used sparingly
const NEON_COLORS = [[1, 0.8, 0.58], [1, 0.16, 0.08], [1, 0.48, 0.12], [1, 0.8, 0.58], [1, 0.62, 0.3], [1, 0.16, 0.08], [1, 0.24, 0.42]];

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function distToPolylines(x, z, lines) {
  let best = Infinity, bi = -1, bs = 0;
  for (let li = 0; li < lines.length; li++) {
    const P = lines[li];
    for (let i = 0; i < P.length - 1; i++) {
      const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) { best = d; bi = li; bs = i + t; }
    }
  }
  return { d: best, line: bi, s: bs };
}
const centroidOf = (ring) => { let x = 0, z = 0; for (const p of ring) { x += p[0]; z += p[1]; } return [x / ring.length, z / ring.length]; };

/** Paint the map: pastel deco near the strip, whites elsewhere (OSM colour tags MapWorld lerps the facade tint to). */
export function prepareMiamiData(data) {
  const deco = data.roads.filter((r) => r.n && DECO_ROADS.test(r.n) && r.c !== 'footway').map((r) => r.p);
  // the beach behind the boardwalk stays open (the Dune Road runs there): no OSM trees east of the beach walks
  const walks = data.roads.filter((r) => r.n && /Boardwalk|Sandwalk/.test(r.n)).map((r) => r.p);
  if (walks.length) {
    const walkX = (z) => { let wx = -Infinity; for (const pl of walks) for (let i = 0; i < pl.length - 1; i++) { const a = pl[i], b = pl[i + 1]; if ((a[1] - z) * (b[1] - z) > 0) continue; const t = (z - a[1]) / ((b[1] - a[1]) || 1e-6); wx = Math.max(wx, a[0] + (b[0] - a[0]) * t); } return wx; };
    data.trees = data.trees.filter((t) => { const wx = walkX(t[1]); return !(Number.isFinite(wx) && t[0] > wx - 10); });
    // nor the park fill of the beach-side parks (Lummus Park): the road's landscape is open scrub and dune, with a
    // few palms of our own
    const before = data.parks.length;
    data.parks = data.parks.filter((pk) => {
      if (!pk || !pk.p || pk.p.length < 3) return true;
      let cx = 0, cz = 0; for (const q of pk.p) { cx += q[0]; cz += q[1]; } cx /= pk.p.length; cz /= pk.p.length;
      const wx = walkX(cz);
      return !(Number.isFinite(wx) && cx > wx - 60);
    });
    data._beachParksDropped = before - data.parks.length;
  }
  // Ocean Drive as a two-lane, two-way street (the drive runs north along it; OSM has it one-way southbound)
  for (const r of data.roads) if (r.n === 'Ocean Drive' && r.c !== 'footway' && r.o) { delete r.o; r.l = Math.max(2, r.l || 2); }
  for (const b of data.buildings) {
    if (!b.p || b.p.length < 3) continue;
    const [cx, cz] = centroidOf(b.p);
    const r = rnd(hash(`${cx.toFixed(1)},${cz.toFixed(1)}`));
    const near = deco.length ? distToPolylines(cx, cz, deco).d : Infinity;
    if (!b.c) b.c = near < 70 && b.h < 30 ? PASTEL[Math.floor(r() * PASTEL.length)] : WHITE[Math.floor(r() * WHITE.length)];
    if (!b.rc) b.rc = '#d9d4c8';
    b.m = ''; // stucco everywhere (no brick / stone hints)
  }
  return data;
}

/** MapWorld options for the tier (q = resolveQuality() settings). */
export function miamiWorldOptions({ scene, renderer, map, q, timeOfDay, plugins, camera }) {
  const W = q.world;
  return {
    scene, renderer,
    data: { map, farlandUrl: false },
    terrain: false,                                   // Miami Beach is flat (1-2 m): the flat ground is right
    timeOfDay,
    atmosphere: {
      sun: MIAMI_SUN, timePresets: MIAMI_PRESETS, camera,
      shadows: { ...q.shadows, near: 45, far: [200, 420, 650] },
      cloudWind: [6, 2],
    },
    pbrSize: q.textures.maxSize >= 2048 ? 1024 : 512,
    // Ocean Drive between 8th and 9th Street, northbound (bake frame: x east, z south), the deco district
    spawn: { at: { x: 550.4, z: -9.6, heading: -0.1948, name: 'Ocean Drive' } },
    buildings: { style: { oldProb: () => 0, victorianProb: () => 0, namedRe: /^$/ } },
    props: {
      seed: 305,
      streets: {
        lampStyle: (name) => (/^Ocean Drive$/.test(name) ? 'acorn' : /^(Collins Avenue|Washington Avenue|5th Street)$/.test(name) ? 'cobra' : null),
        promenade: (name) => /^Ocean Drive$/.test(name),
        utilityPoles: () => false,
      },
    },
    vegetation: {
      rules: [{ road: () => true, species: 'palm', share: 0.86, other: 'round', radius: 40 }],
      mix: {
        residential: [['palm', 0.7], ['round', 0.3]], minor: [['palm', 0.75], ['round', 0.25]], major: [['palm', 0.9], ['round', 0.1]],
        osm: [['palm', 0.75], ['round', 0.25]], park: [['palm', 0.6], ['round', 0.4]], garden: [['palm', 0.7], ['round', 0.3]],
        open: [['palm', 0.7], ['round', 0.3]], forest: [['palm', 0.5], ['round', 0.5]],
      },
    },
    traffic: W.traffic > 0 ? { count: W.traffic, seed: 11, hd: W.trafficHd || false } : false,
    streaming: { radius: W.streamRadius, spawnRadius: Math.min(500, W.streamRadius) },
    lights: q.lights.clustered ? {
      clustered: true, clusteredRange: q.lights.clusteredRange,
      cluster: { maxLights: 1024, zFar: 420, cutoff: q.lights.cutoff || 0 },
    } : undefined,
    water: q.postfx.gbuffer ? { refraction: true } : undefined,
    physics: true,
    plugins,
  };
}

// ------------------------------------------------------------------ extra lights (after the lamps in the cluster list)
/**
 * A small list of demo lights written into world.clustered after the lamp lights every frame (the lamp pool owns
 * indices 0..pushed-1 and resets the count when it refills). Each slot: set(i, x, y, z, range, r, g, b) or
 * spot(i, ..., dx, dy, dz, cosInner, cosOuter); slots not set this frame are cleared.
 */
export class ExtraLights {
  constructor(max = 160) {
    this.max = max; this.n = 0;
    this.d = new Float32Array(max * 14); this.on = new Uint8Array(max); this.spotF = new Uint8Array(max);
    this.base = 0; this.used = 0;
  }
  set(i, x, y, z, range, r, g, b) { const o = i * 14, d = this.d; d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = range; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; this.on[i] = 1; this.spotF[i] = 0; this.n = Math.max(this.n, i + 1); }
  spot(i, x, y, z, range, r, g, b, dx, dy, dz, ci, co) { this.set(i, x, y, z, range, r, g, b); const o = i * 14, d = this.d; d[o + 7] = dx; d[o + 8] = dy; d[o + 9] = dz; d[o + 10] = ci; d[o + 11] = co; this.spotF[i] = 1; }
  off(i) { this.on[i] = 0; }
  /** Write into the cluster list after the lamps (call inside world.update, after the props). */
  flush(world) {
    const C = world.clustered;
    if (!C || !world.props || !world.props.lightPool) return;
    const base = world.props.lightPool.mode === 'clustered' ? world.props.lightPool.pushed : 0;
    // clear what we wrote last frame beyond the lamps (if the lamp count shrank, the pool already reset them)
    let k = base;
    const d = this.d;
    for (let i = 0; i < this.n; i++) {
      if (!this.on[i]) continue;
      const o = i * 14;
      if (this.spotF[i]) C.setSpot(k, d[o], d[o + 1], d[o + 2], d[o + 3], d[o + 4], d[o + 5], d[o + 6], 2, d[o + 7], d[o + 8], d[o + 9], d[o + 10], d[o + 11]);
      else C.setLight(k, d[o], d[o + 1], d[o + 2], d[o + 3], d[o + 4], d[o + 5], d[o + 6], 2);
      k++;
    }
    for (let i = k; i < base + this.used; i++) C.clearLight(i);
    this.used = k - base;
    this.base = base;
  }
}

// ------------------------------------------------------------------ neon signs (canvas atlas)
function neonCanvas(names, vertical) {
  if (typeof document === 'undefined') return null;
  const cellW = vertical ? 128 : 512, cellH = vertical ? 512 : 128, cols = vertical ? 8 : 2;
  const rows = Math.ceil(names.length / cols);
  const c = document.createElement('canvas'); c.width = cellW * cols; c.height = cellH * rows;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  names.forEach((name, i) => {
    const x0 = (i % cols) * cellW, y0 = Math.floor(i / cols) * cellH;
    g.save(); g.translate(x0, y0);
    // backing plate (dark enamel with a thin border tube), then the letters as neon: wide soft glow + white core
    g.fillStyle = '#0a0a10'; g.fillRect(6, 6, cellW - 12, cellH - 12);
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.strokeRect(14, 14, cellW - 28, cellH - 28);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (vertical) {
      const letters = name.replace(/\s+/g, '').slice(0, 9).split('');
      const step = (cellH - 60) / Math.max(letters.length, 6);
      g.font = `bold ${Math.floor(step * 0.86)}px "Futura", "Avenir Next", "Trebuchet MS", sans-serif`;
      letters.forEach((ch, k) => {
        const y = 30 + step * (k + 0.5) + ((cellH - 60) - step * letters.length) / 2;
        g.shadowColor = '#fff'; g.shadowBlur = 10; g.fillText(ch, cellW / 2, y);
        g.shadowBlur = 0; g.fillText(ch, cellW / 2, y);
      });
    } else {
      g.font = `italic bold 64px "Brush Script MT", "Snell Roundhand", "Georgia", serif`;
      const t = name.charAt(0) + name.slice(1).toLowerCase();
      g.shadowColor = '#fff'; g.shadowBlur = 12; g.fillText(t, cellW / 2, cellH / 2 + 4);
      g.shadowBlur = 0; g.lineWidth = 2; g.strokeText(t, cellW / 2, cellH / 2 + 4);
    }
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, cols, rows };
}

/** Neon material: the atlas is a white mask, coloured per instance; flicker and dusk fade from uniforms. */
function neonMaterial(atlas, cols, rows) {
  const m = new THREE.MeshBasicMaterial({ map: atlas, toneMapped: true, side: THREE.DoubleSide, name: 'neon' });
  const u = { uNeon: { value: 1 }, uTime: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSign; varying vec4 vSign;') // cell index, colour index packed: x cell, yzw colour
      .replace('#include <uv_vertex>', `#include <uv_vertex>
vSign = aSign;
#ifdef USE_MAP
vMapUv = (vec2(mod(aSign.x, ${cols.toFixed(1)}), ${(rows - 1).toFixed(1)} - floor(aSign.x / ${cols.toFixed(1)})) + uv) / vec2(${cols.toFixed(1)}, ${rows.toFixed(1)});
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vSign; uniform float uNeon; uniform float uTime;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  float lum = diffuseColor.r;
  float flick = 1.0 - 0.35 * step(0.985, fract(sin(floor(uTime * 9.0) + vSign.x * 17.3) * 4375.85)) ;
  vec3 neon = vSign.yzw;
  vec3 col = mix(vec3(0.012), neon * (1.4 + 4.5 * smoothstep(0.55, 1.0, lum)) * flick, smoothstep(0.08, 0.5, lum));
  diffuseColor.rgb = mix(vec3(0.02) + neon * 0.15 * smoothstep(0.08, 0.5, lum), col, uNeon);
}`);
  };
  m.customProgramCacheKey = () => `miami-neon-${cols}-${rows}`;
  m.userData.u = u;
  return m;
}

/** A plane per sign instance (vertical blade signs both ways, flat marquees), merged into one draw. */
function signGeometry(list) {
  const geos = [];
  for (const s of list) {
    const g = new THREE.PlaneGeometry(s.w, s.h);
    const n = g.attributes.position.count, a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { a[i * 4] = s.cell; a[i * 4 + 1] = s.col[0]; a[i * 4 + 2] = s.col[1]; a[i * 4 + 3] = s.col[2]; }
    g.setAttribute('aSign', new THREE.BufferAttribute(a, 4));
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(s.yaw).setPosition(s.x, s.y, s.z));
    geos.push(g);
  }
  return geos.length ? mergeGeometries(geos) : null;
}

// ------------------------------------------------------------------ the plugin
/**
 * @param {object} o  lights: ExtraLights | null (desktop), lod: 'high' | 'low', sand: loadTextureSet() result (or null)
 */
export function miamiPlugin(o = {}) {
  const lights = o.lights || null;
  const P0huts = [];
  const P = {
    name: 'miami', signs: [], neonLights: [], group: new THREE.Group(), stats: {}, huts: [], maxLights: o.maxLights ?? 64,
    beforeBuildings(ctx) {
      // OSM maps the beach's lifeguard towers as small buildings: claim them (the generic builder would make little
      // brick blocks) and build our own huts at their spots in afterProps
      const ocean = ctx.data.roads.filter((r) => r.n === 'Ocean Drive' && r.c !== 'footway').map((r) => r.p);
      if (!ocean.length) return null;
      for (const b of ctx.data.buildings) {
        if (!b.p || b.p.length < 3) continue;
        let a = 0; for (let i = 0, j = b.p.length - 1; i < b.p.length; j = i++) a += (b.p[j][0] + b.p[i][0]) * (b.p[j][1] - b.p[i][1]);
        if (Math.abs(a) / 2 > 70) continue;
        const [cx, cz] = centroidOf(b.p);
        const near = distToPolylines(cx, cz, ocean);
        if (near.d < 45 || near.d > 260) continue;
        // east of the drive (the beach side): compare with the drive's x at that z
        const P = ocean[near.line], i = Math.min(P.length - 2, Math.floor(near.s)), t = near.s - i;
        const ox = P[i][0] + (P[i + 1][0] - P[i][0]) * t;
        if (cx < ox) continue;
        b._lm = 'miami-hut';
        P0huts.push({ x: cx, z: cz });
      }
      return null;
    },
    afterProps(ctx) {
      const { data, groundAt, world } = ctx;
      const t0 = performance.now();
      const ocean = data.roads.filter((r) => r.n === 'Ocean Drive' && r.c !== 'footway' && r.c !== 'path').map((r) => r.p);
      const strip = data.roads.filter((r) => r.n && /^(Collins Avenue|Washington Avenue)$/.test(r.n)).map((r) => r.p);
      const signs = [], tubes = [], deco = [], lobbies = [];
      let nameI = 0;
      const pick = (seed) => NEON_COLORS[seed % NEON_COLORS.length];
      for (const b of data.buildings) {
        if (!b.p || b.p.length < 3 || b.h > 40 || b.h < 6) continue;
        const [cx, cz] = centroidOf(b.p);
        const dO = ocean.length ? distToPolylines(cx, cz, ocean).d : Infinity;
        const dS = strip.length ? distToPolylines(cx, cz, strip).d : Infinity;
        const onOcean = dO < 70, onStrip = !onOcean && dS < 45;
        if (!onOcean && !onStrip) continue;
        const r = rnd(hash(`neon${cx.toFixed(1)}${cz.toFixed(1)}`));
        if (onStrip && r() > 0.3) continue;
        const lines = onOcean ? ocean : strip;
        // the footprint edge nearest the street, its outward normal
        let best = null;
        const ring = b.p;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], c = ring[(i + 1) % ring.length];
          const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
          if (L < 7) continue;
          const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, d = distToPolylines(mx, mz, lines).d;
          if (!best || d < best.d) best = { a, c, L, mx, mz, d };
        }
        if (!best || best.d > 32) continue;
        const ux = (best.c[0] - best.a[0]) / best.L, uz = (best.c[1] - best.a[1]) / best.L;
        let nx = uz, nz = -ux;
        const probe = distToPolylines(best.mx + nx * 2, best.mz + nz * 2, lines).d;
        if (probe > best.d) { nx = -nx; nz = -nz; }
        const gy = groundAt(best.mx, best.mz);
        const col = pick(Math.floor(r() * 997));
        const col2 = pick(Math.floor(r() * 997) + 3);
        const h = b.h;
        // deco: "eyebrow" sun shades over each floor of the street facade, and a stepped fin over the roofline
        const floors = Math.max(1, Math.floor(h / 3.25));
        // o.decoTrim === false: the hotels' own geometry (buildings.js) has the eyebrows, porch and lobby; the same draws
        // are made so the neon lands where it did
        const trim = o.decoTrim !== false;
        if (trim) for (let k = 1; k < floors; k++) deco.push({ a: best.a, c: best.c, nx, nz, y: gy + k * 3.25 - 0.25, depth: 0.55, th: 0.09, col: [0.95, 0.93, 0.88] });
        if (onOcean) { decoFrontage(trim ? deco : [], tubes, best, ux, uz, nx, nz, gy, h, b.c, col, r); const ls = r(); if (trim) lobbies.push({ a: best.a, c: best.c, nx, nz, gy, L: best.L, seed: ls }); }
        if (r() < 0.3) {
          const e = 0.35 + r() * 0.3, fx = best.a[0] + (best.c[0] - best.a[0]) * e, fz = best.a[1] + (best.c[1] - best.a[1]) * e;
          deco.push({ fin: true, x: fx + nx * 0.25, z: fz + nz * 0.25, ux, uz, nx, nz, y0: gy + h - 5, y1: gy + h + 3.2, col: [0.97, 0.95, 0.9] });
          tubes.push({ ax: fx + nx * 0.62, az: fz + nz * 0.62, bx: fx + nx * 0.62, bz: fz + nz * 0.62, y0: gy + h - 4.6, y1: gy + h + 2.9, col: col2 });
        }
        // parapet tube along the street edge + two vertical fins at its ends
        const ty = gy + h - 0.35;
        tubes.push({ ax: best.a[0] + nx * 0.12, az: best.a[1] + nz * 0.12, bx: best.c[0] + nx * 0.12, bz: best.c[1] + nz * 0.12, y0: ty, y1: ty, col });
        if (r() < 0.3) tubes.push({ ax: best.a[0] + nx * 0.12, az: best.a[1] + nz * 0.12, bx: best.c[0] + nx * 0.12, bz: best.c[1] + nz * 0.12, y0: gy + 3.6, y1: gy + 3.6, col: col2 });
        for (const e of [0.06, 0.94]) {
          if (r() < 0.7) continue;
          const ex = best.a[0] + (best.c[0] - best.a[0]) * e + nx * 0.12, ez = best.a[1] + (best.c[1] - best.a[1]) * e + nz * 0.12;
          tubes.push({ ax: ex, az: ez, bx: ex, bz: ez, y0: gy + 4.2, y1: gy + h - 0.6, col });
        }
        const name = NEON_NAMES[nameI++ % NEON_NAMES.length];
        const yaw = Math.atan2(nx, nz); // plane normal (+z) -> outward
        const cell = NEON_NAMES.indexOf(name);
        if (onOcean && h > 9 && r() < 0.5) {
          // vertical blade sign at one end, perpendicular to the facade (read from up / down the street), both faces
          const e = r() < 0.5 ? 0.18 : 0.82;
          const bx = best.a[0] + (best.c[0] - best.a[0]) * e + nx * 0.8, bz = best.a[1] + (best.c[1] - best.a[1]) * e + nz * 0.8;
          const sh = Math.min(7.5, h - 4.5), sy = gy + 4.2 + sh / 2;
          const byaw = Math.atan2(ux, uz);
          signs.push({ kind: 'v', x: bx, y: sy, z: bz, w: sh / 4, h: sh, yaw: byaw, cell, col });
          signs.push({ kind: 'v', x: bx - ux * 0.02, y: sy, z: bz - uz * 0.02, w: sh / 4, h: sh, yaw: byaw + Math.PI, cell, col });
          P.neonLights.push({ x: bx + nx * 1.2, y: sy - 1, z: bz + nz * 1.2, col, range: 16, k: 1.2 });
        }
        // marquee over the entrance
        const mx = best.mx + nx * 0.25, mz = best.mz + nz * 0.25;
        signs.push({ kind: 'h', x: mx, y: gy + 4.6, z: mz, w: Math.min(best.L * 0.6, 7), h: Math.min(best.L * 0.6, 7) / 4, yaw, cell, col: col2, bh: h, onOcean });
        P.neonLights.push({ x: mx + nx * 2.0, y: gy + 3.6, z: mz + nz * 2.0, col: col2, range: 14, k: 1 });
        P.neonLights.push({ x: best.mx + nx * 1.5, y: ty, z: best.mz + nz * 1.5, col, range: 12, k: 0.7 });
      }
      // ---- meshes: tubes (one merged emissive mesh, per-vertex colour) and two sign atlases
      const tubeGeos = [];
      for (const t of tubes) {
        const dx = t.bx - t.ax, dz = t.bz - t.az, dy = t.y1 - t.y0, L = Math.hypot(dx, dy, dz);
        if (L < 0.5) continue;
        const g = new THREE.CylinderGeometry(0.045, 0.045, L, 6, 1, true);
        const dir = new THREE.Vector3(dx, dy, dz).normalize();
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        g.translate((t.ax + t.bx) / 2, (t.y0 + t.y1) / 2, (t.az + t.bz) / 2);
        const n = g.attributes.position.count, c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { c[i * 3] = t.col[0]; c[i * 3 + 1] = t.col[1]; c[i * 3 + 2] = t.col[2]; }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv');
        tubeGeos.push(g);
      }
      const decoGeos = [];
      for (const d of deco) {
        let g;
        if (d.box) {
          g = new THREE.BoxGeometry(d.sx, d.sy, d.sz);
          g.applyMatrix4(new THREE.Matrix4().makeRotationY(d.yaw).setPosition(d.x, d.y, d.z));
        } else if (d.cyl) {
          g = new THREE.CylinderGeometry(d.r, d.r, d.y1 - d.y0, 20, 1, false, d.a0 ?? 0, d.al ?? Math.PI * 2);
          g.applyMatrix4(new THREE.Matrix4().makeRotationY(d.yaw ?? 0).setPosition(d.x, (d.y0 + d.y1) / 2, d.z));
        } else if (d.fin) {
          g = new THREE.BoxGeometry(0.3, d.y1 - d.y0, 0.75);
          g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(d.nx, d.nz)).setPosition(d.x, (d.y0 + d.y1) / 2, d.z));
        } else {
          const L = Math.hypot(d.c[0] - d.a[0], d.c[1] - d.a[1]);
          g = new THREE.BoxGeometry(L + 0.4, d.th, d.depth);
          const mx = (d.a[0] + d.c[0]) / 2 + d.nx * d.depth / 2, mz = (d.a[1] + d.c[1]) / 2 + d.nz * d.depth / 2;
          g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(d.nx, d.nz)).setPosition(mx, d.y, mz));
        }
        g = g.toNonIndexed(); g.deleteAttribute('uv');
        const n = g.attributes.position.count, cc = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) cc.set(d.col, i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
        decoGeos.push(g);
      }
      if (decoGeos.length) {
        const dm = new THREE.Mesh(mergeGeometries(decoGeos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, name: 'decoTrim' }));
        dm.castShadow = true; dm.receiveShadow = true; dm.name = 'deco-trim'; P.group.add(dm);
      }
      if (lobbies.length) { const lm = lobbyMesh(lobbies); P.group.add(lm); P.lobbyMat = lm.material; }
      const tubeMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3.2, 3.2, 3.2), name: 'neonTube' });
      P.tubeMat = tubeMat;
      if (tubeGeos.length) { const tm = new THREE.Mesh(mergeGeometries(tubeGeos), tubeMat); tm.name = 'neon-tubes'; P.group.add(tm); }
      const vAtlas = neonCanvas(NEON_NAMES, true), hAtlas = neonCanvas(NEON_NAMES, false);
      P.signMats = [];
      for (const [kind, atlas] of [['v', vAtlas], ['h', hAtlas]]) {
        if (!atlas) continue;
        const g = signGeometry(signs.filter((s) => s.kind === kind));
        if (!g) continue;
        const m = neonMaterial(atlas.tex, atlas.cols, atlas.rows);
        P.signMats.push(m);
        const mesh = new THREE.Mesh(g, m); mesh.name = `neon-signs-${kind}`; P.group.add(mesh);
      }
      P.signs = signs;
      // merge the sign / tube lights on an 8 m grid (one light per cell at the weighted centre, colours summed): fewer
      // lights per cluster for the same glow on the street
      const cells = new Map();
      for (const L of P.neonLights) {
        const key = `${Math.floor(L.x / 8)},${Math.floor(L.z / 8)}`;
        let c = cells.get(key);
        if (!c) cells.set(key, (c = { x: 0, y: 0, z: 0, w: 0, col: [0, 0, 0], range: 0, k: 1 }));
        c.x += L.x * L.k; c.y += L.y * L.k; c.z += L.z * L.k; c.w += L.k; c.range = Math.max(c.range, L.range);
        for (let i = 0; i < 3; i++) c.col[i] += L.col[i] * L.k;
      }
      P.rawNeonLights = P.neonLights.length;
      P.neonLights = [...cells.values()].map((c) => ({ x: c.x / c.w, y: c.y / c.w, z: c.z / c.w, col: c.col, range: c.range + 2, k: 1 }));
      // ---- beach: sand east of the boardwalk, lifeguard huts, coconut palms
      buildBeach(P, ctx, { ...o, hutSpots: P0huts });
      if (o.wet) wetRoads(world); // the wet look is an option (?wet=1); dry by default
      clipShoreEast(world, ocean);
      brighterTrafficLamps(world);
      P.stats = { signs: signs.length, tubes: tubes.length, neonLights: P.neonLights.length, neonLightsBeforeMerge: P.rawNeonLights, ms: Math.round(performance.now() - t0), ...P.beachStats };
      return P.group;
    },
    update(dt, cam, darkness, world) {
      const on = THREE.MathUtils.smoothstep(darkness, 0.08, 0.3);
      P.time = (P.time || 0) + dt;
      if (P.tubeMat) P.tubeMat.color.setScalar(0.15 + 6 * on);
      if (P.lobbyMat) P.lobbyMat.userData.u.uGlow.value = 0.25 + 1.0 * on;
      if (P.foam) { P.foam.uTime.value = P.time; P.foam.uLight.value = 0.35 + 0.65 * (1 - darkness * 0.7); }
      if (P.duneRoad) P.duneRoad.lamp.mat.color.setRGB(0.3 + 2.0 * on, 0.25 + 1.4 * on, 0.2 + 0.8 * on);
      if (P.beachLampMat) P.beachLampMat.color.setRGB(0.4 + 4.6 * on, 0.35 + 3.3 * on, 0.3 + 1.9 * on);
      if (P.signMats) for (const m of P.signMats) { m.userData.u.uNeon.value = on; m.userData.u.uTime.value = P.time; }
      if (lights) {
        let i = 0;
        const R2 = 160 * 160;
        const maxL = Math.min(96, P.maxLights);
        for (const L of P.neonLights) {
          if (i >= maxL) break;
          if ((L.x - cam.x) ** 2 + (L.z - cam.z) ** 2 > R2 || on <= 0) continue;
          const k = 30 * L.k * on;
          lights.set(i++, L.x, L.y, L.z, L.range, L.col[0] * k, L.col[1] * k, L.col[2] * k);
        }
        if (P.duneRoad && on > 0) { const L = P.duneRoad.lamp, k = 26 * on; lights.set(i++, L.x, L.y, L.z, 24, k, k * 0.7, k * 0.42); }
        for (const L of P.beachLamps || []) {
          if (i >= maxL + 12) break;
          if ((L.x - cam.x) ** 2 + (L.z - cam.z) ** 2 > 120 * 120 || on <= 0) continue;
          const k = 40 * on; lights.set(i++, L.x, L.y - 0.3, L.z, 16, k, k * 0.72, k * 0.45);
        }
        for (const H of P.huts || []) {
          if (i >= maxL + 18) break;
          if ((H.x - cam.x) ** 2 + (H.z - cam.z) ** 2 > 120 * 120 || on <= 0) continue;
          const k = 12 * on; lights.set(i++, H.x, (H.y || 0) + 3.2, H.z, 9, k, k * 0.75, k * 0.45);
        }
        for (; i < 96; i++) lights.off(i);
        lights.flush(world);
      }
    },
  };
  return P;
}

// ------------------------------------------------------------------ glazed lobby fronts
/**
 * A glazed ground floor in front of each Ocean Drive hotel (it covers the engine's storefront cards): near-black glass
 * with low roughness (reflects the sky probe / SSR: neon and lamps slide over it), slim mullions, and a warm lobby
 * glow behind it that varies per bay (some lit bright, some dim), drawn from the uv in the shader.
 */
function lobbyMesh(list) {
  const geos = [];
  for (const L of list) {
    const g = new THREE.PlaneGeometry(L.L - 0.4, 3.1);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (L.L - 0.4) / 2.6, uv.getY(i));
    const sd = new Float32Array(g.attributes.position.count).fill(L.seed * 97.0);
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    const mx = (L.a[0] + L.c[0]) / 2 + L.nx * 0.5, mz = (L.a[1] + L.c[1]) / 2 + L.nz * 0.5;
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(L.nx, L.nz)).setPosition(mx, L.gy + 1.6, mz));
    geos.push(g);
  }
  const m = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.07, metalness: 0.1, emissive: 0xffffff, name: 'lobbyGlass' });
  const u = { uGlow: { value: 1 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSeed; varying float vSeed; varying vec2 vLobUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSeed = aSeed; vLobUv = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSeed; varying vec2 vLobUv; uniform float uGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float bay = floor(vLobUv.x), fx = fract(vLobUv.x);
  float h = fract(sin(bay * 12.9898 + vSeed) * 43758.5453);
  float mull = step(0.04, fx) * step(fx, 0.96) * step(0.05, vLobUv.y) * step(vLobUv.y, 0.97) * (1.0 - step(0.72, vLobUv.y) * step(vLobUv.y, 0.74));
  vec3 warm = mix(vec3(1.0, 0.62, 0.32), vec3(1.0, 0.85, 0.6), h);
  // a dim lobby with a warm pendant pool per bay, a darker counter band at the bottom
  float pool = exp(-pow((fx - 0.5) * 2.6, 2.0)) * smoothstep(0.15, 0.6, vLobUv.y) * (1.0 - smoothstep(0.62, 0.72, vLobUv.y));
  float lit = (0.06 + 0.5 * pool * step(0.45, h) + 0.12 * pool) * (1.0 - 0.7 * step(vLobUv.y, 0.3));
  totalEmissiveRadiance = warm * lit * mull * uGlow;
  diffuseColor.rgb = mix(vec3(0.75, 0.72, 0.68), diffuseColor.rgb, mull); // the mullions: light metal
}`);
  };
  m.customProgramCacheKey = () => 'miami-lobby';
  m.userData.u = u;
  const mesh = new THREE.Mesh(mergeGeometries(geos), m);
  mesh.name = 'lobby-glass'; mesh.receiveShadow = true;
  return mesh;
}

// ------------------------------------------------------------------ deco frontage (Ocean Drive hotels)
const hexRgb = (hex) => { const c = new THREE.Color(hex || '#f2ece0'); return [c.r, c.g, c.b]; };
/**
 * Streamline-deco dressing in front of a hotel's street facade (the engine's shell stays behind it): a recessed
 * ground-floor porch (slab + columns + a terrace railing on top), a rounded corner tower at one end, a stepped
 * parapet with three ribbed fins over the entrance, pastel accent bands. Plain boxes / cylinders in one merged,
 * vertex-coloured mesh.
 */
function decoFrontage(deco, tubes, best, ux, uz, nx, nz, gy, h, tag, neonCol, r) {
  const L = best.L, yaw = Math.atan2(nx, nz);
  const white = [0.95, 0.94, 0.9], accent = hexRgb(tag), dark = [0.18, 0.17, 0.16];
  const at = (t, out) => [best.a[0] + (best.c[0] - best.a[0]) * t + nx * out, best.a[1] + (best.c[1] - best.a[1]) * t + nz * out];
  // porch: a slab 2.2 m deep at 3.4 m, columns every ~3 m, a railing on the terrace above
  const [mx, mz] = at(0.5, 1.1);
  deco.push({ box: true, x: mx, y: gy + 3.45, z: mz, sx: L - 0.6, sy: 0.22, sz: 2.2, yaw, col: white });
  deco.push({ box: true, x: mx + nx * 1.1, y: gy + 3.3, z: mz + nz * 1.1, sx: L - 0.6, sy: 0.12, sz: 0.06, yaw, col: accent }); // fascia band
  const nCol = Math.max(2, Math.round(L / 3.2));
  for (let k = 0; k <= nCol; k++) {
    const [cx, cz] = at(0.04 + 0.92 * (k / nCol), 2.0);
    deco.push({ cyl: true, r: 0.14, x: cx, z: cz, y0: gy, y1: gy + 3.35, col: white });
  }
  for (let k = 0; k <= nCol * 3; k++) { // railing balusters + top rail
    const [cx, cz] = at(0.04 + 0.92 * (k / (nCol * 3)), 2.1);
    deco.push({ box: true, x: cx, y: gy + 4.0, z: cz, sx: 0.05, sy: 0.9, sz: 0.05, yaw, col: white });
  }
  const [rx2, rz2] = at(0.5, 2.1);
  deco.push({ box: true, x: rx2, y: gy + 4.48, z: rz2, sx: L * 0.92, sy: 0.07, sz: 0.1, yaw, col: white });
  // rounded corner tower at one end (a half-cylinder proud of the facade, full height + 1 m)
  if (r() < 0.6) {
    const e = r() < 0.5 ? 0.02 : 0.98, [tx, tz] = at(e, 0.2);
    deco.push({ cyl: true, r: 1.5, x: tx, z: tz, y0: gy + 3.6, y1: gy + h + 0.9, col: white });
    for (let k = 1; k < Math.floor(h / 3.25); k++) deco.push({ cyl: true, r: 1.62, x: tx, z: tz, y0: gy + k * 3.25 - 0.3, y1: gy + k * 3.25 - 0.18, col: accent });
  }
  // stepped parapet over the entrance with three ribbed fins
  const [px, pz] = at(0.5, 0.15);
  for (let k = 0; k < 3; k++) deco.push({ box: true, x: px, y: gy + h + 0.5 + k * 0.7, z: pz, sx: Math.min(L * 0.5, 8) * (1 - k * 0.28), sy: 0.7, sz: 0.5, yaw, col: k === 1 ? accent : white });
  for (let k = -1; k <= 1; k++) {
    const t = 0.5 + k * Math.min(0.08, 1.2 / L), [fx, fz] = at(t, 0.45);
    deco.push({ box: true, x: fx, y: gy + h - 2.5, z: fz, sx: 0.16, sy: 6, sz: 0.6, yaw, col: white });
  }
  // a neon tube along the top step
  const [ta, tb] = [at(0.5 - Math.min(L * 0.5, 8) * 0.36 / L, 0.42), at(0.5 + Math.min(L * 0.5, 8) * 0.36 / L, 0.42)];
  tubes.push({ ax: ta[0], az: ta[1], bx: tb[0], bz: tb[1], y0: gy + h + 2.25, y1: gy + h + 2.25, col: neonCol });
  void dark;
}

// ------------------------------------------------------------------ beach
function sandMaterial(pbr, lod) {
  const m = new THREE.MeshStandardMaterial({ color: 0xc8b694, roughness: 0.95, metalness: 0, name: "sand" });
  if (pbr && pbr.map) { m.map = pbr.map; if (pbr.normalMap) { m.normalMap = pbr.normalMap; m.normalScale.set(0.3, 0.3); } m.color.set(0xdccdb2); }
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWet; varying float vWet;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWet = aWet;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWet;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb * 1.45, diffuseColor.rgb * 0.5, vWet);')
      // the wet band near the waterline is glossy (it mirrors the afterglow); written where three computes roughness
      .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('float roughnessFactor = roughness;', 'float roughnessFactor = mix(roughness, 0.12, smoothstep(0.35, 0.9, vWet));'));
  };
  m.customProgramCacheKey = () => `miami-sand-${lod}`;
  return m;
}

function buildBeach(P, ctx, o) {
  const { world, data } = ctx;
  // the beach: land east of the beach walks (Lummus Park Boardwalk / South Beach Boardwalk / Ocean Drive) to the water
  const walk = data.roads.filter((r) => r.n && /Boardwalk|Sandwalk|Ocean Drive/.test(r.n)).map((r) => r.p);
  if (!walk.length) { P.beachStats = { beach: 0 }; return; }
  let minZ = Infinity, maxZ = -Infinity;
  for (const pl of walk) for (const p of pl) { minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
  // per z row: the east-most walk x, then the sand runs from there + 6 m to 25 m into the water
  const step = o.lod === 'low' ? 4 : 2;
  const rows = [];
  for (let z = minZ - 40; z <= maxZ + 40; z += step) {
    let wx = -Infinity;
    for (const pl of walk) for (let i = 0; i < pl.length - 1; i++) {
      const a = pl[i], b = pl[i + 1];
      if ((a[1] - z) * (b[1] - z) > 0) continue;
      const t = (z - a[1]) / ((b[1] - a[1]) || 1e-6), x = a[0] + (b[0] - a[0]) * t;
      if (x > wx) wx = x;
    }
    if (!Number.isFinite(wx)) continue;
    let sx = wx + 6, ex = sx;
    // walk east to the shoreline
    for (let k = 0; k < 400 && world.isLand(ex, z); k++) ex += 1;
    if (ex - sx < 8) continue;
    rows.push({ z, x0: sx, x1: ex + 22 });
  }
  if (rows.length < 2) { P.beachStats = { beach: 0 }; return; }
  // the sand surface: dry sand rising gently to a berm 0.3 m above the walk level, then a 6 % slope under the water
  const WL = world.waterLevel;
  const yAt = (R, x) => {
    const shore = R.x1 - 22;
    if (x < shore) return 0.07 + 0.24 * Math.min(1, (x - R.x0) / 30) * (1 - Math.min(1, Math.max(0, (x - shore + 25) / 25)));
    return Math.max(0.07 - (x - shore) * 0.07, WL - 1.2); // the beach runs on under the water at 7 %
  };
  const z0 = rows[0].z, byRow = [];
  for (const R of rows) byRow[Math.round((R.z - z0) / step)] = R;
  /** Sand height at (x, z) (bilinear between rows), -Infinity off the beach: the physics ground takes the max. */
  P.sandHeight = (x, z) => {
    const f = (z - z0) / step, i = Math.floor(f), t = f - i;
    const A = byRow[i], B = byRow[i + 1];
    if (!A || !B) return -Infinity;
    if (x < Math.max(A.x0, B.x0) || x > Math.min(A.x1, B.x1)) return -Infinity;
    return yAt(A, x) * (1 - t) + yAt(B, x) * t;
  };
  P.beachStep = step;
  // the Dune Road along the back of the beach (dune-road.js): the hero shot's setting; the ground the physics, the
  // palms and the grass stand on becomes the higher of the sand and the road corridor (road, banks, dune)
  const pbrG = world.tex && world.tex.pbr && world.tex.pbr.ground;
  const road = buildDuneRoad({ rows, sandHeight: P.sandHeight, lod: o.lod, asphalt: pbrG ? pbrG.asphalt : null, crestZ: o.crestZ ?? -60 });
  const sandOnly = P.sandHeight;
  P.sandHeight = (x, z) => Math.max(sandOnly(x, z), road.heightAt(x, z));
  P.duneRoad = road;
  P.group.add(road.group);
  for (const c of road.colliders) ctx.colliders.add(c[0], c[1], c[2], c[3], c[4], c[5], 3);
  const pos = [], wet = [], uv = [], idx = [];
  const nx = 24;
  for (let r = 0; r < rows.length; r++) {
    const R = rows[r];
    for (let i = 0; i <= nx; i++) {
      const t = i / nx, x = R.x0 + (R.x1 - R.x0) * t;
      const land = world.isLand(x, R.z);
      const shore = R.x1 - 22;
      pos.push(x, yAt(R, x), R.z);
      wet.push(land ? Math.max(0, Math.min(1, (x - shore + 8) / 8)) : 1);
      uv.push(x / 5, R.z / 5);
    }
  }
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < nx; i++) {
    const a = r * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aWet', new THREE.Float32BufferAttribute(wet, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const sand = new THREE.Mesh(g, sandMaterial(o.sand || null, o.lod)); sand.name = 'beach-sand'; sand.receiveShadow = true;
  P.group.add(sand);
  P.beachRows = rows;
  // lifeguard huts every ~140 m along the beach (pastel boxes on stilts with a ramp)
  const hutCols = [0xf26b8a, 0x40c8c0, 0xf5c542, 0x8a7bd8, 0xf08a3c, 0x5fc96b];
  const huts = [];
  const r = rnd(77);
  const spotsH = o.hutSpots && o.hutSpots.length ? o.hutSpots : [];
  if (spotsH.length) for (const h of spotsH) huts.push(hut(h.x, h.z, hutCols[huts.length % hutCols.length], r, P.sandHeight(h.x, h.z)));
  else for (let i = 3; i < rows.length - 3; i += Math.round(140 / step)) {
    const R = rows[i], x = R.x0 + (R.x1 - 22 - R.x0) * 0.62, z = R.z;
    huts.push(hut(x, z, hutCols[huts.length % hutCols.length], r, P.sandHeight(x, z)));
  }
  P.huts = huts.map((h) => ({ x: h.position.x, z: h.position.z, y: h.position.y }));
  // draw calls: every hut's parts merged per material into three static meshes (painted body in vertex colour, white
  // trim, the lit windows) instead of ~10 meshes per hut
  {
    const paintG = [], whiteG = [], winG = []; let winMat = null;
    for (const h of huts) {
      h.updateMatrixWorld(true);
      h.traverse((m) => {
        if (!m.isMesh) return;
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        if (m.material.name === 'hutWindow') { winMat = m.material; winG.push(g); return; }
        const c = m.material.color, n = g.attributes.position.count, cc = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
        (m.material.color.getHex() === 0xf2efe6 ? whiteG : paintG).push(g);
      });
    }
    const add = (list, mat, name) => { if (!list.length) return; const mesh = new THREE.Mesh(mergeGeometries(list), mat); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; P.group.add(mesh); };
    add(paintG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 'lifeguard-huts');
    add(whiteG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 'lifeguard-huts-trim');
    if (winMat) add(winG, winMat, 'lifeguard-huts-windows');
  }
  // tall coconut palms in a loose line along the dune edge
  // shared with the detailed near palms (palm.js, desktop): the cheap ones dither out within uNear of the camera
  P.palmFade = { uViewPos: { value: new THREE.Vector3(0, -1e5, 0) }, uNear: { value: 0 }, uTime: { value: 0 } };
  const palms = coconutPalms(rows, o.lod === 'low' ? 26 : 13, r, (x, z) => { const v = P.sandHeight(x, z); return Number.isFinite(v) ? v : 0; }, (x, z) => Math.abs(x - road.xAt(z)) > 15 || z < road.zCrest - 20 || z > road.z1 - 30, null, P.palmFade); // none crowding the hero road
  if (palms) P.group.add(palms);
  // a second, looser row 22-48 m west of the road: palms on the left skyline in front of the hotel row
  const palms2 = coconutPalms(rows, o.lod === 'low' ? 18 : 8, r, (x, z) => { const v = P.sandHeight(x, z); return Number.isFinite(v) ? v : 0; },
    (x, z) => z > road.zCrest - 80 && z < road.z1 - 10, (R) => road.xAt(R.z) - 22 - r() * 26, P.palmFade);
  if (palms2) P.group.add(palms2);
  P.palmInstances = [...(palms ? palms.userData.instances : []), ...(palms2 ? palms2.userData.instances : [])];
  beachDressing(P, rows, r, o, world);
  P.beachStats = { beachRows: rows.length, huts: huts.length, palms: palms ? palms.count : 0, grass: P.grassCount || 0, lamps: P.beachLamps.length, loungers: P.beachProps.length };
}

/**
 * What makes it a Miami beach: surf lines rolling in over the shallows (an animated foam strip), dune grass tufts
 * along the back of the sand, a row of boardwalk lamps (light positions in P.beachLamps), loungers and folded
 * umbrellas in rows by each hut (spots in P.beachProps for the DynamicsWorld), lit hut windows (P.hutLights).
 */
function beachDressing(P, rows, r, o, world) {
  const low = o.lod === 'low';
  // ---- surf: a strip over the water from 2 m inside the shoreline to 26 m out
  const pos = [], uv = [], idx = [];
  let n = 0;
  for (let i = 0; i < rows.length; i += 2) {
    const R = rows[i], shore = R.x1 - 22;
    pos.push(shore - 3, world.waterLevel + 0.06, R.z, shore + 28, world.waterLevel + 0.06, R.z);
    uv.push(0, R.z, 1, R.z);
    if (n > 0) { const a = (n - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    n++;
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx);
  const fu = { uTime: { value: 0 }, uLight: { value: 1 } };
  const fm = new THREE.ShaderMaterial({
    uniforms: fu, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uLight;
      float h(float x){ return fract(sin(x * 127.1) * 43758.5); }
      float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }
      void main(){
        float u = vUv.x, z = vUv.y;
        float a = 0.0;
        for (int k = 0; k < 3; k++) {                 // three breakers rolling in, each a wobbly line that fades as it runs up
          float ph = fract(uTime * 0.07 + float(k) / 3.0);
          float line = 1.0 - ph;                      // 1 = out at sea, 0 = at the shoreline
          float wob = (n1(z * 0.08 + float(k) * 13.0) - 0.5) * 0.08 + (n1(z * 0.5 + uTime * 0.3) - 0.5) * 0.02;
          float d = abs(u - (0.1 + line * 0.8 + wob));
          float lace = 0.5 + 0.5 * n1(z * 1.7 + float(k) * 5.0 + uTime);
          a += (1.0 - smoothstep(0.0, 0.012 + ph * 0.03, d)) * (0.35 + 0.65 * ph) * lace;
          a += (1.0 - smoothstep(0.0, 0.08, u - (0.1 + line * 0.8 + wob))) * step(u, 0.1 + line * 0.8 + wob) * 0.12 * ph; // the wash behind it
        }
        a += (1.0 - smoothstep(0.0, 0.1, u)) * 0.45 * (0.6 + 0.4 * n1(z * 0.9 + uTime * 0.5)); // the swash on the sand
        gl_FragColor = vec4(vec3(0.92, 0.95, 1.0) * uLight * 1.4, clamp(a * 1.5, 0.0, 0.9) * smoothstep(0.0, 0.04, u));
      }`,
  });
  const foam = new THREE.Mesh(fg, fm); foam.name = 'surf'; foam.renderOrder = 2; foam.frustumCulled = false;
  P.group.add(foam); P.foam = fu;
  // ---- dune grass: thin blade fans scattered along the back of the sand
  const blades = [], cnt = low ? 400 : 1600;
  for (let k = 0; k < cnt; k++) {
    const R = rows[Math.floor(r() * rows.length)], x = R.x0 + r() * 9, z = R.z + (r() - 0.5) * 2, y = P.sandHeight(x, z);
    if (!Number.isFinite(y)) continue;
    const nb = 5, hh = 0.35 + r() * 0.45;
    for (let b = 0; b < nb; b++) {
      const a = r() * Math.PI * 2, lean = 0.15 + r() * 0.25, w = 0.025;
      const tx = x + Math.cos(a) * lean * hh, tz = z + Math.sin(a) * lean * hh;
      blades.push(x - Math.sin(a) * w, y, z + Math.cos(a) * w, x + Math.sin(a) * w, y, z - Math.cos(a) * w, tx, y + hh * (0.8 + r() * 0.4), tz);
    }
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3)); gg.computeVertexNormals();
  const grass = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: 0x8a8a4a, roughness: 0.9, side: THREE.DoubleSide, name: 'duneGrass' }));
  grass.name = 'dune-grass'; grass.receiveShadow = true; P.group.add(grass); P.grassCount = blades.length / 15;
  // ---- boardwalk lamps every 28 m along the back of the beach
  P.beachLamps = [];
  const lampGeos = [], headGeos = [];
  let acc = 0;
  for (let i = 1; i < rows.length; i++) {
    acc += Math.abs(rows[i].z - rows[i - 1].z);
    if (acc < 28 || o.boardwalkLamps === false) continue; acc = 0;
    const R = rows[i], x = R.x0 - 1.5, z = R.z, y = P.sandHeight(R.x0 + 0.5, z);
    const gy = Number.isFinite(y) ? y : 0.1;
    lampGeos.push(new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8).translate(x, gy + 1.8, z));
    headGeos.push(new THREE.SphereGeometry(0.2, 12, 8).translate(x, gy + 3.8, z));
    P.beachLamps.push({ x, y: gy + 3.7, z });
  }
  if (lampGeos.length) {
    const post = new THREE.Mesh(mergeGeometries(lampGeos), new THREE.MeshStandardMaterial({ color: 0x1a2a2a, roughness: 0.5, metalness: 0.6 }));
    const heads = new THREE.Mesh(mergeGeometries(headGeos), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 2.2), name: 'beachLampHead' }));
    post.name = 'beach-lamp-posts'; heads.name = 'beach-lamp-heads'; post.castShadow = true;
    P.group.add(post, heads); P.beachLampMat = heads.material;
  }
  // ---- loungers and folded umbrellas in two rows beside each hut (dynamic props, placed by main.js)
  P.beachProps = [];
  for (const h of P.huts || []) {
    for (let k = 0; k < (low ? 4 : 8); k++) {
      const x = h.x + 7 + (k % 2) * 3.2, z = h.z - 8 + Math.floor(k / 2) * 2.4;
      P.beachProps.push({ type: 'lounger', x, z, yaw: Math.PI / 2 });
      if (k % 2 === 0) P.beachProps.push({ type: 'parasol', x: x + 1.6, z: z + 0.6, yaw: 0 });
    }
  }
}

function hut(x, z, color, r, y = 0) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.7 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), paint); cabin.position.y = 2.9; cabin.castShadow = true;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 2.6, 1.2, 4, 1), white); roof.rotation.y = Math.PI / 4; roof.position.y = 4.7; roof.castShadow = true;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 4), white); deck.position.y = 1.65;
  g.add(cabin, roof, deck);
  for (const [sx, sz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 0.18), white); l.position.set(sx, 0.85, sz); g.add(l); }
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 4.2), white); ramp.position.set(-3.6, 0.85, 0); ramp.rotation.z = -0.42; g.add(ramp);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.8), new THREE.MeshStandardMaterial({ color: 0x0c1418, roughness: 0.1, metalness: 0.3, emissive: 0xffc27a, emissiveIntensity: 2.2, name: 'hutWindow' }));
  const win2 = win.clone(); win2.position.set(-1.51, 3.1, 0); win2.rotation.y = -Math.PI / 2; g.add(win2); win.position.set(1.51, 3.1, 0); win.rotation.y = Math.PI / 2; g.add(win);
  g.position.set(x, Number.isFinite(y) ? y : 0, z); g.rotation.y = (r() - 0.5) * 0.3;
  g.traverse((m) => { if (m.isMesh) m.receiveShadow = true; });
  g.name = 'lifeguard-hut';
  return g;
}

/** Tall curved-trunk coconut palms: one instanced trunk + one instanced crown of frond cards. */
function coconutPalms(rows, spacing, r, gy = () => 0, keep = () => true, xFn = null, fade = null) {
  const pts = [];
  let acc = 0;
  for (let i = 1; i < rows.length; i++) {
    acc += Math.abs(rows[i].z - rows[i - 1].z);
    if (acc < spacing) continue;
    acc = r() * spacing * 0.5;
    const R = rows[i];
    const x = xFn ? xFn(R) : R.x0 + 17 + r() * 6;
    if (keep(x, R.z)) pts.push([x, R.z, 9 + r() * 6, r() * Math.PI * 2, 0.15 + r() * 0.25, (r() - 0.5) * 0.12]);
  }
  if (!pts.length) return null;
  // trunk: a slightly bent tapered tube of 8 rings, crown: 14 drooping frond strips
  const trunkPts = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8; trunkPts.push(new THREE.Vector3(Math.sin(t * 1.4) * 0.9 * t, t, 0)); }
  const curve = new THREE.CatmullRomCurve3(trunkPts);
  const trunk = new THREE.TubeGeometry(curve, 10, 0.16, 7, false);
  const tp = trunk.attributes.position; // taper to the top
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); const k = 1 - 0.35 * y; tp.setX(i, (tp.getX(i) - Math.sin(y * 1.4) * 0.9 * y) * k + Math.sin(y * 1.4) * 0.9 * y); tp.setZ(i, tp.getZ(i) * k); }
  trunk.computeVertexNormals();
  const fronds = [];
  for (let f = 0; f < 14; f++) {
    const a = (f / 14) * Math.PI * 2 + (f % 2) * 0.2, len = 3.2 + (f % 3) * 0.5;
    const segs = 6, P2 = [], idx = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, w = 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.05;
      const dx = Math.cos(a) * len * t, dz = Math.sin(a) * len * t, dy = 0.5 * t - 1.7 * t * t;
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      P2.push(dx - px, dy - 0.15 * w, dz - pz, dx + px, dy - 0.15 * w, dz + pz);
      if (s < segs) { const b = s * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setIndex(idx);
    g.translate(0.9 * Math.sin(1.4), 0, 0); // at the trunk top (scaled by the instance height below)
    fronds.push(g);
  }
  const crown = mergeGeometries(fronds); crown.computeVertexNormals();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5f5244, roughness: 0.95 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x4a5a2e, roughness: 0.85, side: THREE.DoubleSide }); // a dry, sun-faded olive
  // instanced per 200 m chunk along the beach, so the camera's frustum culls the palms it cannot see
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const byChunk = new Map();
  for (const pt of pts) { const k = Math.floor(pt[1] / 200); if (!byChunk.has(k)) byChunk.set(k, []); byChunk.get(k).push(pt); }
  const meshes = [];
  for (const cp of byChunk.values()) {
    const tMesh = new THREE.InstancedMesh(trunk, trunkMat, cp.length), cMesh = new THREE.InstancedMesh(crown, frondMat, cp.length);
    cp.forEach(([x, z, h, yaw], i) => {
      q.setFromAxisAngle(up, yaw);
      // trunk: unit height, bend 0.9 * sx m; x scaled by sx (bend and girth ~0.16 m), z unscaled
      const sx = h * 0.085;
      m.compose(p.set(x, gy(x, z), z), q, s.set(sx, h, 1)); tMesh.setMatrixAt(i, m);
      // crown at the trunk tip: (0.9 sin 1.4 * sx, h) in the palm's frame; the crown geometry is offset by 0.9 sin 1.4
      const tip = new THREE.Vector3(0.9 * Math.sin(1.4) * (sx - 1), h, 0).applyQuaternion(q);
      m.compose(p.set(x + tip.x, gy(x, z) + tip.y, z + tip.z), q, s.set(1, 1, 1)); cMesh.setMatrixAt(i, m);
    });
    tMesh.computeBoundingSphere(); cMesh.computeBoundingSphere();
    tMesh.castShadow = cMesh.castShadow = true; tMesh.receiveShadow = cMesh.receiveShadow = true;
    meshes.push(tMesh, cMesh);
  }
  // near the camera these cheap palms dither out where the detailed ones (palm.js) dither in (shared uniforms)
  if (fade) for (const mat of [trunkMat, frondMat]) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uViewPos = fade.uViewPos; sh.uniforms.uNear = fade.uNear;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPalmW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvPalmW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvPalmW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uViewPos; uniform float uNear; varying vec3 vPalmW;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  { float k = 1.0 - smoothstep(uNear - 4.0, uNear, distance(vPalmW, uViewPos));
    float bayer = fract(dot(floor(gl_FragCoord.xy), vec2(0.5, 0.25)) + 0.125 * mod(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5), 2.0) + 0.0625);
    if (k > bayer) discard; }`);
    };
    mat.customProgramCacheKey = () => `coconut-palm-far-${mat === trunkMat ? 't' : 'c'}`;
  }
  const g = new THREE.Group(); g.add(...meshes); g.name = 'coconut-palms'; g.count = pts.length;
  g.userData.instances = pts.map(([x, z, h, yaw, , lean]) => ({ x, y: gy(x, z), z, h, yaw, lean, leanDir: yaw + 0.8 }));
  return g;
}

// ------------------------------------------------------------------ no seawall on the beach
/**
 * The engine's waterfront builds a seawall, railings and riprap along every coastline; on the Atlantic side the beach
 * runs into the sea instead. Their materials discard fragments more than 60 m east of Ocean Drive (the bay side to the
 * west keeps its walls).
 */
function clipShoreEast(world, ocean) {
  if (!ocean.length) return;
  // Ocean Drive as a line x = x0 + k z through its two ends (world frame)
  let a = ocean[0][0], b = ocean[0][0];
  for (const pl of ocean) for (const p of pl) { if (p[1] < a[1]) a = p; if (p[1] > b[1]) b = p; }
  const k = (b[0] - a[0]) / ((b[1] - a[1]) || 1), x0 = a[0] - k * a[1];
  const names = new Set(['seawalls', 'pier-dressing', 'riprap']);
  const mats = new Set();
  world.group.traverse((o) => { if (names.has(o.name) && o.material) mats.add(o.material); });
  for (const m of mats) {
    if (m.userData.miamiClip) continue;
    m.userData.miamiClip = true;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vClipW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvClipW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvClipW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vClipW;')
        .replace('void main() {', `void main() {\n  if (vClipW.x > ${x0.toFixed(2)} + ${k.toFixed(4)} * vClipW.z + 60.0) discard;`);
    };
    m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ''}-miami-clip`;
    m.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ traffic tail lamps
/**
 * The traffic material's tail lamps glow at 0.5 x darkness (a city by night); at dusk, with this demo's exposure,
 * that reads as unlit red plastic. Chains the material's onBeforeCompile and raises the running-lamp term (the
 * brake term is the engine's).
 */
function brighterTrafficLamps(world) {
  const T = world.traffic, m = T && T.material;
  if (!m || m.userData.miamiLamps) return;
  m.userData.miamiLamps = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.vertexShader = sh.vertexShader.replace('( 0.03 + uDark * 0.5 + brk', '( 0.06 + uDark * 3.2 + brk');
  };
  m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ''}-miami-lamps`;
  m.needsUpdate = true;
}

// ------------------------------------------------------------------ wet-look asphalt
/**
 * Lower the road's roughness into a glossy, slightly darker wet look with world-space puddles (SSR reflects the
 * lights in them on the G-buffer path). Chains the road material's own onBeforeCompile.
 */
function wetRoads(world) {
  const m = world.mat && world.mat.road;
  if (!m || m.userData.miamiWet) return;
  m.userData.miamiWet = true;
  if (m.normalMap) m.normalScale.set(0.18, 0.18); // calmer highlights in the glossy film
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWetW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWetW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWetW;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float wetP = wNoise(vWetW.xz * 0.11) * 0.6 + wNoise(vWetW.xz * 0.37) * 0.4;
float puddle = smoothstep(0.56, 0.68, wetP);
diffuseColor.rgb *= mix(mix(0.78, 0.5, puddle), 0.9, rPaint);`);
    // the road's own roughness edits follow the G-buffer capture, so the final value is written again for SSR
    sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', `roughnessFactor = mix(mix(roughnessFactor * 0.55, 0.2, puddle), 0.45, rPaint * 0.6);
#ifdef ENGINE_GBUFFER
engineGbRoughness = roughnessFactor;
#endif
#include <metalnessmap_fragment>`);
  };
  m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ''}-miami-wet`;
  m.needsUpdate = true;
}

export { MapWorld };
