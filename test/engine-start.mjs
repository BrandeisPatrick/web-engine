// Headless checks for the Engine's start-up and failure paths (src/core/Engine.js, header "Start-up" and "Lost WebGL
// context"), run on stand-in engines through Engine.prototype (Node has no WebGL): warmUp() draws its frames at dt 0
// with the systems' per-frame phases and no fixed step (systems: false = renderFn only), calls compileAsync once,
// waits on a GPU fence by polling clientWaitSync(sync, 0, 0) between tasks (never a blocking wait) with a timeout and a
// fallback without fences, and resolves (lost: true) instead of rejecting when the context is lost; a lost context
// stops the loop once, records the loss for the session and calls onContextLost; a frame that throws is logged with
// console.error and passed to onFrameError, or takes the lost path when the context is gone; start() does nothing
// after a loss. Run: node test/engine-start.mjs
import { Engine } from '../src/core/Engine.js';
import { CONTEXT_LOSS_KEY, contextLosses } from '../src/core/Quality.js';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}

// a browser-like sessionStorage (Quality.js reads it only when `window` exists)
const store = new Map();
globalThis.window = globalThis;
Object.defineProperty(globalThis, 'sessionStorage', {
  value: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  configurable: true, writable: true,
});

const GL = { SYNC_GPU_COMMANDS_COMPLETE: 0x9117, ALREADY_SIGNALED: 0x911a, TIMEOUT_EXPIRED: 0x911b, CONDITION_SATISFIED: 0x911c, WAIT_FAILED: 0x911d };
/** A fake WebGL2 context: the fence signals after `signalAfter` polls (Infinity: never); `fences: false` = WebGL1. */
function fakeGL({ signalAfter = 2, fences = true } = {}) {
  const gl = { ...GL, lost: false, polls: 0, waits: [], deleted: 0, flushed: 0, isContextLost() { return this.lost; }, flush() { this.flushed++; } };
  if (fences) {
    gl.fenceSync = () => ({ sync: true });
    gl.clientWaitSync = (sync, flags, timeout) => { gl.waits.push([flags, timeout]); return ++gl.polls > signalAfter ? GL.ALREADY_SIGNALED : GL.TIMEOUT_EXPIRED; };
    gl.deleteSync = () => { gl.deleted++; };
  }
  return gl;
}
/** A stand-in engine: Engine's methods on a plain object with a fake renderer, systems that log their calls. */
function fakeEngine(gl, { compileAsync = true } = {}) {
  const log = [];
  const e = Object.create(Engine.prototype);
  Object.assign(e, {
    scene: { isScene: true }, camera: { isCamera: true }, alpha: 0, time: 0, frameCount: 0, systems: [], contextLost: false,
    _running: false, _raf: 0, _notices: new Map(), _errorShown: false, log,
    renderer: {
      getContext: () => gl, info: { reset() {} },
      ...(compileAsync ? { compileAsync: (s, c) => { log.push(['compile', s === e.scene && c === e.camera]); return Promise.resolve(s); } } : {}),
    },
    renderFn: (s, c, dt) => log.push(['render', dt]),
    onContextLost: (ev) => log.push(['lost', ev]),
    onFrameError: (err) => log.push(['error', err.message]),
  });
  const sys = {
    __on: true, earlyUpdate: (dt) => log.push(['early', dt]), fixedUpdate: (dt) => log.push(['fixed', dt]),
    update: (dt, a) => log.push(['update', dt, a]), lateUpdate: (dt, a) => log.push(['late', dt, a]),
  };
  const off = { __on: false, update: () => log.push(['disabled']) };
  e.systems.push(sys, off);
  return e;
}
const count = (log, k) => log.filter((x) => x[0] === k).length;
// the engine's console.warn on a loss, kept out of the output
const warned = [], warn = console.warn;
console.warn = (...a) => warned.push(a.join(' '));
// no rAF in Node: cancelAnimationFrame for Engine.stop()
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || (() => {});

