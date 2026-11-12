// Headless checks for the opt-in traffic options the Night NYC walk uses (src/world/TrafficSim.js): typeCounts(n)
// without a mix is the fleet split of before (pinned per type), a mix replaces the named types' shares and renormalises
// (counts still sum to n), and a TrafficSim built on the procedural city with `mix` / `recycleRadius` / `spawnRadius`
// keeps them while the defaults stay 700 / 620 m. Run: node test/nyc-traffic-mix.mjs
import './helpers/dom-shim.mjs'; // MapWorld's canvas painters in Node (as test/world-build.mjs)
import { TrafficSim, TRAFFIC_TYPES, typeCounts } from '../src/world/TrafficSim.js';
import { MapWorld } from '../src/world/MapWorld.js';
import * as THREE from 'three';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}
const names = TRAFFIC_TYPES.map((t) => t.name);
const asObj = (c) => Object.fromEntries(names.map((n, i) => [n, c[i]]));

// ---- typeCounts: the default split (as before the mix option), pinned
{
  const PIN = {
    250: { sedan: 94, hatchback: 30, suv: 55, pickup: 13, minivan: 15, taxi: 10, police: 4, boxtruck: 16, bus: 13 },
    110: null, 36: null,
  };
  for (const n of [250, 110, 36, 0, 1]) {
    const c = typeCounts(n), sum = c.reduce((a, b) => a + b, 0);
    const legacy = TRAFFIC_TYPES.map((t) => Math.round(t.share * n)); legacy[0] += n - legacy.reduce((a, b) => a + b, 0);
    check(`typeCounts(${n}) without a mix: the legacy split, sums to n`, sum === n && c.every((v, i) => v === Math.max(0, legacy[i])), JSON.stringify(asObj(c)));
    check(`typeCounts(${n}, null) === typeCounts(${n})`, JSON.stringify(typeCounts(n, null)) === JSON.stringify(c));
    if (PIN[n]) check(`typeCounts(${n}) pinned`, JSON.stringify(asObj(c)) === JSON.stringify(PIN[n]), JSON.stringify(asObj(c)));
  }
}

// ---- typeCounts with a mix: named shares replaced, the whole renormalised
{
  const mix = { taxi: 0.3, police: 0.02, bus: 0.04, pickup: 0.02 };
  const n = 110, c = asObj(typeCounts(n, mix)), sum = Object.values(c).reduce((a, b) => a + b, 0);
  const total = TRAFFIC_TYPES.reduce((s, t) => s + (t.name in mix ? mix[t.name] : t.share), 0);
  check('mix: counts sum to n', sum === n, `sum ${sum}`);
  check('mix: taxi share = 0.3 / total of the new shares', Math.abs(c.taxi - Math.round((0.3 / total) * n)) <= 1, `taxi ${c.taxi}, expected ~${((0.3 / total) * n).toFixed(1)}`);
  check('mix: unnamed types keep their relative shares', Math.abs(c.suv / c.hatchback - 0.22 / 0.12) < 0.35, `suv ${c.suv} hatchback ${c.hatchback}`);
  check('mix: a zero share removes the type', asObj(typeCounts(50, { bus: 0 })).bus === 0);
  check('mix: unknown names and non-numbers are ignored', JSON.stringify(typeCounts(80, { tram: 0.5, taxi: 'x' })) === JSON.stringify(typeCounts(80)));
}

// ---- a sim on the procedural city: defaults, and the options kept
{
  const world = new MapWorld({ scene: new THREE.Scene(), renderer: null, forceProcedural: true, traffic: false, streaming: false });
  await world.load();
  const roads = TrafficSim.roadsFrom(world.net);
  const def = new TrafficSim({ roads, seed: 7, count: 60 });
  check('defaults: recycle 700 m, spawn 620 m, no mix', def.recycleR === 700 && def.spawnR === 620 && def.mix === null);
  def.build();
  const dc = asObj(def.typeCounts);
  check('default sim: fleet split = typeCounts(60)', JSON.stringify(def.typeCounts) === JSON.stringify(typeCounts(60)), JSON.stringify(dc));
  const sim = new TrafficSim({ roads, seed: 7, count: 60, mix: { taxi: 0.4 }, recycleRadius: 300, spawnRadius: 220 });
  sim.build();
  const sc = asObj(sim.typeCounts);
  check('mix sim: more taxis, same fleet size', sc.taxi > dc.taxi && sim.vehicles.length === def.vehicles.length, `taxi ${dc.taxi} -> ${sc.taxi}`);
  const far = sim.vehicles.filter((v) => v.active && Math.hypot(v.x - sim.spawn.x, v.z - sim.spawn.z) > 300).length;
  check('area sim: the initial spread stays inside spawnRadius (+ lane slack)', far === 0, `${far} beyond 300 m`);
  for (let i = 0; i < 120; i++) sim.update(1 / 30);
  check('area sim: steps without errors', sim.vehicles.every((v) => Number.isFinite(v.x) && Number.isFinite(v.z)));
}

console.log('Traffic fleet mix and area (src/world/TrafficSim.js, Night NYC walk)\n');
for (const r of results) console.log(r);
console.log(`\n${failures ? `${failures} FAILED` : 'all passed'} (${results.length} checks)`);
process.exit(failures ? 1 : 0);
