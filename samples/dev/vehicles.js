// Dev-only vehicle viewer (not in the build; served by the dev server as /dev/vehicles.html): the HD level of
// src/world/Vehicles.js on a turntable under the engine's Atmosphere + PostFX, LOD 0 beside it for comparison.
// URL: ?type=sedan&time=dusk|noon|night|golden&view=rear34|front34|side|tail|wheel|rearwin|front&cmp=1&paint=hex
//      &brake=1&gb=1 (G-buffer + TAA path) &shot=1 (hide the UI). window.__veh.set({...}) -> Promise (after frames).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Atmosphere, PostFX } from '@vibe/engine/render';
import { makeVehicleGeometry, makeVehicleParts, createVehicleMaterial, pickVehicleColor, VEHICLE_SPECS, VEHICLE_TYPES } from '@vibe/engine/world';

const q = new URLSearchParams(location.search);
if (q.get('shot')) document.body.classList.add('shot');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 6000);
camera.position.set(4, 1.8, 6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.7, 0);
controls.enableDamping = true;

const atmo = new Atmosphere({ scene, renderer, camera, timeOfDay: q.get('time') || 'dusk', shadows: { cascades: 2, near: 9, far: [80] } });
const postfx = new PostFX(renderer, scene, camera, { atmosphere: atmo, width: innerWidth, height: innerHeight, pixelRatio: renderer.getPixelRatio(), gbuffer: q.get('gb') === '1' });
postfx.setTimeOfDay(atmo.darkness);

// ground: worn asphalt, a painted lane line, the contact shadow under each car
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2b2b2d, roughness: 0.82, metalness: 0 }));
ground.receiveShadow = true; scene.add(ground);
const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb08a2a, roughness: 0.7 }));
line.position.set(-2.4, 0.002, 0); scene.add(line);
function contactTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 128, 10, 64, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.9)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.65)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.scale(1, 1); g.fillStyle = grd; g.fillRect(0, 0, 128, 256); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const shadowTex = contactTexture();
const contact = (spec) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(spec.W * 1.05, spec.L * 1.02).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 }));
  m.position.y = 0.004; m.renderOrder = 1; return m;
};