// ================================================================================================= warmUp
{
  const gl = fakeGL({ signalAfter: 2 }), e = fakeEngine(gl);
  const r = await e.warmUp();
  check('warmUp: 4 frames by default', r.frames === 4 && count(e.log, 'render') === 4, JSON.stringify(r));
  check('warmUp: every render at dt 0', e.log.filter((x) => x[0] === 'render').every((x) => x[1] === 0));
  check('warmUp: early / update / late once per frame, at dt 0', count(e.log, 'early') === 4 && count(e.log, 'update') === 4 && count(e.log, 'late') === 4
    && e.log.filter((x) => x[0] === 'early' || x[0] === 'update' || x[0] === 'late').every((x) => x[1] === 0));
  check('warmUp: no fixed step (the simulation does not move)', count(e.log, 'fixed') === 0);
  check('warmUp: a disabled system does not run', count(e.log, 'disabled') === 0);
  check('warmUp: phase order early -> update -> late -> render', e.log.slice(1, 5).map((x) => x[0]).join() === 'early,update,late,render', e.log.slice(1, 5).map((x) => x[0]).join());
  check('warmUp: compileAsync(scene, camera) once, first', count(e.log, 'compile') === 1 && e.log[0][0] === 'compile' && e.log[0][1] === true);
  check('warmUp: time and frameCount unchanged', e.time === 0 && e.frameCount === 0);
  check('warmUp: fence signaled after polling', r.fence === 'signaled' && gl.polls === 3 && gl.deleted === 1 && gl.flushed === 1, `${r.fence}, ${gl.polls} polls`);
  check('warmUp: every poll is non-blocking (clientWaitSync(sync, 0, 0))', gl.waits.length > 0 && gl.waits.every(([f, t]) => f === 0 && t === 0));
  check('warmUp: not lost', r.lost === false && e.contextLost === false && count(e.log, 'lost') === 0);
}
{
  const e = fakeEngine(fakeGL());
  const r = await e.warmUp({ frames: 2, systems: false, compile: false });
  check('warmUp({ systems: false }): renderFn only', r.frames === 2 && count(e.log, 'render') === 2 && count(e.log, 'update') === 0 && count(e.log, 'early') === 0 && count(e.log, 'late') === 0);
  check('warmUp({ compile: false }): no compileAsync', count(e.log, 'compile') === 0 && r.compileMs === 0);
}
{
  const e = fakeEngine(fakeGL({ fences: false }), { compileAsync: false });
  const r = await e.warmUp({ frames: 1 });
  check('warmUp without fences (WebGL1): fence "none", resolves', r.fence === 'none' && r.frames === 1 && !r.lost);
}
{
  const gl = fakeGL({ signalAfter: Infinity }), e = fakeEngine(gl);
  const t0 = performance.now();
  const r = await e.warmUp({ frames: 1, timeout: 60 });
  const ms = performance.now() - t0;
  check('warmUp: a fence that never signals times out', r.fence === 'timeout' && gl.deleted === 1 && ms < 1000, `${r.fence} after ${Math.round(ms)} ms`);
}
{
  // the context is lost after the 2nd frame: resolves lost, stops, records the loss once, calls onContextLost once
  store.clear();
  const gl = fakeGL(), e = fakeEngine(gl);
  let n = 0;
  e.renderFn = () => { e.log.push(['render', 0]); if (++n === 2) gl.lost = true; };
  const r = await e.warmUp();
  check('warmUp: lost context -> resolves { lost: true, fence: "lost" }', r.lost === true && r.fence === 'lost' && r.frames === 2, JSON.stringify(r));
  check('warmUp: lost -> engine.contextLost, onContextLost once', e.contextLost === true && count(e.log, 'lost') === 1);
  check('warmUp: lost -> the loss is recorded for the session', contextLosses() === 1 && store.get(CONTEXT_LOSS_KEY) === '1');
  check('warmUp: lost -> no frame after the loss', count(e.log, 'render') === 2);
}
{
  // a renderFn that throws on a live context rejects; one that throws on a lost context resolves lost
  const e = fakeEngine(fakeGL());
  e.renderFn = () => { throw new Error('shader exploded'); };
  let msg = '';
  try { await e.warmUp({ compile: false }); } catch (err) { msg = err.message; }
  check('warmUp: a frame error on a live context rejects', msg === 'shader exploded');
  const gl = fakeGL(), e2 = fakeEngine(gl);
  e2.renderFn = () => { gl.lost = true; throw new TypeError('WeakMap keys must be objects'); };
  const r = await e2.warmUp({ compile: false });
  check('warmUp: a frame error on a lost context resolves lost', r.lost === true && e2.contextLost === true);
}

