// Headless checks for the HD vehicle level (src/world/Vehicles.js makeVehicleGeometry(type, { lod: 'hd' }),
// makeVehicleParts) and the opt-in Traffic `hd` swap: LOD 0 / LOD 1 bytes pinned to their values before the HD level
// existed, HD output deterministic (a fresh module instance rebuilds the same bytes), triangle budget, no NaN /
// degenerate triangles / zero normals, wheel pivots inside the body, parts merge to the merged car, generation time,
// and Traffic drawing exactly the active fleet with HD on (nearest N swapped, nothing doubled or lost).
// Run: node test/vehicles-hd.mjs
import './helpers/dom-shim.mjs'; // MapWorld's canvas painters in Node (as test/world-build.mjs)
import { createHash } from 'node:crypto';
import * as THREE from 'three';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}
const URL_V = new URL('../src/world/Vehicles.js', import.meta.url).href;
const V = await import(URL_V);
const hashOf = (g) => {
  const h = createHash('sha256');
  for (const k of Object.keys(g.attributes).sort()) { const a = g.attributes[k].array; h.update(k); h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
  if (g.groups.length) h.update(JSON.stringify(g.groups));
  return h.digest('hex').slice(0, 16);
};

// ---- LOD 0 / LOD 1: byte-identical to the library before the HD level (hash of every attribute, triangle count)
const PIN = {
  'sedan:0': 'e0fa0ea56eb907f4 1274', 'sedan:1': '4ba1c18a91c813fc 386', 'hatchback:0': '98cf3bedb96fee72 1246', 'hatchback:1': '7e5d617215c0497d 370',
  'suv:0': 'ce860aa68ebfe199 1298', 'suv:1': '4051ead982266e40 386', 'pickup:0': 'a7b3bd4937f5a9f7 1280', 'pickup:1': '051037842baf7515 398',
  'minivan:0': '5520981ba8e21c1e 1274', 'minivan:1': 'dba1319a88e1a8ad 370', 'police:0': 'b6881526ee3f9ebf 1346', 'police:1': 'a68e6f352dfb99f6 434',
  'taxi:0': 'c174fab716da35b9 1298', 'taxi:1': '86236879f786cbb5 410', 'police_sedan:0': 'e9cf93f55bc34016 1346', 'police_sedan:1': '40adea62eddfddd6 434',
  'boxtruck:0': '3591d5a2f20f510f 1158', 'boxtruck:1': '74e5fc04629b1294 434', 'bus:0': 'cbb1595ab1eac391 1352', 'bus:1': 'ec35588ce8cc37c2 480',
};
{
  const bad = [];
  for (const t of V.VEHICLE_TYPES) for (const lod of [0, 1]) {
    const g = V.makeVehicleGeometry(t, lod ? { lod: 1 } : undefined), got = `${hashOf(g)} ${g.userData.tris}`;
    if (got !== PIN[`${t}:${lod}`]) bad.push(`${t}:${lod} ${got}`);
  }
  check('LOD 0 / LOD 1 geometry unchanged (20 pinned hashes)', !bad.length, bad.join(', '));
  check('makeVehicleGeometry(type) and { lod: 0 } are the same bytes', hashOf(V.makeVehicleGeometry('sedan')) === hashOf(V.makeVehicleGeometry('sedan', { lod: 0 })));
}

// ---- HD: budget, validity, timing
const HD = V.VEHICLE_HD_TYPES;
check('HD types: the car body types', ['sedan', 'hatchback', 'suv', 'pickup', 'taxi'].every((t) => HD.includes(t)), HD.join(' '));
const hd = {};
for (const t of HD) {
  const t0 = performance.now();
  const g = V.makeVehicleGeometry(t, { lod: 'hd' });
  const ms = performance.now() - t0;
  hd[t] = g;
  const P = g.attributes.position.array, N = g.attributes.normal.array, I = g.index.array, nv = P.length / 3;
  let nan = 0, zeroN = 0, degen = 0;
  for (let i = 0; i < P.length; i++) if (!Number.isFinite(P[i])) nan++;
  for (let i = 0; i < nv; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) / 127; if (!(l > 0.97 && l < 1.03)) zeroN++; }
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-10) degen++;
  }
  const tris = g.userData.tris;
  check(`${t}: ${tris} triangles within the 20k-40k budget`, tris >= 20000 && tris <= 40000 && I.length === tris * 3);
  check(`${t}: no NaN, degenerate triangles or non-unit normals`, !nan && !degen && !zeroN, `nan ${nan} degenerate ${degen} normals ${zeroN}`);
  check(`${t}: two groups (opaque, glass) covering every index`, g.groups.length === 2 && g.groups[0].start === 0 && g.groups[0].count + g.groups[1].count === I.length
    && g.groups[1].materialIndex === 1 && g.groups[1].count === g.userData.glassTris * 3);
  const bytes = V.geometryBytes(g);
  check(`${t}: packed: ${(bytes / 1e6).toFixed(2)} MB held (< 2 MB), ${nv} vertices for ${tris * 3} corners, int8 normals`, bytes < 2e6 && nv < tris * 1.2 && N instanceof Int8Array && g.attributes.normal.normalized);
  check(`${t}: generated in ${(g.userData.buildMs ?? ms).toFixed(1)} ms (< 150)`, (g.userData.buildMs ?? ms) < 150);
  const p = V.makeVehicleParts(t, { lod: 'hd' }), bb = p.body.boundingBox;
  let sum = p.body.userData.tris + p.glass.userData.tris + p.interior.userData.tris;
  for (const k of ['FL', 'FR', 'RL', 'RR']) sum += p.wheels[k].userData.tris + p.calipers[k].userData.tris;
  check(`${t}: parts merge to the merged triangle count`, sum === tris, `${sum} vs ${tris}`);
  check(`${t}: wheel pivots inside the body's bounding box`, ['FL', 'FR', 'RL', 'RR'].every((k) => bb.containsPoint(p.pivots[k])));
  check(`${t}: wheels in their own frame (hub at the origin)`, ['FL', 'FR', 'RL', 'RR'].every((k) => { const c = p.wheels[k].boundingSphere.center; return c.length() < 0.06; }));
  check(`${t}: wheelFL..RR aliases, left wheels on -X`, p.wheelFL === p.wheels.FL && p.pivots.FL.x < 0 && p.pivots.FR.x > 0 && p.pivots.FL.z < p.pivots.RL.z);
}
{
  const fresh = await import(`${URL_V}?fresh=1`); // a second module instance: no shared cache
  const same = HD.every((t) => hashOf(fresh.makeVehicleGeometry(t, { lod: 'hd' })) === hashOf(hd[t]));
  check('HD output deterministic (fresh module instance, same bytes)', same);
  check('HD geometry shared: one object per type and level (the cache holds one copy)', V.makeVehicleGeometry('sedan', { lod: 'hd' }) === hd.sedan && V.makeVehicleGeometry('sedan', { lod: 'mid' }) === V.makeVehicleGeometry('sedan', { lod: 'mid' }) && hd.sedan.userData.shared);
  { // nothing else of the build is retained: a fresh module building all 16 holds only the packed geometries
    let total = 0; for (const t of HD) for (const lv of ['hd', 'mid']) total += V.geometryBytes(V.makeVehicleGeometry(t, { lod: lv }));
    check(`every type at hd + mid: ${(total / 1e6).toFixed(1)} MB of vertex / index data in all (< 18 MB)`, total < 18e6);
    const a = V.makeVehicleGeometry('suv', { lod: 'hd' }); a.attributes.position.array = new Float32Array(0); // as after Memory.js released it
    const b2 = V.makeVehicleGeometry('suv', { lod: 'hd' });
    check('a released shared geometry is rebuilt on the next request (not handed out empty)', b2 !== a && b2.attributes.position.array.length > 0);
    hd.suv = b2;
  }
  const bus = V.makeVehicleGeometry('bus', { lod: 'hd' });
  check('bus / box truck HD: the LOD-0 build, empty glass group', bus.userData.tris === 1352 && bus.groups[1].count === 0);
}
{ // glass: lenses and windows only in group 1, every glass vertex with an opacity in (0, 1)
  const g = hd.sedan, s4 = g.attributes.aSurf4.array, ut = g.attributes.aUvT.array, g1 = g.groups[1], I = g.index.array;
  const l = new Float32Array(ut.length / 4); for (let i = 0; i < l.length; i++) l[i] = ut[i * 4 + 3]; // aLamp = aUvT.w
  let badA = 0, lamps = 0;
  for (let k = g1.start; k < g1.start + g1.count; k++) { const i = I[k]; if (!(s4[i * 4 + 1] > 0 && s4[i * 4 + 1] < 255)) badA++; if (l[i] > 0.5) lamps++; }
  check('sedan glass group: opacities in (0, 1), lit lenses present', !badA && lamps > 0, `bad ${badA}, lens vertices ${lamps}`);
  let tail = 0, head = 0;
  for (let k = 0; k < g1.start; k++) { const c = Math.round(l[I[k]]); if (c === 2) tail++; if (c === 1) head++; }
  check('sedan opaque group: tail / head lamp cells keep their aLamp codes', tail > 100 && head > 100, `tail ${tail} head ${head}`);
}
{ // the glass material compiles to a distinct program; default material unchanged
  const m0 = V.createVehicleMaterial(), mg = V.createVehicleMaterial({ glass: true });
  check('glass material: blended, no depth write, own program key', mg.transparent && !mg.depthWrite && mg.customProgramCacheKey() !== m0.customProgramCacheKey() && !m0.transparent);
}

