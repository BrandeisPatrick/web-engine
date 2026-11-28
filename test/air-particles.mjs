// Headless checks for AirParticles (src/render/AirParticles.js): every preset builds one mesh with one draw's worth of
// instances, the budget scales the count, unknown presets / options / shapes throw and name the valid ones, update()
// follows the camera and reads the atmosphere's light, setLights() packs up to the declared number of lamps and clears
// the rest, the wrap keeps every particle inside the box around the camera (the vertex shader's maths, mirrored
// here), the motion is deterministic for a seed, and update() / setLights() allocate nothing. Run: node test/air-particles.mjs
import './helpers/dom-shim.mjs';
import { PerspectiveCamera, Vector3, Color, AdditiveBlending, NormalBlending } from 'three';
import { AirParticles, AIR_PRESETS, AIR_MAX_LIGHTS } from '../src/render/AirParticles.js';
import { bytesPerCall, gate, functionsOf, BOXED } from './helpers/alloc.mjs';

let failures = 0;
const lines = [];
function ok(name, cond, detail = '') { if (!cond) failures++; lines.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); }
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

// ---- presets
const names = Object.keys(AIR_PRESETS);
ok('eight presets', names.length === 8, names.join(', '));
for (const n of names) {
  const a = new AirParticles({ preset: n });
  const P = AIR_PRESETS[n];
  ok(`${n}: count, one mesh, never culled`, a.count === P.count && a.mesh.geometry.instanceCount === P.count && a.mesh.frustumCulled === false && a.mesh.isMesh);
  ok(`${n}: blending and depth`, a.mesh.material.blending === (P.blending === 'additive' ? AdditiveBlending : NormalBlending) && a.mesh.material.depthWrite === false && a.mesh.material.transparent);
  ok(`${n}: seeds in 0..1`, Array.from(a.mesh.geometry.attributes.iSeed.array).every((v) => v >= 0 && v < 1));
  a.dispose();
}
// ---- budget and options
ok('budget 0.4 scales the count', new AirParticles({ preset: 'motes', budget: 0.4 }).count === Math.round(AIR_PRESETS.motes.count * 0.4));
const none = new AirParticles({ preset: 'motes', budget: 0 });
ok('budget 0 draws nothing', none.count === 0 && none.mesh.visible === false);
ok('count override', new AirParticles({ preset: 'rain', count: 100 }).count === 100);
ok('unknown preset throws and lists the names', throws(() => new AirParticles({ preset: 'fog' }), /unknown preset 'fog'.*motes.*fireflies/));
ok('unknown option throws and lists the options', throws(() => new AirParticles({ colour: [1, 1, 1] }), /unknown option 'colour'.*color/));
ok('unknown shape throws', throws(() => new AirParticles({ shape: 'star' }), /unknown shape 'star'.*dot.*streak.*leaf/));
ok('bad blending throws', throws(() => new AirParticles({ blending: 'multiply' }), /blending must be/));
ok('bad box throws', throws(() => new AirParticles({ box: [1, 2] }), /box must be 3 numbers/));
ok('lights clamp to AIR_MAX_LIGHTS', new AirParticles({ lights: 99 }).maxLights === AIR_MAX_LIGHTS && new AirParticles().maxLights === 0);

