// Headless checks for the game shell's DOM-free parts: the state machine (src/ui/shellState.js: allowed moves,
// listeners, the start flag, the URL switches ?autostart=1 / ?bench=1) and the saved settings store
// (src/ui/Settings.js: defaults, saving, listeners, define/ranges, a fake storage, a version bump, corrupt JSON,
// wrong types, storage that throws, no storage at all). The DOM half is test/browser/shell.mjs.
// Run: node test/shell.mjs
import { ShellState, SHELL_STATES, skipStartCard, isBenchRun } from '../src/ui/shellState.js';
import { createSettings } from '../src/ui/Settings.js';
import * as ui from '@vibe/engine/ui';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}

// a Web Storage stand-in
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { map: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}

// ---------------------------------------------------------------- state machine
{
  const s = new ShellState();
  check('states: four, in order', SHELL_STATES.join() === 'loading,title,playing,paused');
  check('starts in loading, not started', s.state === 'loading' && s.started === false);
  const log = [];
  const off = s.on((to, from, why) => log.push(`${from}>${to}:${why}`));
  check('loading cannot pause', s.go('paused') === false && s.state === 'loading');
  check('loading -> title', s.go('title', 'ready') && s.state === 'title');
  check('title cannot pause (nothing to pause yet)', !s.can('paused') && s.go('paused') === false);
  check('title cannot go back to loading', s.go('loading') === false);
  check('title -> playing sets started', s.go('playing', 'click') && s.state === 'playing' && s.started);
  check('playing -> paused -> playing', s.go('paused', 'key') && s.go('playing', 'key') && s.state === 'playing');
  check('playing cannot go to title', s.go('title') === false);
  check('a move to the same state is refused', s.go('playing') === false);
  check('listeners see from, to and reason', log.join() === 'loading>title:ready,title>playing:click,playing>paused:key,paused>playing:key', log.join());
  off(); s.go('paused');
  check('off() removes the listener', log.length === 4);
  const a = new ShellState();
  check('loading -> playing directly (card skipped)', a.go('playing', 'autostart') && a.started);
}

// ---------------------------------------------------------------- URL switches
check('skip: none', skipStartCard('') === false && skipStartCard('?quality=mobile') === false);
check('skip: ?autostart=1', skipStartCard('?autostart=1') === true && skipStartCard('?x=2&autostart') === true);
check('skip: ?autostart=0 does not', skipStartCard('?autostart=0') === false && skipStartCard('?autostart=false') === false);
check('skip: ?bench=1', skipStartCard('?bench=1&size=1280x720') === true);
check('bench: only ?bench', isBenchRun('?bench=1') === true && isBenchRun('?autostart=1') === false && isBenchRun('?bench=0') === false);
check('Node: no location gives defaults', skipStartCard() === false && isBenchRun() === false);