const mat = createVehicleMaterial({ brake: true, hd: true });
mat.shadowSide = THREE.DoubleSide; // the HD body is an open shell: cast from both sides (solid shadows)
const matLow = createVehicleMaterial({ brake: true });
const glassMat = createVehicleMaterial({ brake: true, glass: true, hd: true });
const state = { type: q.get('type') || 'sedan', time: q.get('time') || 'dusk', view: q.get('view') || '', cmp: q.get('cmp') === '1', paint: q.get('paint') || '', brake: q.get('brake') === '1', spin: false };
let car = null, low = null, mid = null, cs = [], parts = null;
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
function paintColor(type) {
  const c = new THREE.Color();
  if (state.paint) return c.setHex(parseInt(state.paint, 16));
  return pickVehicleColor(rnd, type === 'taxi' ? 'taxi' : type.startsWith('police') ? 'police' : 'car', c);
}
function instanced(geo, material, color) {
  geo.setAttribute('aBrake', new THREE.InstancedBufferAttribute(new Float32Array([state.brake ? 1 : 0]), 1));
  const m = new THREE.InstancedMesh(geo, material, 1);
  m.setMatrixAt(0, new THREE.Matrix4()); m.setColorAt(0, color);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  return m;
}
const group = new THREE.Group(); scene.add(group);
function build() {
  for (const o of [car, low, mid, ...cs]) if (o) { group.remove(o); o.geometry.dispose(); }
  cs = [];
  const t0 = performance.now();
  const g = makeVehicleGeometry(state.type, { lod: 'hd' });
  const ms = performance.now() - t0;
  parts = makeVehicleParts(state.type, { lod: 'hd' });
  const col = paintColor(state.type), spec = VEHICLE_SPECS[state.type];
  car = instanced(g, [mat, glassMat], col); group.add(car);
  const c0 = contact(spec); cs.push(c0); group.add(c0);
  if (state.cmp) { // mid level to the left, LOD 0 further left
    mid = instanced(makeVehicleGeometry(state.type, { lod: 'mid' }), mat, col); mid.position.x = -(spec.W + 1.2); group.add(mid);
    low = instanced(makeVehicleGeometry(state.type), matLow, col); low.position.x = -2 * (spec.W + 1.2); group.add(low);
    for (const o of [mid, low]) { const c1 = contact(spec); c1.position.x = o.position.x; cs.push(c1); group.add(c1); }
  } else { low = null; mid = null; }
  window.__veh.info = { type: state.type, tris: g.userData.tris, glassTris: g.userData.glassTris, buildMs: g.userData.buildMs, cloneMs: ms, lod0: makeVehicleGeometry(state.type).userData.tris, mid: makeVehicleGeometry(state.type, { lod: 'mid' }).userData.tris };
}
const VIEWS = {
  rear34: (s) => [[1.9, 2.1, s.L / 2 + 5.4], [0, 0.75, 0.2]],
  front34: (s) => [[-2.6, 1.35, -s.L / 2 - 3.6], [0, 0.65, -0.2]],
  side: (s) => [[6.6, 1.05, 0.1], [0, 0.7, 0.1]],
  front: (s) => [[0, 1.1, -s.L / 2 - 4.5], [0, 0.65, 0]],
  tail: (s) => [[1.25, 0.95, s.L / 2 + 0.85], [0.55, 0.72, s.L / 2]],
  wheel: (s) => [[s.track / 2 + 1.25, 0.55, -s.L / 2 + s.ohF - 0.9], [s.track / 2, s.wheelR, -s.L / 2 + s.ohF]],
  rearwin: (s) => [[0.35, 1.85, s.L / 2 + 1.1], [0, 1.0, 0.7]],
  top: (s) => [[0.01, 9.5, 0.3], [0, 0, 0]],
  rear: (s) => [[0, 1.2, s.L / 2 + 5], [0, 0.7, 0]],
  ref: (s) => [[0.25, 2.55, s.L / 2 + 3.6], [0, 0.85, 0.3]], // the reference photo's angle (following car, dusk)
};
function applyView() {
  const v = VIEWS[state.view]; if (!v) return;
  const [p, t] = v(VEHICLE_SPECS[state.type]);
  camera.position.set(...p); controls.target.set(...t); camera.lookAt(...t);
}
function setTime() {
  atmo.setTimeOfDay(state.time);
  postfx.setTimeOfDay(atmo.darkness);
}
let frames = 0;
window.__veh = {
  info: null, renderer, scene, camera, postfx, atmo, get parts() { return parts; },
  /** Apply { type, time, view, cmp, paint, brake } and resolve after `n` rendered frames. */
  set(o = {}, n = 30) {
    const rebuild = ['type', 'cmp', 'paint', 'brake'].some((k) => k in o && o[k] !== state[k]);
    Object.assign(state, o);
    if (rebuild) build();
    if ('time' in o) setTime();
    if ('view' in o) applyView();
    syncUI();
    const f0 = frames;
    return new Promise((res) => { const w = () => (frames - f0 >= n ? res(window.__veh.info) : requestAnimationFrame(w)); w(); });
  },
  ready: false,
};
// UI
const $ = (id) => document.getElementById(id);
for (const t of VEHICLE_TYPES) { const o = document.createElement('option'); o.textContent = t; $('type').appendChild(o); }
function syncUI() { $('type').value = state.type; $('time').value = state.time; $('view').value = state.view; $('cmp').checked = state.cmp; $('brake').checked = state.brake; $('paint').value = state.paint; }
$('type').onchange = (e) => window.__veh.set({ type: e.target.value });
$('time').onchange = (e) => window.__veh.set({ time: e.target.value });
$('view').onchange = (e) => window.__veh.set({ view: e.target.value });
$('cmp').onchange = (e) => window.__veh.set({ cmp: e.target.checked });
$('brake').onchange = (e) => window.__veh.set({ brake: e.target.checked });
$('paint').onchange = (e) => window.__veh.set({ paint: e.target.value });
$('spin').onchange = (e) => { state.spin = e.target.checked; };

build(); setTime(); applyView(); syncUI();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); postfx.setSize(innerWidth, innerHeight, renderer.getPixelRatio());
});
let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.spin) group.rotation.y += dt * 0.35;
  controls.update();
  camera.updateMatrixWorld();
  atmo.update(camera.position, dt);
  const u = mat.userData.u.uDark.value = Math.min(1, Math.max(0, (atmo.darkness - 0.12) / 0.45));
  glassMat.userData.u.uDark.value = u; matLow.userData.u.uDark.value = u;
  postfx.render(dt);
  frames++;
  if (frames === 20) window.__veh.ready = true;
  if (frames % 20 === 0 && window.__veh.info) {
    const i = window.__veh.info;
    $('stats').textContent = `${i.type}: HD ${i.tris} tris (glass ${i.glassTris}), built in ${i.buildMs.toFixed(1)} ms; LOD 0 ${i.lod0} tris\ndarkness ${atmo.darkness.toFixed(2)}  draw calls ${renderer.info.render.calls}`;
  }
});