// ---- update: camera and atmosphere light
const cam = new PerspectiveCamera(55, 16 / 9, 0.1, 1000);
cam.position.set(12, 3, -40); cam.updateMatrixWorld(true);
const atmo = { lightDir: new Vector3(0, 0.6, -0.8), sun: { color: new Color(1, 0.8, 0.5), intensity: 3.14159 }, hemi: { color: new Color(0.5, 0.6, 1), intensity: 0.25 } };
const air = new AirParticles({ preset: 'drizzle', atmosphere: atmo, lights: 4 });
air.update(0.5, cam);
const u = air.uniforms;
ok('time advances', Math.abs(air.time - 0.5) < 1e-9 && u.uTime.value === air.time);
ok('follows the camera', u.uCam.value.distanceTo(cam.position) < 1e-9);
ok('sun direction and colour from the atmosphere', u.uSunDir.value.distanceTo(atmo.lightDir) < 1e-9 && Math.abs(u.uSunCol.value.x - 1) < 1e-4 && Math.abs(u.uSunCol.value.z - 0.5) < 1e-4);
ok('ambient from the sky colour, scaled by the preset', Math.abs(u.uAmbient.value.z - 1 * 0.25 * 2 * AIR_PRESETS.drizzle.ambient) < 1e-6);
atmo.sun.intensity = 0; air.update(0, cam);
ok('a dark sun gives no sun term', u.uSunCol.value.length() === 0);

// ---- lights
air.setLights([{ position: [1, 2, 3], color: 0xff0000, intensity: 10, range: 15 }, { position: new Vector3(4, 5, 6), color: [0, 1, 0] }]);
const P4 = u.uLightPos.value, C4 = u.uLightCol.value;
ok('light 0 packed', P4[0].x === 1 && P4[0].y === 2 && P4[0].z === 3 && P4[0].w === 15 && C4[0].x === 10 && C4[0].y === 0);
ok('light 1 packed with defaults', P4[1].x === 4 && P4[1].w === 12 && C4[1].y === 1);
ok('unused lights cleared', P4[2].w === 0 && C4[2].length() === 0 && P4[3].w === 0);
air.setLights([]);
ok('an empty list clears every light', P4.every((p) => p.w === 0) && C4.every((c) => c.length() === 0));
ok('setLights without declared lights is a no-op', new AirParticles().setLights([{ position: [0, 0, 0] }]).uniforms.uLightPos === undefined);