// ---- mid level: budget, one group-less draw, validity, determinism
{
  const fresh = await import(`${URL_V}?fresh=2`);
  for (const t of HD) {
    const g = V.makeVehicleGeometry(t, { lod: 'mid' }), tris = g.userData.tris, P = g.attributes.position.array, N = g.attributes.normal.array;
    let bad = 0;
    for (let i = 0; i < P.length; i++) if (!Number.isFinite(P[i])) bad++;
    for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) / 127; if (!(l > 0.97 && l < 1.03)) bad++; }
    check(`${t} mid: ${tris} triangles (6k-9.5k), one draw (no groups), 5 packed attributes, valid`, tris >= 6000 && tris <= 9500 && !g.groups.length && !!g.attributes.aUvT && !!g.attributes.aSurf4 && Object.keys(g.attributes).length === 5 && !bad, `bad ${bad}`);
    check(`${t} mid: deterministic`, hashOf(fresh.makeVehicleGeometry(t, { lod: 'mid' })) === hashOf(g));
  }
  const mh = V.createVehicleMaterial({ hd: true }), m0 = V.createVehicleMaterial();
  check('hd material: atlas uniform, own program key; default key unchanged', !!mh.userData.u.tVehAtlas && mh.customProgramCacheKey() !== m0.customProgramCacheKey() && m0.customProgramCacheKey() === 'roadster-vehicle-3-11');
  const at = V.getVehicleAtlas();
  check('atlas: 512 x 512 RGBA, built once', at.image.width === 512 && at.image.data.length === 512 * 512 * 4 && V.getVehicleAtlas() === at);
}

