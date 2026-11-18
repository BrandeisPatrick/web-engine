// Headless checks for the sound kit's voice policy and mixer graph on a fake AudioContext (Node has no Web Audio):
// VoicePool caps, priority and stealing order; SoundBank's inert voice before the gesture, deferred loops, routing,
// caps and stealing through real plays, round-robin variants, per-play jitter, followers; AudioBus: the default graph
// is today's (buses -> master -> compressor -> destination, nothing else), the 'safe' graph, setPaused, setMuffle,
// duck and the offline flag; prepare() (the context before the gesture, loops rendered ahead, start() takes both).
// Run: node test/audio-voices.mjs
import { VoicePool } from '../src/audio/VoicePool.js';
import { SoundBank, INERT_VOICE } from '../src/audio/SoundBank.js';
import { AudioBus, SAFE_MASTER } from '../src/audio/AudioBus.js';
import { Footsteps } from '../src/audio/Footsteps.js';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}

// ------------------------------------------------------------------------------------------------- fake context
class Param {
  constructor(v = 0) { this.value = v; this.calls = []; }
  _c(kind, v, t, x) { this.calls.push([kind, v, t, x]); return this; }
  setValueAtTime(v, t) { this.value = v; return this._c('set', v, t); }
  setTargetAtTime(v, t, tc) { return this._c('target', v, t, tc); }
  linearRampToValueAtTime(v, t) { return this._c('linear', v, t); }
  exponentialRampToValueAtTime(v, t) { return this._c('exp', v, t); }
  cancelScheduledValues(t) { return this._c('cancel', 0, t); }
  /** last target / set value scheduled */
  get last() { for (let i = this.calls.length - 1; i >= 0; i--) if (this.calls[i][0] !== 'cancel') return this.calls[i][1]; return this.value; }
}
class Node {
  constructor(ctx, kind) { this.context = ctx; this.kind = kind; this.outs = []; ctx.nodes.push(this); }
  connect(n) { this.outs.push(n); return n; }
  disconnect(n) { if (n === undefined) this.outs = []; else { const i = this.outs.indexOf(n); if (i < 0) throw new Error('not connected'); this.outs.splice(i, 1); } }
}
class FakeContext {
  constructor({ offline = false } = {}) {
    this.nodes = []; this.currentTime = 0; this.sampleRate = 48000; this.state = offline ? 'suspended' : 'running';
    this.destination = new Node(this, 'destination');
    this.listener = { positionX: new Param(), positionY: new Param(), positionZ: new Param(), forwardX: new Param(), forwardY: new Param(), forwardZ: new Param(), upX: new Param(), upY: new Param(), upZ: new Param() };
    if (offline) this.startRendering = () => Promise.resolve(null);
  }
  createGain() { const n = new Node(this, 'gain'); n.gain = new Param(1); return n; }
  createDynamicsCompressor() { const n = new Node(this, 'compressor'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(); return n; }
  createWaveShaper() { const n = new Node(this, 'shaper'); n.curve = null; n.oversample = 'none'; return n; }
  createBiquadFilter() { const n = new Node(this, 'filter'); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); n.type = 'lowpass'; return n; }
  createPanner() { const n = new Node(this, 'panner'); for (const k of ['positionX', 'positionY', 'positionZ', 'orientationX', 'orientationY', 'orientationZ']) n[k] = new Param(); return n; }
  createBuffer(ch, len, sr) { const d = new Float32Array(len); return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => d, copyToChannel: (x) => d.set(x) }; }
  createBufferSource() {
    const n = new Node(this, 'source'); n.buffer = null; n.loop = false; n.playbackRate = new Param(1); n.onended = null; n.started = null; n.stopped = null;
    n.start = (t = 0, off = 0) => { n.started = [t, off]; }; n.stop = (t = 0) => { n.stopped = t; };
    n.end = () => { if (n.onended) n.onended(); };
    return n;
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
const types = (ns) => ns.map((n) => n.kind).join(',');
const reaches = (from, to) => { const seen = new Set(), st = [from]; while (st.length) { const n = st.pop(); if (n === to) return true; if (seen.has(n)) continue; seen.add(n); st.push(...n.outs); } return false; };

// ================================================================================================= VoicePool
{
  const p = new VoicePool({ max: 3 });
  const v = () => ({});
  const a = p.add(v(), 'step', 5), b = p.add(v(), 'step', 5);
  check('pool: a third step with cap 2 steals the oldest step', p.admit('step', 5, 2)?.steal === a);
  check('pool: another sound with a free slot gets the free slot', p.admit('chime', 5, 2)?.steal === null);
  const c = p.add(v(), 'thud', 7);
  check('pool: full, new priority 3 is refused (no voice at or below 3)', p.admit('click', 3, 4) === null);
  check('pool: full, new priority 5 steals the lowest priority, oldest first', p.admit('click', 5, 4)?.steal === a);
  p.remove(a);
  check('pool: remove frees the slot', p.size === 2 && p.admit('click', 1, 4)?.steal === null);
  p.add(v(), 'click', 9);
  check('pool: full, priority 9 steals the lowest (step 5) not the thud (7)', p.admit('chime', 9, 4)?.steal === b && c.priority === 7);
  check('pool: count by name', p.count('click') === 1 && p.count('step') === 1);
}

// ================================================================================================= AudioBus graphs
{
  // the default chain must be today's: buses -> master -> compressor -> destination, master gain carries the volume
  const ctx = new FakeContext();
  const bus = new AudioBus({ context: ctx, volume: 0.6 });
  bus.start();
  check('default: graph is gain(master), compressor, 4 bus gains and nothing else', types(ctx.nodes) === 'destination,gain,compressor,gain,gain,gain,gain', types(ctx.nodes));
  check('default: master -> compressor -> destination; every bus -> master', bus.master.outs[0] === bus.compressor && bus.compressor.outs[0] === ctx.destination
    && Object.values(bus.buses).every((g) => g.outs.length === 1 && g.outs[0] === bus.master));
  check('default: compressor at main\'s settings (-14 dB, knee 12, ratio 4)', bus.compressor.threshold.value === -14 && bus.compressor.knee.value === 12 && bus.compressor.ratio.value === 4);
  check('default: volume on the master gain, output null', bus.master.gain.last === 0.6 && bus.output === null && bus.mode === 'default');
  check('default: not offline, live while running', !bus.offline && bus.live);
  bus.setPaused(true);
  check('default: setPaused fades engine / effects / ambience to 0, leaves ui', bus.buses.effects.gain.last === 0 && bus.buses.ambience.gain.last === 0 && bus.buses.ui.gain.calls.length === 0);
  bus.setBusVolume('effects', 0.5);
  check('default: setBusVolume while paused stays silent', bus.buses.effects.gain.last === 0 && bus.getBusVolume('effects') === 0.5);
  bus.setPaused(false);
  check('default: unpause returns each bus to its volume', bus.buses.effects.gain.last === 0.5 && bus.buses.engine.gain.last === 1);
  const before = ctx.nodes.length;
  bus.setMuffle(0);
  check('default: setMuffle(0) before any muffle adds nothing', ctx.nodes.length === before);
  bus.setMuffle(1);
  const f = ctx.nodes[ctx.nodes.length - 1];
  check('default: setMuffle(1) inserts one low-pass at 600 Hz between the world buses and the master', f.kind === 'filter' && f.type === 'lowpass' && Math.abs(f.frequency.last - 600) < 1
    && bus.buses.effects.outs[0] === f && f.outs[0] === bus.master && bus.buses.ui.outs[0] === bus.master);
  bus.duck('ambience', 0.4, 4);
  const dc = bus.buses.ambience.gain.calls.filter((c) => c[0] === 'target').slice(-2);
  check('duck: drops to 0.4 of the volume, then recovers to it with tc 1/4', dc[0][1] === 0.4 && dc[1][1] === 1 && Math.abs(dc[1][3] - 0.25) < 1e-9);
}
{
  const ctx = new FakeContext({ offline: true });
  const bus = new AudioBus({ master: 'safe', context: ctx, volume: 0.8 });
  let started = 0;
  bus.onStart(() => started++);
  bus.start();
  const comp = bus.compressor, chain = [bus.master, comp, comp.outs[0], comp.outs[0].outs[0], bus.output, ctx.destination];
  check('safe: master -> compressor -> make-up -> soft clipper -> volume -> destination', chain.every((n, i) => i === 0 || chain[i - 1].outs.includes(n))
    && chain[3].kind === 'shaper' && chain[3].oversample === '2x' && chain[2].gain.value === SAFE_MASTER.makeup * 0.5);
  check('safe: compressor at SAFE_MASTER', comp.threshold.value === SAFE_MASTER.threshold && comp.ratio.value === SAFE_MASTER.ratio && comp.attack.value === SAFE_MASTER.attack);
  const curve = chain[3].curve, at = (x) => curve[Math.round((x / 2 + 1) / 2 * (curve.length - 1))];
  check('safe: clipper linear to 0.6, soft above, never over 1', Math.abs(at(0.3) - 0.3) < 0.003 && at(1) < 0.92 && at(1) > 0.85 && Math.max(...curve) < 1);
  check('safe: volume on the output gain, master sum at 1', bus.output.gain.last === 0.8 && bus.master.gain.value === 1);
  check('safe: world buses through the muffle filter, ui straight to the sum', reaches(bus.buses.effects, bus._muffle) && bus.buses.ui.outs[0] === bus.master);
  check('safe: injected offline context: started without a gesture, offline and live', started === 1 && bus.offline && bus.live && !bus.running);
  bus.setVolume(0.3);
  check('safe: setVolume moves the output gain', bus.output.gain.last === 0.3);
}

// ================================================================================================= SoundBank on the fake
{
  const ctx = new FakeContext();
  const bus = new AudioBus({ master: 'safe', context: ctx });
  const sfx = new SoundBank(bus, { maxVoices: 6 });
  check('bank: play before start returns the inert voice', sfx.play('step.wood') === INERT_VOICE && INERT_VOICE.stop(0.1) === INERT_VOICE);
  const hum = sfx.loop('lamp.hum', { gain: 0.3 });
  hum.setRate(1.1);
  check('bank: loop before start is a waiting handle', hum.playing && hum.voice === null);
  let threw = '';
  try { sfx.play('step.mud'); } catch (e) { threw = e.message; }
  check('bank: unknown names throw and list the known ones', /no sound 'step\.mud'.*step\.wood/.test(threw));
  bus.start();
  check('bank: the waiting loop starts with the bus, keeping gain and rate', hum.voice && hum.voice.source.loop && hum.voice.source.playbackRate.value === 1.1
    && hum.voice.gain.gain.calls.some((c) => c[0] === 'target' && c[1] === 0.3) && reaches(hum.voice.source, bus.buses.effects));
  const v = sfx.play('ui.click');
  check('bank: a ui sound routes to the ui bus', v.playing && reaches(v.source, bus.buses.ui) && !reaches(v.source, bus._muffle));
  const p = sfx.play('impact.wood', { at: [3, 0, -4] });
  check('bank: `at` routes through a panner at that point (inverse, the preset refDistance)', p.panner && p.panner.positionX.value === 3 && p.panner.positionZ.value === -4
    && p.panner.refDistance === 6 && p.panner.distanceModel === 'inverse');
  const woods = [];
  for (let i = 0; i < 5; i++) woods.push(sfx.play('step.wood'));
  check('bank: cap 4: the fifth step steals the first (faded, out of the pool)', !woods[0].playing && woods.slice(1).every((w) => w.playing) && sfx.pool.count('step.wood') === 4);
  check('bank: a stolen voice fades over 4 ms', woods[0].gain.gain.calls.some((c) => c[0] === 'linear' && c[1] === 0 && Math.abs(c[2] - 0.004) < 1e-9));
  // pool is now full (ui.click, impact.wood, 4 x step.wood = 6): a priority-5 sound may steal a step (5), not more
  check('bank: full pool: a step-priority sound steals the oldest step', sfx.play('step.grass').playing && sfx.pool.count('step.wood') === 3);
  for (let i = 0; i < 3; i++) sfx.play('impact.metal');
  sfx.play('impact.thud'); sfx.play('impact.thud');
  check('bank: pool of high-priority voices refuses a footstep (inert)', sfx.play('step.concrete') === INERT_VOICE, `voices ${sfx.voices}`);
  const live = [...sfx.pool.voices];
  live[0].source.end();
  check('bank: an ended voice leaves the pool', sfx.voices === live.length - 1);
  // variants and jitter
  const ctx2 = new FakeContext(), bus2 = new AudioBus({ context: ctx2 }), b2 = new SoundBank(bus2, { seed: 5, maxVoices: 100 });
  bus2.start();
  const bufs = [], rates = [], gains = [];
  for (let i = 0; i < 24; i++) { const s = b2.play('step.gravel'); bufs.push(s.source.buffer); rates.push(s.source.playbackRate.value); gains.push(s.gain.gain.value); s.source.end(); }
  check('bank: round-robin uses every variant and never repeats one back to back', new Set(bufs).size === 6 && bufs.every((x, i) => i === 0 || x !== bufs[i - 1]));
  check('bank: pitch jitter within +-3.5 %, gain -0..8 %', rates.every((r) => Math.abs(r - 1) <= 0.035) && gains.every((g) => g <= 1 && g >= 0.92) && new Set(rates).size > 20);
  const ctx3 = new FakeContext(), bus3 = new AudioBus({ context: ctx3 }), b3 = new SoundBank(bus3, { seed: 5, maxVoices: 100 });
  bus3.start();
  const rates3 = []; for (let i = 0; i < 24; i++) { const s = b3.play('step.gravel'); rates3.push(s.source.playbackRate.value); s.source.end(); }
  check('bank: same seed, same per-play variation', rates3.join() === rates.join());
  const obj = { matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 1, 2, 1] }, updateWorldMatrix() {} };
  const f = b2.play('impact.metal', { at: obj });
  obj.matrixWorld.elements[12] = 9;
  b2.update(1 / 60);
  check('bank: a voice at an Object3D follows it in update()', f.panner.positionX.value === 7 && f.panner.positionX.last === 9);
  hum.stop(0.5);
  check('bank: loop stop fades and ends', !hum.playing && hum.voice.source.stopped > 0.5);
  sfx.stopAll(0);
  check('bank: stopAll empties the pool', sfx.voices === 0);
}

