// Dev-only check of Traffic's opt-in detail rings (not in the build; /dev/traffic-hd.html): the NYC map, a street-level
// camera at the 7th Avenue spawn, traffic { hd: { count, radius, midCount, midRadius } }.
// URL: ?hd=0 (off) &n= &r= &mn= &mr= (ring counts / radii) &t=hours &az=deg (look along / across the avenue) &gb=1
//      (G-buffer + TAA) &w=&h= (canvas size, CSS px at pixel ratio 1) &shot=1
// window.__thd = { world, traffic, ready, frames, freeze(bool), teleport(x, z, yawDeg, refresh), bench(frames), stats() }
import * as THREE from 'three';
import { PostFX } from '@vibe/engine/render';
import { MapWorld } from '@vibe/engine/world';

const q = new URLSearchParams(location.search);
if (q.get('shot')) document.body.classList.add('shot');
const W = +(q.get('w') || innerWidth), H = +(q.get('h') || innerHeight);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(q.get('w') ? 1 : Math.min(2, devicePixelRatio)); renderer.setSize(W, H);
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 6000);
const hd = q.get('hd') === '0' ? null : {
  count: +(q.get('n') || 3), radius: +(q.get('r') || 18), midCount: +(q.get('mn') || 8), midRadius: +(q.get('mr') || 45),
  shadowProxy: q.get('proxy') !== '0',
};
const world = new MapWorld({
  scene, renderer, data: { mapUrl: `${import.meta.env.BASE_URL}nyc/map/city.json`, farlandUrl: false }, terrain: false, filler: false,
  timeOfDay: q.has('t') ? +q.get('t') : 18.95, atmosphere: { camera }, spawn: { road: /^7th Avenue$/ },
  traffic: { count: 140, seed: 11, hd, area: { recycleRadius: 320, spawnRadius: 250 } },
});
const T0 = { world, ready: false, frames: 0, frozen: false };
window.__thd = T0;
await world.load();
world.setSize(W, H, renderer.getPixelRatio());
const sp = world.getSpawn(), az = (+(q.get('az') || 0)) * Math.PI / 180;
const place = (x, z, yaw) => { camera.position.set(x, world.getGroundHeight(x, z) + 1.7, z); camera.rotation.set(-0.06, yaw, 0, 'YXZ'); camera.updateMatrixWorld(); };
place(sp.position.x, sp.position.z, sp.headingRad + az);
const postfx = new PostFX(renderer, scene, camera, { atmosphere: world.atmo, width: W, height: H, pixelRatio: renderer.getPixelRatio(), gbuffer: q.get('gb') === '1' });
postfx.setTimeOfDay(world.atmo.darkness);
T0.traffic = world.traffic; T0.camera = camera; T0.postfx = postfx; T0.renderer = renderer;
/** Stop (true) / resume the world update; rendering continues (a frozen bench pose). */
T0.freeze = (v) => { T0.frozen = !!v; };
/** Move the camera; refresh: call traffic.refreshHD(camera.position) (what a frozen harness must do). */
T0.teleport = (x, z, yawDeg, refresh = true) => { place(x, z, yawDeg * Math.PI / 180); if (refresh && world.traffic) world.traffic.refreshHD(camera.position); };
T0.stats = () => ({ ...(world.traffic && world.traffic.hdStats ? world.traffic.hdStats() : {}), calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
/** GPU-synchronised ms per frame over n frames (1 px readback each frame), world frozen. */
T0.bench = (n = 60) => {
  const gl = renderer.getContext(), px = new Uint8Array(4), fr = T0.frozen; T0.frozen = true; T0.benching = true;
  for (let i = 0; i < 5; i++) { postfx.render(0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { renderer.info.reset(); postfx.render(0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  const ms = (performance.now() - t0) / n;
  T0.frozen = fr; T0.benching = false;
  return { ms, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
};
/** Interleaved A/B: rings on vs the same cars at LOD 0 (counts set to 0 + refreshHD), `reps` pairs of n frames. */
T0.ab = (n = 40, reps = 6) => {
  const Tr = world.traffic, H = Tr && Tr.hd; if (!H) return null;
  const keep = { c: H.count, m: H.midCount }, on = [], off = [];
  const set = (v) => { H.count = v ? keep.c : 0; H.midCount = v ? keep.m : 0; Tr.refreshHD(camera.position); };
  for (let r = 0; r < reps; r++) { set(false); off.push(T0.bench(n)); set(true); on.push(T0.bench(n)); }
  const med = (a) => a.map((x) => x.ms).sort((x, y) => x - y)[a.length >> 1];
  const dd = on.map((x, i) => x.ms - off[i].ms).sort((x, y) => x - y);
  return { onMs: med(on), offMs: med(off), deltaMs: dd[dd.length >> 1], diffs: on.map((x, i) => +(x.ms - off[i].ms).toFixed(2)), on: on[0], off: off[0], stats: T0.stats() };
};
let last = performance.now();
renderer.setAnimationLoop(() => {
  if (T0.benching) return;
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  renderer.info.reset();
  camera.updateMatrixWorld();
  if (!T0.frozen) world.update(dt, camera.position);
  postfx.render(T0.frozen ? 0 : dt);
  const Tr = world.traffic, f = ++T0.frames;
  if (f === 60) T0.ready = true;
  if (f % 30 === 0 && Tr) {
    const s = T0.stats();
    document.getElementById('stats').textContent = `rings ${hd ? `HD ${hd.count} / ${hd.radius} m, mid ${hd.midCount} / ${hd.midRadius} m` : 'off'}: moving ${s.hd ?? 0} + ${s.mid ?? 0}, parked ${s.parkedHd ?? 0} + ${s.parkedMid ?? 0}; draw calls ${s.calls}, triangles ${s.tris}; traffic ${Tr.perf.mainMs.toFixed(2)} ms`;
  }
});
addEventListener('resize', () => { if (q.get('w')) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); postfx.setSize(innerWidth, innerHeight, renderer.getPixelRatio()); world.setSize(innerWidth, innerHeight, renderer.getPixelRatio()); });