// ---- the wrap (the vertex shader's position maths): every particle stays inside the box around the camera
function positions(a, camPos) {
  const S = a.mesh.geometry.attributes.iSeed.array, U = a.uniforms, B = U.uBox.value, W = U.uWind.value, Wb = U.uWobble.value, t = U.uTime.value, out = [];
  const mod = (x, m) => x - m * Math.floor(x / m);
  for (let i = 0; i < a.count; i++) {
    const sx = S[i * 4], sy = S[i * 4 + 1], sz = S[i * 4 + 2], sw = S[i * 4 + 3], ph = sw * 6.2831853;
    const fall = -U.uFall.value * (0.75 + 0.5 * ((sw * 5.3) % 1)), wt = t * Wb.y * 6.2831853;
    const p = [sx * 2 * B.x + W.x * t + Math.sin(wt * (0.7 + 0.6 * sx) + ph) * Wb.x,
      sy * 2 * B.y + (W.y + fall) * t + Math.sin(wt * (0.5 + 0.7 * sy) + ph * 1.7) * Wb.z * Wb.x,
      sz * 2 * B.z + W.z * t + Math.cos(wt * (0.6 + 0.8 * sz) + ph * 2.3) * Wb.x];
    out.push([mod(p[0] - camPos.x + B.x, 2 * B.x) - B.x, mod(p[1] - camPos.y + B.y, 2 * B.y) - B.y, mod(p[2] - camPos.z + B.z, 2 * B.z) - B.z]);
  }
  return out;
}
for (const n of ['motes', 'rain', 'leaves']) {
  const a = new AirParticles({ preset: n, seed: 3 });
  let inside = true, moved = 0;
  const B = a.uniforms.uBox.value;
  a.update(1, cam); const p0 = positions(a, cam.position);
  cam.position.set(500, 30, -900); a.update(7.3, cam); const p1 = positions(a, cam.position);
  for (let i = 0; i < a.count; i++) {
    for (const p of [p0[i], p1[i]]) if (Math.abs(p[0]) > B.x + 1e-6 || Math.abs(p[1]) > B.y + 1e-6 || Math.abs(p[2]) > B.z + 1e-6) inside = false;
    if (Math.hypot(p1[i][0] - p0[i][0], p1[i][1] - p0[i][1], p1[i][2] - p0[i][2]) > 1e-3) moved++;
  }
  ok(`${n}: wrapped inside the box wherever the camera is`, inside);
  ok(`${n}: particles move`, moved > a.count * 0.9, `${moved} of ${a.count}`);
  cam.position.set(12, 3, -40);
}
// box occupancy: the wrap leaves the air evenly filled (no empty half after a long time)
{
  const a = new AirParticles({ preset: 'rain', seed: 5 });
  a.update(1234.5, cam);
  const p = positions(a, cam.position); let up = 0, east = 0;
  for (const q of p) { if (q[1] > 0) up++; if (q[0] > 0) east++; }
  ok('evenly filled after a long time', Math.abs(up / a.count - 0.5) < 0.05 && Math.abs(east / a.count - 0.5) < 0.05, `${(up / a.count).toFixed(2)} above, ${(east / a.count).toFixed(2)} east`);
}
// ---- deterministic for a seed
{
  const a = new AirParticles({ preset: 'motes', seed: 9 }), b = new AirParticles({ preset: 'motes', seed: 9 }), c = new AirParticles({ preset: 'motes', seed: 10 });
  const A = a.mesh.geometry.attributes.iSeed.array, Bq = b.mesh.geometry.attributes.iSeed.array, C = c.mesh.geometry.attributes.iSeed.array;
  ok('same seed, same particles', A.every((v, i) => v === Bq[i]));
  ok('another seed, other particles', A.some((v, i) => v !== C[i]));
}
// ---- pixel size: read from what is drawn into
{
  const a = new AirParticles({ preset: 'motes' });
  const c2 = new PerspectiveCamera(60, 2, 0.1, 100); c2.updateProjectionMatrix();
  a.mesh.onBeforeRender({ getRenderTarget: () => ({ height: 540 }), domElement: { height: 1080 } }, null, c2);
  const want = 2 * Math.tan(30 * Math.PI / 180) / 540;
  ok('metres per pixel from the target height and the projection', Math.abs(a.uniforms.uPxAngle.value - want) < 1e-9);
  a.mesh.onBeforeRender({ getRenderTarget: () => null, domElement: { height: 1080 } }, null, c2);
  ok('falls back to the canvas height', Math.abs(a.uniforms.uPxAngle.value - want / 2) < 1e-9);
}
// ---- allocation: update and setLights (TurboFan, GC-free window: test/helpers/alloc.mjs; skipped below Node 26)
{
  const a = new AirParticles({ preset: 'drizzle', atmosphere: atmo, lights: 4 });
  const L = [{ position: [1, 2, 3], color: 0xffb070, intensity: 10, range: 12 }, { position: [4, 5, 6], color: 0xffb070, intensity: 10, range: 12 }];
  const DT = BOXED(1 / 60);
  let sink = 0;
  const check = (name, v, lo, hi) => ok(name, Number.isFinite(v) && v >= lo && v <= hi, `${v}`);
  const note = (t) => lines.push(`      ${t}`);
  const force = functionsOf(AirParticles.prototype);
  gate(check, note, 'AirParticles.update(), x4000', bytesPerCall((n) => { for (let i = 0; i < n; i++) { a.update(DT[0], cam); sink += a.time; } }, 4000, { force }));
  gate(check, note, 'AirParticles.setLights(), x4000', bytesPerCall((n) => { for (let i = 0; i < n; i++) { a.setLights(L); sink += a.maxLights; } }, 4000, { force }));
  if (sink < 0) lines.push('unreachable');
}

console.log(lines.join('\n'));
console.log(`\nair-particles: ${failures ? `${failures} FAILED` : 'all passed'}`);
process.exit(failures ? 1 : 0);