// ================================================================================================= Footsteps
{
  const played = [];
  const stub = { play: (name, o) => { played.push([name, o.gain]); return INERT_VOICE; } };
  const steps = new Footsteps(stub, { surface: 'grass' });
  const run = (speed, seconds, extra = {}) => { const n0 = played.length; for (let t = 0; t < seconds; t += 1 / 120) steps.update(1 / 120, { speed, grounded: true, ...extra }); return played.length - n0; };
  const walk = run(2, 10);
  check('footsteps: walking at 2 m/s gives about 2.1 steps a second', walk >= 20 && walk <= 22, `${walk} in 10 s`);
  const sprint = run(5.5, 10);
  check('footsteps: running at 5.5 m/s gives about 2.6 steps a second', sprint >= 25 && sprint <= 27, `${sprint} in 10 s`);
  check('footsteps: step.<surface>, louder when running', played[0][0] === 'step.grass' && played[played.length - 1][1] > played[0][1]);
  check('footsteps: none while standing or airborne', run(0, 2) === 0 && run(4, 2, { grounded: false }) === 0);
  steps.update(1 / 120, { speed: 0, grounded: true, landed: true, landingSpeed: 7 });
  steps.update(1 / 120, { speed: 0, grounded: true, landed: true, landingSpeed: 3 });
  steps.update(1 / 120, { speed: 0, grounded: true, landed: true, landingSpeed: 1 });
  check('footsteps: landings by speed: hard, soft, a footfall', played.slice(-3).map((p) => p[0]).join() === 'land.hard,land.soft,step.grass');
  steps.surface = (x, z) => (x > 0 ? 'wood' : 'gravel'); steps.at = [1, 0, 0];
  run(2, 1);
  check('footsteps: surface lookup by position', played[played.length - 1][0] === 'step.wood');
}