// ---------------------------------------------------------------- settings
{
  const st = fakeStorage();
  const s = createSettings('g.settings', { volume: 0.7, assist: true, name: 'a' }, { storage: st });
  check('defaults', s.get('volume') === 0.7 && s.get('assist') === true && s.get('name') === 'a');
  check('nothing saved before a change', !st.map.has('g.settings'));
  const seen = [];
  const off = s.on('volume', (v, k) => seen.push(`${k}=${v}`));
  check('on() calls now with the current value', seen.join() === 'volume=0.7');
  check('set returns the kept value', s.set('volume', 0.4) === 0.4 && s.get('volume') === 0.4);
  check('set saves {v, values}', JSON.parse(st.map.get('g.settings')).v === 1 && JSON.parse(st.map.get('g.settings')).values.volume === 0.4);
  check('listener on change', seen.join() === 'volume=0.7,volume=0.4');
  s.set('volume', 0.4);
  check('no listener call when unchanged', seen.length === 2);
  check('wrong type is refused, old value kept', s.set('volume', 'loud') === 0.4 && s.set('assist', 1) === true);
  check('NaN is refused', s.set('volume', NaN) === 0.4);
  check('unknown key ignored', s.set('nope', 1) === undefined && s.get('nope') === undefined);
  off(); s.set('volume', 0.5);
  check('off() stops the listener', seen.length === 2);

  // reload: a second store on the same storage reads what was saved
  const s2 = createSettings('g.settings', { volume: 0.7, assist: true, name: 'a' }, { storage: st });
  check('saved values survive a reload', s2.get('volume') === 0.5 && s2.get('assist') === true);
  // ranges
  s2.define('volume', 0.7, { min: 0, max: 1 });
  check('range clamps on set', s2.set('volume', 3) === 1 && s2.set('volume', -1) === 0);
  // define a new key later: the saved value of the right type is picked up
  st.setItem('h.settings', JSON.stringify({ v: 1, values: { fov: 80, extra: 5 } }));
  const s3 = createSettings('h.settings', {}, { storage: st });
  s3.define('fov', 70, { min: 50, max: 75 });
  check('define picks up a saved value, clamped to its range', s3.get('fov') === 75);
  check('saved keys without a default are dropped', s3.get('extra') === undefined && !('extra' in s3.all()));
  s3.set('fov', 60);
  check('dropped keys are not written back', !('extra' in JSON.parse(st.getItem('h.settings')).values));
  // reset
  const resets = [];
  s2.on('volume', (v) => resets.push(v));
  s2.reset();
  check('reset: defaults back, listener told, saved', s2.get('volume') === 0.7 && resets.at(-1) === 0.7 && JSON.parse(st.getItem('g.settings')).values.volume === 0.7);
}
{
  // version bump: the old record is ignored, then overwritten
  const st = fakeStorage({ 'v.settings': JSON.stringify({ v: 1, values: { volume: 0.1 } }) });
  check('same version reads the record', createSettings('v.settings', { volume: 0.7 }, { storage: st, version: 1 }).get('volume') === 0.1);
  const s = createSettings('v.settings', { volume: 0.7 }, { storage: st, version: 2 });
  check('version bump gives the defaults', s.get('volume') === 0.7);
  s.set('volume', 0.3);
  check('and saves under the new version', JSON.parse(st.getItem('v.settings')).v === 2);
  const legacy = fakeStorage({ 'l.settings': JSON.stringify({ volume: 0.2 }) });
  check('a record without a version is ignored', createSettings('l.settings', { volume: 0.7 }, { storage: legacy }).get('volume') === 0.7);
}
{
  // corrupt JSON, wrong types in the record, a storage that throws, no storage
  for (const raw of ['{not json', 'null', '"str"', '[1,2]', JSON.stringify({ v: 1, values: 'x' })]) {
    const s = createSettings('c', { volume: 0.7 }, { storage: fakeStorage({ c: raw }) });
    check(`corrupt record ${JSON.stringify(raw).slice(0, 24)} -> defaults`, s.get('volume') === 0.7);
  }
  const typed = createSettings('t', { volume: 0.7, assist: false }, { storage: fakeStorage({ t: JSON.stringify({ v: 1, values: { volume: '0.2', assist: 'yes' } }) }) });
  check('wrong types in the record -> defaults', typed.get('volume') === 0.7 && typed.get('assist') === false);
  const nan = createSettings('n', { volume: 0.7 }, { storage: fakeStorage({ n: '{"v":1,"values":{"volume":1e999}}' }) });
  check('non-finite number -> default', nan.get('volume') === 0.7);
  const boom = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  let ok = true;
  try { const s = createSettings('b', { volume: 0.7 }, { storage: boom }); s.set('volume', 0.2); ok = s.get('volume') === 0.2; } catch { ok = false; }
  check('storage that throws: no throw, works in memory', ok);
  const mem = createSettings('m', { volume: 0.7 }, { storage: null });
  check('no storage: works in memory', mem.set('volume', 0.1) === 0.1);
  check('Node default storage: none (memory)', createSettings('d', { volume: 0.7 }).set('volume', 0.2) === 0.2);
}

// ---------------------------------------------------------------- exports
check('ui exports the shell', ['GameShell', 'createSettings', 'ShellState', 'skipStartCard', 'buildTierRows', 'chooseTier'].every((k) => typeof ui[k] === 'function'));

console.log('Game shell: state machine and settings (src/ui/shellState.js, Settings.js)\n');
for (const r of results) console.log(r);
console.log(`\n${failures ? `${failures} FAILED` : 'all passed'} (${results.length} checks)`);
process.exit(failures ? 1 : 0);