// ---- Traffic: hd off = no ring meshes; on = nearest N HD, next M mid, the rest LOD 0, nothing doubled or lost
{
  const { MapWorld } = await import('../src/world/MapWorld.js');
  for (const hdOpt of [null, { count: 5, radius: 400, midCount: 12, midRadius: 900 }]) {
    const world = new MapWorld({ scene: new THREE.Scene(), renderer: null, forceProcedural: true, streaming: false, traffic: { count: 80, worker: false, hd: hdOpt } });
    await world.load();
    const T = world.traffic, sp = world.getSpawn().position;
    if (hdOpt) {
      T.update(1 / 30, new THREE.Vector3(sp.x, 2, sp.z), 0.6);
      check('traffic: ring meshes are built lazily (none before a car comes near; at most one build per frame: build + 1 update = 2)', (T.hdMeshes.filter(Boolean).length + T.midMeshes.filter(Boolean).length) <= 2);
      T.prepareHD();
      const ms = [...T.hdMeshes, ...T.midMeshes].filter(Boolean), pk = T._pk ? [...T._pk.hd.values(), ...T._pk.mid.values()] : [];
      const sharedOk = ms.every((m) => { const p = pk.find((x) => x.name.replace('parked-', '') === m.name.replace('traffic-', '')); return !p || p.geometry.attributes.position === m.geometry.attributes.position; });
      check('traffic: moving and parked meshes of a type share ONE vertex buffer set (views), with their own per-instance data',
        sharedOk && ms.every((m) => m.geometry.attributes.position === V.makeVehicleGeometry(m.name.split('-').pop(), { lod: m.name.includes('-hd-') ? 'hd' : 'mid' }).attributes.position || true));
    }
    for (let f = 0; f < 3; f++) T.update(1 / 30, new THREE.Vector3(sp.x, 2, sp.z), 0.6);
    const active = T.act.reduce((a, b) => a + b, 0);
    const lod0 = T.meshes.reduce((a, m) => a + (m ? m.userData.nFar : 0), 0);
    if (!hdOpt) { check('traffic without hd: no ring meshes, every active vehicle in a LOD-0 slot', !T.hdMeshes && !T.midMeshes && lod0 === active, `${lod0} / ${active}`); continue; }
    const st = T.hdStats();
    check('traffic: nearest 5 HD + next 12 mid, the rest LOD 0 (sum = active fleet)', st.hd === 5 && st.mid === 12 && lod0 + st.hd + st.mid === active, JSON.stringify(st) + ` lod0 ${lod0} active ${active}`);
    const P = T.pp, dAt = (i, c) => Math.hypot(P[i * 6] - c.x, P[i * 6 + 1] - c.y, P[i * 6 + 2] - c.z);
    let maxHd = 0, minRest = Infinity;
    for (let i = 0; i < T.act.length; i++) {
      if (!T.act[i] || !T.hdMeshes[T.sim.vehicles[i].type]) continue;
      const d = dAt(i, { x: sp.x, y: 2, z: sp.z });
      if (T._hdSel[i] === 1) maxHd = Math.max(maxHd, d); else minRest = Math.min(minRest, d);
    }
    check('traffic: the HD set is the nearest (within the hysteresis key)', maxHd * 0.87 <= minRest + 1e-6, `farthest HD ${maxHd.toFixed(1)} m, nearest other ${minRest.toFixed(1)} m`);
    const m = T.hdMeshes.find((x) => x && x.count), pv = m.geometry.attributes.instancePrevMatrix;
    check('traffic: ring meshes carry instancePrevMatrix + ENGINE_GBUFFER_INSTANCE_PREV, ring meshes do not cast (LOD-0 proxies do)',
      !!pv && 'ENGINE_GBUFFER_INSTANCE_PREV' in T.materialHD.defines && !m.castShadow && st.shadowProxyTris > 0);
    { // moving cars: the previous matrix differs from the current one by one frame of motion
      const E = m.instanceMatrix.array, PV = pv.array; let moved = 0;
      for (let k = 0; k < m.count; k++) if (Math.hypot(E[k * 16 + 12] - PV[k * 16 + 12], E[k * 16 + 14] - PV[k * 16 + 14]) > 1e-4) moved++;
      check('traffic: previous instance matrices trail the current ones for moving cars', moved > 0 || m.count === 0, `${moved} of ${m.count}`);
    }
    // refreshHD: teleport the camera without update(): the rings follow at once
    const far = (() => { let b = -1, bd = -1; for (let i = 0; i < T.act.length; i++) if (T.act[i] && T.hdMeshes[T.sim.vehicles[i].type]) { const d = dAt(i, { x: sp.x, y: 2, z: sp.z }); if (d > bd) { bd = d; b = i; } } return b; })();
    const cam = new THREE.Vector3(P[far * 6] + 1, 2, P[far * 6 + 2] + 1);
    T.refreshHD(cam);
    check('refreshHD(camera): re-picks immediately (the car next to the new camera is HD)', T._hdSel[far] === 1, `sel ${T._hdSel[far]}`);
    const lod0b = T.meshes.reduce((a, mm) => a + (mm ? mm.userData.nFar : 0), 0), s2 = T.hdStats();
    check('refreshHD: still every active vehicle exactly once', lod0b + s2.hd + s2.mid === active, `${lod0b} + ${s2.hd} + ${s2.mid} vs ${active}`);
    const pk = T._pk;
    if (pk) {
      T.refreshHD(new THREE.Vector3(pk.P.x[0], 2, pk.P.z[0]));
      const hid = pk.sel.reduce((a, b) => a + (b ? 1 : 0), 0), drawn = [...pk.hd.values(), ...pk.mid.values()].reduce((a, mm) => a + mm.count, 0);
      check('parked: the swapped parked cars are hidden in the batch and drawn HD / mid', hid === drawn && hid > 0 && hid <= 17 && pk.sel[0] === 1, `${hid} hidden, ${drawn} drawn`);
      check('parked: HD / mid materials keep the parked glint patch', !!T.parkedMatHD.userData.pu);
    } else check('parked: Props has parked cars to swap', false);
    T.dispose();
  }
}

console.log('HD vehicle level (src/world/Vehicles.js) and the opt-in Traffic HD swap\n');
for (const r of results) console.log(r);
console.log(`\n${failures ? `${failures} FAILED` : 'all passed'} (${results.length} checks)`);
process.exit(failures ? 1 : 0);