// ------------------------------------------------------------------------------------------------- prepare()
// AudioBus.prepare() before the gesture: the context created then, suspended, and taken by start() (resumed there);
// a SoundBank's waiting loops rendered ahead, the same samples a first use renders; ctx / bus() still null until start
{
  const made = [];
  class WinContext extends FakeContext {
    constructor(o) { super(); this.state = WinContext.initial; this.opts = o; this.resumes = 0; this.suspends = 0; made.push(this); }
    resume() { this.resumes++; return super.resume(); }
    suspend() { this.suspends++; return super.suspend(); }
  }
  WinContext.initial = 'suspended';
  const prevWin = globalThis.window;
  globalThis.window = { AudioContext: WinContext };
  const hash = (x) => { let h = 0; for (let i = 0; i < x.length; i++) h = (h * 31 + Math.round(x[i] * 1e6)) | 0; return h; };
  try {
    const bus = new AudioBus({ master: 'safe' });
    const bank = new SoundBank(bus);
    bank.loop('road.roar', { gain: 0 }); bank.loop('wind.rush', { gain: 0 });
    const p1 = bus.prepare();
    check('prepare: the context is created at once (suspended), ctx and buses still wait for start', made.length === 1 && made[0].state === 'suspended'
      && bus.ctx === null && !bus.started && bus.bus('engine') === null && made[0].opts.latencyHint === 'interactive');
    check('prepare: twice is the same promise, one context', bus.prepare() === p1 && made.length === 1);
    await p1;
    const want = hash(bank.render('road.roar', 0));
    check('prepare: the waiting loops rendered ahead (the samples a first use renders)', bank._samples.size === 2 && hash(bank._samples.get('road.roar#0')) === want);
    await bus.start();
    const src = made[0].nodes.filter((n) => n.kind === 'source');
    check('start: takes the prepared context (no second one) and resumes it', bus.ctx === made[0] && made.length === 1 && made[0].resumes === 1 && made[0].state === 'running');
    check('start: the loops play the prepared samples, and the bank lets go of them', src.length === 2 && hash(src[0].buffer.getChannelData(0)) === want && bank._samples.size === 0);

    // without prepare(): as before, the context comes with start()
    const bus2 = new AudioBus(), bank2 = new SoundBank(bus2); bank2.loop('road.roar');
    await bus2.start();
    check('no prepare: start() creates the context, the loop renders then (same samples)', made.length === 2 && bus2.ctx === made[1]
      && hash(made[1].nodes.find((n) => n.kind === 'source').buffer.getChannelData(0)) === want);

    // a context the autoplay policy lets run at once waits suspended until start()
    WinContext.initial = 'running';
    const bus3 = new AudioBus();
    await bus3.prepare();
    check('prepare: a context that starts running is suspended until start()', made.length === 3 && made[2].suspends === 1 && made[2].state === 'suspended');
    await bus3.start();
    check('... and start() resumes it', made[2].state === 'running' && made[2].resumes === 1);
    WinContext.initial = 'suspended';

    // jobs: one added after prepare() still runs; a failing one warns and does not reject; one-shots by name
    const bus4 = new AudioBus(), bank4 = new SoundBank(bus4), order = [];
    bus4.onPrepare(() => { order.push('a'); });
    bus4.onPrepare(() => { throw new Error('boom'); });
    const warn = console.warn; const warned = []; console.warn = (...a) => warned.push(a.join(' '));
    const p4 = bus4.prepare();
    bus4.onPrepare(() => { order.push('late'); });
    await bus4.prepare();
    console.warn = warn;
    check('jobs: run in order, one added later too; a failing job is logged, prepare() resolves', order.join() === 'a,late' && warned.length === 1 && /prepare job failed/.test(warned[0]) && p4 !== undefined);
    await bank4.prepare(['impact.thud']);
    check('bank.prepare(names): every variant of a one-shot', [0, 1, 2, 3].every((v) => bank4._samples.has(`impact.thud#${v}`)) && bank4._samples.size === 4, [...bank4._samples.keys()].join());

    // an injected context: prepare() creates none; dispose() before start closes the prepared one
    const n0 = made.length;
    const bus5 = new AudioBus({ context: new FakeContext({ offline: true }) });
    await bus5.prepare();
    check('injected context: prepare() creates no other', made.length === n0);
    const bus6 = new AudioBus(); bus6.prepare(); bus6.dispose();
    check('dispose before start closes the prepared context', made.length === n0 + 1 && made[n0].state === 'closed' && bus6.ctx === null);
  } finally {
    if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin;
  }
}

for (const r of results) console.log(r);
console.log(`\naudio-voices: ${results.length - failures} / ${results.length} checks pass`);
process.exit(failures ? 1 : 0);