// ================================================================================================= lost context, frame errors
{
  store.clear();
  const gl = fakeGL(), e = fakeEngine(gl);
  e._running = true;
  e._contextLost({ type: 'webglcontextlost' });
  e._contextLost({ type: 'webglcontextlost' }); // a second event (or a frame finding it lost) changes nothing
  check('lost: the loop stops, contextLost set', e._running === false && e.contextLost === true);
  check('lost: onContextLost once, with the event', count(e.log, 'lost') === 1 && e.log.find((x) => x[0] === 'lost')[1].type === 'webglcontextlost');
  check('lost: recorded once', contextLosses() === 1);
  let raf = 0;
  globalThis.requestAnimationFrame = () => ++raf;
  e.start();
  check('lost: start() does nothing afterwards', e._running === false && raf === 0);
  delete globalThis.requestAnimationFrame;
}
{
  // frame errors: console.error every time, onFrameError every time; a lost context takes the lost path instead
  const gl = fakeGL(), e = fakeEngine(gl);
  const errs = [], orig = console.error;
  console.error = (...a) => errs.push(a.map(String).join(' '));
  try {
    e._frameError(new Error('boom'));
    e._frameError(new Error('boom again'));
  } finally { console.error = orig; }
  check('frame error: logged with console.error (each one)', errs.length === 2 && /boom/.test(errs[0]) && /boom again/.test(errs[1]));
  check('frame error: onFrameError gets each error', count(e.log, 'error') === 2 && !e.contextLost);
  gl.lost = true;
  store.clear();
  e._frameError(new TypeError('WeakMap keys must be objects'));
  check('frame error on a lost context: the lost path, not an error', e.contextLost && count(e.log, 'lost') === 1 && count(e.log, 'error') === 2 && contextLosses() === 1);
}
{
  // the defaults: showFrameError shows one line for many errors; showContextLost a notice with a Reload button
  const e = Object.create(Engine.prototype);
  e._notices = new Map(); e._errorShown = false;
  const shown = [];
  e.showNotice = (text, o) => { shown.push([text, o]); return null; };
  e.showFrameError(new Error('a')); e.showFrameError(new Error('b'));
  check('showFrameError: the first error only, as an error line', shown.length === 1 && shown[0][0] === 'Error: a' && shown[0][1].kind === 'error');
  shown.length = 0;
  e.showContextLost();
  check('showContextLost: the lost text with a Reload button', shown.length === 1 && /graphics were reset/.test(shown[0][0]) && shown[0][1].button === 'Reload' && typeof shown[0][1].onButton === 'function');
  check('showNotice without a document: null', Engine.prototype.showNotice.call({ _notices: new Map() }, 'x') === null);
}

console.warn = warn;
check('lost: one console.warn per loss', warned.length > 0 && warned.every((w) => /WebGL context lost/.test(w)), `${warned.length}`);
delete globalThis.sessionStorage; delete globalThis.window;
console.log('Engine start-up, lost context, frame errors (src/core/Engine.js)\n');
for (const r of results) console.log(r);
console.log(`\n${failures ? `${failures} FAILED` : 'all passed'} (${results.length} checks)`);
process.exit(failures ? 1 : 0);
