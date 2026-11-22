// Engine core: renderer, scene, camera, fixed-step simulation loop with per-frame render,
// systems registry, resize, adaptive resolution, profiler. No game knowledge.
//
// A system is any object with some of:
//   load?(onProgress(p 0..1, label))   awaited in registration order by engine.load() (weight: loadWeight, default 1)
//   earlyUpdate?(dt)                    once per frame BEFORE the fixed steps (input polling, edge-triggered actions)
//   fixedUpdate?(fixedDt)               0..maxSubsteps times per frame at fixedHz (simulation)
//   update?(dt, alpha)                  once per frame after the fixed steps (alpha = interpolation factor)
//   lateUpdate?(dt, alpha)              once per frame after every update (things that follow the final camera)
//   dispose?()
// Each phase runs systems in registration order, except that a system with a numeric `priority` field runs before
// systems with a higher value (default 0; equal priorities keep registration order; read once by addSystem).
// `engine.setSystemEnabled(systemOrName, false)` skips a system in every phase until it is enabled again (a
// dedicated flag, not the system's own `enabled` field: InputMap, Ambience and the rigs give that field a meaning
// of their own and keep running while it is false).
// `engine.clock` (core/Clock.js) scales the frame time: `timeScale` slows or speeds the simulation and the per-frame
// dt, `paused` stops both (the loop keeps rendering), `step(n)` runs n fixed steps while paused. The profiler, the
// overlay and adaptive resolution always see the unscaled wall dt. Per-system CPU time (all phases, summed per frame) is
// recorded in engine.profiler under the system's name, plus 'sim' (whole fixed loop) and 'render'.
//
// Frame pacing. requestAnimationFrame drives tick(). `targetFps` (option and live property; 0 = tick on every
// callback, the default) caps the tick rate: a callback ticks once the time since the last tick is at least
// 1000 / targetFps - 1 ms. The 1 ms absorbs timestamp jitter and timer clamping, so 60 on a 120 Hz screen ticks on
// every 2nd callback and never stretches to a 3rd; a cap that does not divide the refresh rate settles on the next
// rate below it that does (50 on 120 Hz runs at 40), so intervals stay even. Skipped callbacks only sample the
// refresh rate; dt is the real time since the previous tick (the fixed-step accumulator sees skipped time once,
// still bounded by maxSubsteps). `refreshRate` (Hz, 0 until known) is the display rate from the raw callback
// interval, ticked or not (estimator in _frame); until it is known (~5 callbacks after start(), 10 at most) the
// callbacks only measure, because a heavy first frame would show the frame rate instead of the screen's.
// Adaptive resolution (every 2 s, steps of 0.25): budget = 1000 / 60 ms while uncapped (the original 18.5 / 11.5 ms
// thresholds: the pixel ratio drops when the tick-interval EMA exceeds 1.11 x budget and rises under 0.69 x budget),
// so a 120 Hz screen keeps full resolution at 60 fps as before; with targetFps the budget is 1000 / min(targetFps,
// max(refreshRate, 60)) ms, e.g. targetFps 120 on a 120 Hz display = 9.25 / 5.75 ms (chases 120 fps at lower
// resolution), targetFps 60 anywhere = 18.5 / 11.5 ms. A reading under 60 Hz is not trusted for the budget (a scene
// missing every other vsync from its first frame looks exactly like a 30 Hz screen).
// Every step is judged at the next check. A step down that did not make the frame faster (EMA not 5 % below the one
// before it: a frame held up by the main thread, or by a wait on the GPU, does not get faster with fewer pixels) is
// undone, and the ratio does not go below the one it came back to for 30 s, doubling (to 240 s) while retries keep
// failing. A step up that put the EMA over 1.11 x budget is undone, and no step up follows for 30 s, doubling the same
// way. Climbing: under 0.69 x budget; where the loop's shortest interval (the display's period, or 1000 / targetFps)
// is not below 0.69 x budget, the interval cannot show room (vsync: 16.7 ms on a 60 Hz screen however light the
// frame), so frames that fit (EMA within 3 % of that period and of the budget) climb as a probe, kept or undone at the
// next check.
// Internal scale first (`renderScales`, e.g. the desktop tier's [1, 0.87, 0.75], with `onRenderScale` set, e.g.
// `engine.onRenderScale = (s) => postfx.set('renderScale', s)`, TAA's temporal upscaling): the ladder is then every
// scale at the full ratio, then the ratio's steps at the lowest scale; a step down takes the next scale before any
// ratio step, a step up takes the ratio back first. A scale step keeps the canvas and the output size (the TAA history
// survives it). The holds and back-off above apply to the whole ladder (the floor is pixel ratio x scale). Without
// both (the default; the mobile tier has no TAA and no `renderScales`) only the pixel ratio steps, as before. Set the
// scales only where the scale takes effect (PostFX with TAA): a step that changes nothing is undone and held like any.
//
// Renderer: a WebGLRenderer (antialias, high-performance, sRGB output, ACES filmic, shadow maps; `o.renderer` adds
// options), info.autoReset off (reset once per frame in tick()). Its context gets a pixel-store shadow
// (core/PixelStoreShadow.js, `engine.pixelStore`): three reads three unpack pixel-store values with gl.getParameter on
// every partial texture upload (texture.updateRanges: the clustered light lists, the GPU particles' spawn rows, every
// frame), and in Chrome each read waits for the GPU to finish what was queued before it; the shadow answers them from
// what pixelStorei set. Same calls to the GPU, same picture; the played frame of nyc-night went from 16 to 8.5 ms.
//
// Start-up: `await engine.warmUp()` before `engine.start()`, while the loading screen still covers the page. A
// renderer compiles the scene's programs at their first draw (ANGLE's Metal backend, which every iOS browser and Chrome
// on a Mac use, builds the pipeline state there too), and textures and geometry upload then, so without it the first
// live frame stalls for seconds on a phone with the loading screen already gone (a black canvas under the HUD).
// warmUp({ frames = 4, systems = true, timeout = 15000, compile = true }): one paint first (a label set just before
// shows), then renderer.compileAsync(scene, camera) (non-blocking linking where KHR_parallel_shader_compile exists;
// programs the game compiled itself are cached), then `frames` warm frames with a task between them, then a GPU fence
// (fenceSync, polled with clientWaitSync(sync, 0, 0) on a timer, so the main thread stays free while the GPU finishes).
// A warm frame is what a frame on a paused clock does: every enabled system's earlyUpdate(0), update(0, alpha) and
// lateUpdate(0, alpha), no fixed step (the simulation does not move, time does not advance), then
// renderFn(scene, camera, 0). The update phases let the first frame's per-frame state settle before it is drawn: a
// camera rig places the camera, a light pool switches its lights on (a different light count is a different program
// for every lit material: on a phone the first live frame would compile them again). `systems: false` draws renderFn
// only, for a page whose state must not change before its captures (the bench harness's poses). 4 frames reach a
// renderFn's every-2nd-, 3rd- and 4th-frame work at least once and end the 2- and 4-frame schedules in the phase they
// started in; a multiple of 12 ends all three in phase (the demos' bench pages use 12). Not counted in frameCount, the
// profiler or adaptive resolution. Resolves { frames, ms, compileMs, fence: 'signaled' |
// 'timeout' | 'none' (no fences) | 'lost', lost }; never rejects on a lost context (lost: true; onContextLost has
// run). An error a frame throws rejects (the game's boot shows it). With adaptive resolution's scales below the current
// one (`renderScales`, `onRenderScale` set) the LAST warm frame is drawn at the first of them and the scale is set back
// right after it: TAA's upscaling variants (TAA, final pass, motion blur, DoF) compile under the loading screen and the
// materials keep both programs, so a step in play compiles nothing (nyc-night: 4 compiles and 2 links, a missed frame,
// before). The last frame, because the upscale define is then added after every other define, in the order a step in
// play adds it (a program's cache key follows the define order: frame 1 compiled a variant play never used). The
// frame count, and so the warm frames' schedule phases, are unchanged; the TAA history keeps that frame's samples.
//
// Lost WebGL context (phones drop it under GPU memory pressure): on `webglcontextlost` of the canvas the loop stops
// (no frame runs on the dead context), `engine.contextLost` becomes true, the loss is recorded for the browser session
// (core/Quality.js recordContextLoss: the next resolveQuality() comes up lighter) and `engine.onContextLost(event)`
// runs; its default (showContextLost) shows a notice with a Reload button. A frame that throws on a context that is
// already lost (before the event arrives) takes the same path. start() does nothing afterwards. There is no
// re-initialisation on `webglcontextrestored`: reloading is the robust path. A tab the OS kills for memory sends no
// event at all: after BOOT_HEALTHY_SECONDS (15 s) of frames the loop calls core/Quality.js bootHealthy(), which clears
// the page's boot marker (a marker still there at the next boot means the run died: that load comes up lighter).
// Frame errors: an exception in tick() is caught, logged with console.error (every one, as an uncaught error was) and
// passed to `engine.onFrameError(error)`; its default (showFrameError) shows the first one as a line at the bottom of
// the page (a phone user can screenshot it). The loop keeps running, as before.
// showNotice(text, { button, onButton, kind = 'notice' | 'error', id }) -> HTMLElement: plain DOM over the page (the
// ui layer's CSS variables when its theme is on the page, its values as fallbacks); one element per id (default: the
// kind), a second call replaces the text. Set the hooks to replace these with a game's own UI.
import * as THREE from 'three';
import { Profiler, ProfilerOverlay } from './Profiler.js';
import { Clock } from './Clock.js';
import { recordContextLoss, bootHealthy, BOOT_HEALTHY_SECONDS } from './Quality.js';
import { shadowPixelStore } from './PixelStoreShadow.js';

const noop = () => {};
const now = () => performance.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** One rendering opportunity (rAF, then a task after it), or 100 ms where rAF does not run (a hidden tab). */
const nextPaint = () => new Promise((r) => {
  const t = setTimeout(r, 100);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(() => { clearTimeout(t); r(); }, 0));
});
/** The default lost-context text. */
const CONTEXT_LOST_TEXT = 'The graphics were reset by the device, probably low on memory.';
// notices (showNotice): the ui theme's variables with its values as fallbacks (core does not import the ui layer)
const FONT = 'var(--ui-font,-apple-system,system-ui,"Segoe UI",Roboto,sans-serif)';
const NOTICE_CSS = {
  notice: `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:max-content;max-width:min(420px,calc(100vw - 32px));
    box-sizing:border-box;padding:20px 22px;border-radius:var(--ui-radius,18px);background:rgba(10,12,16,.94);
    border:1px solid var(--ui-glass-border,rgba(255,255,255,.12));box-shadow:0 10px 40px rgba(0,0,0,.5);
    color:var(--ui-text,#f2f4f7);font:400 16px/1.45 ${FONT};text-align:center`,
  error: `position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));box-sizing:border-box;padding:8px 12px;
    border-radius:10px;background:rgba(40,8,12,.92);border:1px solid rgba(255,120,120,.35);color:#ffd0d0;
    font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;text-align:left;word-break:break-word`,
};
const NOTICE_BUTTON_CSS = `display:inline-block;margin-top:14px;min-height:44px;min-width:120px;padding:10px 22px;border:0;
  border-radius:999px;background:var(--ui-accent,#e82127);color:#fff;font:600 15px/1 ${FONT};cursor:pointer`;

export class Engine {
  /**
   * @param {object} [o]
   * @param {HTMLElement} [o.container=document.body]
   * @param {number} [o.fixedHz=120]
   * @param {number} [o.maxSubsteps=4]
   * @param {number} [o.targetFps=0]  cap on ticks per second, 0 = every rAF callback (live: engine.targetFps = 60;
   *   see header). At or below fixedHz / maxSubsteps (30 by default) a tick needs every substep and jitter makes the
   *   simulation drop time (slow motion): raise maxSubsteps for caps that low.
   * @param {boolean} [o.adaptiveResolution=true]  scale the internal scale / pixel ratio to hold the frame budget (see header)
   * @param {number} [o.maxPixelRatio=2]
   * @param {number[]} [o.renderScales=[]]  internal scales adaptive resolution steps through first, from 1 down, when
   *   onRenderScale is set (see header)
   * @param {object} [o.renderer]  extra WebGLRenderer options (e.g. { antialias: false } when post-processing)
   * @param {boolean} [o.shadows=true]
   * @param {number} [o.shadowType=THREE.PCFShadowMap]
   * @param {number} [o.exposure=0.9]  tone-mapping exposure (ACES filmic)
   * @param {number} [o.fov=60] [o.near=0.1] [o.far=6000]
   * @param {boolean} [o.overlay=true]  F3 profiler overlay
   * @param {HTMLElement} [o.overlayParent=document.body]
   * @param {number|boolean} [o.profile=false]  dump profiler.snapshot() with console.table after N s (true = 10 s)
   * @param {object} [o.physics]  optional physics world, exposed as engine.physics (e.g. a PhysicsWorld)
   * @param {Clock} [o.clock]  time control (default: a new Clock at timeScale 1, not paused)
   */
  constructor(o = {}) {
    this.container = o.container || document.body;
    this.fixedDt = 1 / (o.fixedHz || 120);
    this.maxSubsteps = o.maxSubsteps || 4;
    this.clock = o.clock || new Clock();
    this.systems = [];
    this.physics = o.physics || null;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', ...(o.renderer || {}) });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = o.exposure ?? 0.9;
    this.renderer.shadowMap.enabled = o.shadows !== false;
    this.renderer.shadowMap.type = o.shadowType ?? THREE.PCFShadowMap;
    this.renderer.info.autoReset = false; // reset once per frame in tick(): stats cover every pass of the frame
    /** The context's pixel-store shadow (header "Renderer"; null without WebGL2). */
    this.pixelStore = shadowPixelStore(this.renderer.getContext());
    this.container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(o.fov || 60, 1, o.near || 0.1, o.far || 6000);
    this.profiler = new Profiler(this.renderer);
    this.overlay = o.overlay === false ? null : new ProfilerOverlay(this.profiler, o.overlayParent || document.body);
    this.maxPR = Math.min(window.devicePixelRatio || 1, o.maxPixelRatio ?? 2);
    this.adaptive = o.adaptiveResolution !== false;
    /** Internal scales adaptive resolution tries before the pixel ratio (header); live. */
    this.renderScales = o.renderScales ? [...o.renderScales] : [];
    /** The internal scale adaptive resolution set last (1 until it steps one). */
    this.renderScale = 1;
    /**
     * Applies an internal scale for adaptive resolution: `(s) => postfx.set('renderScale', s)`; null (default) = the
     * pixel ratio only (see header).
     * @type {((scale: number) => void) | null}
     */
    this.onRenderScale = null;
    this.pixelRatio = this.maxPR; this._resetAdaptive();
    /** Cap on ticks per second, 0 = every rAF callback (default). Live: read on every callback. */
    this.targetFps = o.targetFps > 0 ? +o.targetFps : 0;
    /** Display refresh rate (Hz) estimated from rAF timestamps; 0 until known. */
    this.refreshRate = 0;
    this._rafT = 0; this._rafMs = 0; this._rafN = 0; this._rafLong = 0; this._calib = 0; // refresh estimator (_frame)
    /**
     * Draws the frame; replace it to render through post-processing: `engine.renderFn = (scene, camera, dt) =>
     * postfx.render(dt)`. dt: the frame's (scaled) seconds.
     * @type {(scene: THREE.Scene, camera: THREE.PerspectiveCamera, dt: number) => void}
     */
    this.renderFn = (scene, camera) => this.renderer.render(scene, camera);
    /**
     * Called with (cssWidth, cssHeight, pixelRatio) on resize / pixel-ratio changes; hook post-processing here:
     * `engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr)` (the camera aspect is already updated).
     * @type {(width: number, height: number, pixelRatio: number) => void}
     */
    this.onResize = noop;
    /** True once the WebGL context is lost (see header); the loop has stopped and start() does nothing. */
    this.contextLost = false;
    /**
     * Called once when the WebGL context is lost, after the loop stopped (see header). Default: a notice with a
     * Reload button. Replace it with a game's own message; `() => {}` shows nothing.
     * @type {(event: Event | null) => void}
     */
    this.onContextLost = () => this.showContextLost();
    /**
     * Called with each error a frame throws, after console.error (see header). Default: the first one as a line at the
     * bottom of the page.
     * @type {(error: any) => void}
     */
    this.onFrameError = (e) => this.showFrameError(e);
    this._errorShown = false; this._notices = new Map();
    this.time = 0; this.frameCount = 0; this.dt = 0; this.alpha = 0; this.substeps = 0;
    this._running = false; this._acc = 0; this._last = 0; this._raf = 0;
    this._bootLeft = BOOT_HEALTHY_SECONDS; // s of drawn frames until the run is healthy (header, core/Quality.js)
    this._profileAt = o.profile ? (o.profile === true ? 10 : +o.profile) : 0;
    this._onWindowResize = () => this.resize();
    window.addEventListener('resize', this._onWindowResize);
    this._onContextLost = (e) => this._contextLost(e);
    this.renderer.domElement.addEventListener('webglcontextlost', this._onContextLost);
    this.setPixelRatio(this.maxPR);
    this.resize();
  }

  /** Register a system (see header). `name` labels it in the profiler (default: constructor name). */
  addSystem(s, name) {
    s.__name = name || s.__name || (s.constructor && s.constructor !== Object ? s.constructor.name : '') || `system${this.systems.length}`;
    s.__ms = 0;
    s.__pr = Number.isFinite(s.priority) ? s.priority : 0;
    if (s.__on === undefined) s.__on = true;
    const S = this.systems;
    let i = S.length; // insert after the last system whose priority is <= ours (stable for equal priorities)
    while (i > 0 && S[i - 1].__pr > s.__pr) i--;
    S.splice(i, 0, s);
    return s;
  }
  /** Skip (false) or run (true) a system in every phase; `s` is the system or its name. */
  setSystemEnabled(s, on = true) { const sys = typeof s === 'string' ? this.getSystem(s) : s; if (sys) sys.__on = !!on; return sys; }
  isSystemEnabled(s) { const sys = typeof s === 'string' ? this.getSystem(s) : s; return !!sys && sys.__on !== false; }
  removeSystem(s) { const i = this.systems.indexOf(s); if (i >= 0) this.systems.splice(i, 1); }
  getSystem(name) { return this.systems.find((s) => s.__name === name) || null; }

  /** Await every system's load() in registration order; onProgress(0..1, label) across all of them. */
  async load(onProgress = noop) {
    const loaders = this.systems.filter((s) => typeof s.load === 'function');
    const weights = loaders.map((s) => (Number.isFinite(s.loadWeight) && s.loadWeight > 0 ? s.loadWeight : 1));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let done = 0;
    for (let i = 0; i < loaders.length; i++) {
      const s = loaders[i], w = weights[i], base = done;
      await s.load((p, label) => onProgress((base + w * Math.min(1, Math.max(0, p || 0))) / total, label || s.__name));
      done += w;
    }
    onProgress(1, 'Ready');
  }

  get size() {
    return { width: this.container.clientWidth || window.innerWidth, height: this.container.clientHeight || window.innerHeight };
  }

  setPixelRatio(pr) {
    this.pixelRatio = pr;
    const { width, height } = this.size;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height);
    this.onResize(width, height, pr);
  }
  /** The internal scale (adaptive resolution's, header): renderScale and onRenderScale(s). */
  setRenderScale(s) {
    this.renderScale = s;
    if (this.onRenderScale) this.onRenderScale(s);
  }
  resize() {
    const { width, height } = this.size;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.onResize(width, height, this.pixelRatio);
  }

  start() { if (this._running || this.contextLost) return; this._running = true; this._last = now(); this._rafT = 0; this._calib = 10; this._raf = requestAnimationFrame(this._frame); }
  stop() { this._running = false; cancelAnimationFrame(this._raf); }

  /**
   * Draw frames and let the GPU finish them before the loop starts (see "Start-up" in the header). Call it after the
   * scene, the camera and renderFn are set up and the canvas has its final size, while a loading screen covers the
   * page; then start() and hide the loading screen.
   * @param {{ frames?: number, systems?: boolean, timeout?: number, compile?: boolean }} [o]
   *   frames: warm frames (default 4); systems: run the systems' per-frame phases at dt 0 before each render (default
   *   true; false: renderFn only); timeout: ms for each wait (compile, GPU fence; default 15000); compile:
   *   renderer.compileAsync first (default true)
   * @returns {Promise<{ frames: number, ms: number, compileMs: number, fence: 'signaled' | 'timeout' | 'none' | 'lost', lost: boolean }>}
   */
  async warmUp({ frames = 4, systems = true, timeout = 15000, compile = true } = {}) {
    const R = this.renderer, gl = R.getContext(), t0 = now();
    const out = { frames: 0, ms: 0, compileMs: 0, fence: 'none', lost: false };
    const lost = () => {
      if (!this.contextLost && !gl.isContextLost()) return false;
      this._contextLost(null);
      out.fence = 'lost'; out.lost = true; out.ms = Math.round(now() - t0);
      return true;
    };
    await nextPaint();
    if (lost()) return out;
    if (compile && typeof R.compileAsync === 'function') {
      const tc = now();
      let timer = 0;
      try {
        await Promise.race([R.compileAsync(this.scene, this.camera), new Promise((r) => { timer = setTimeout(r, timeout); })]);
      } catch (e) { if (!lost()) throw e; } finally { clearTimeout(timer); }
      out.compileMs = Math.round(now() - tc);
      if (lost()) return out;
    }
    // the last warm frame at the first scale below the current one adaptive resolution can step to (header "Start-up"):
    // the upscaling variants compile here, not at that step in play
    const s0 = this.renderScale, up = this.onRenderScale ? this.renderScales.find((s) => s < s0) : undefined;
    for (let i = 0; i < frames; i++) {
      const u = i === frames - 1 && up !== undefined;
      if (u) this.setRenderScale(up);
      try { this._warmFrame(systems); } catch (e) { if (lost()) return out; throw e; } finally { if (u) this.setRenderScale(s0); }
      out.frames++;
      await sleep(0);
      if (lost()) return out;
    }
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const tf = now();
      out.fence = sync ? 'timeout' : 'none';
      while (sync && now() - tf < timeout) {
        await sleep(4); // WebGL updates a sync's status only between tasks
        if (lost()) return out;
        const s = gl.clientWaitSync(sync, 0, 0);
        if (s === gl.ALREADY_SIGNALED || s === gl.CONDITION_SATISFIED) { out.fence = 'signaled'; break; }
        if (s === gl.WAIT_FAILED) { out.fence = 'none'; break; }
      }
      if (sync) gl.deleteSync(sync);
    } else await nextPaint();
    out.ms = Math.round(now() - t0);
    return out;
  }

  // a warm frame (header): the per-frame phases at dt 0, no fixed step, then the render
  _warmFrame(systems) {
    const S = this.systems, a = this.alpha;
    if (systems) {
      for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.earlyUpdate && s.__on !== false) s.earlyUpdate(0); }
      for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.update && s.__on !== false) s.update(0, a); }
      for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.lateUpdate && s.__on !== false) s.lateUpdate(0, a); }
    }
    this.renderer.info.reset();
    this.renderFn(this.scene, this.camera, 0);
  }

  // the canvas lost its WebGL context (event), or a frame found it lost before the event came (null): once
  _contextLost(e) {
    if (this.contextLost) return;
    this.contextLost = true;
    this.stop();
    recordContextLoss();
    console.warn('[engine] WebGL context lost: the loop stopped (reload to continue)');
    this.onContextLost(e || null);
  }

  /** The default onContextLost: pointer lock released, CONTEXT_LOST_TEXT with a Reload button. */
  showContextLost() {
    if (typeof document !== 'undefined' && document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
    return this.showNotice(CONTEXT_LOST_TEXT, { button: 'Reload', onButton: () => location.reload() });
  }

  /** The default onFrameError: the first error as a line at the bottom of the page; later calls do nothing. */
  showFrameError(e) {
    if (this._errorShown) return null;
    this._errorShown = true;
    return this.showNotice(`Error: ${e && e.message ? e.message : String(e)}`, { kind: 'error' });
  }

  /**
   * A small message over the page (see header): the lost-context notice, the frame-error line, or a game's own.
   * @param {string} text
   * @param {{ button?: string, onButton?: () => void, kind?: 'notice' | 'error', id?: string, parent?: HTMLElement }} [o]
   * @returns {HTMLElement | null}  null without a document
   */
  showNotice(text, { button, onButton, kind = 'notice', id, parent } = {}) {
    if (typeof document === 'undefined') return null;
    const key = id || kind;
    let el = this._notices.get(key);
    if (!el || !el.isConnected) {
      el = document.createElement('div');
      el.className = `engine-notice engine-notice-${kind}`;
      el.setAttribute('role', kind === 'error' ? 'alert' : 'alertdialog');
      el.style.cssText = `${NOTICE_CSS[kind] || NOTICE_CSS.notice};z-index:2147483000;pointer-events:auto;user-select:text;-webkit-user-select:text`;
      for (const t of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(t, (ev) => ev.stopPropagation());
      (parent || document.body).appendChild(el);
      this._notices.set(key, el);
    }
    el.textContent = '';
    const p = document.createElement('div'); p.textContent = text; el.appendChild(p);
    if (button) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = button; b.style.cssText = NOTICE_BUTTON_CSS;
      if (onButton) b.addEventListener('click', onButton);
      el.appendChild(b);
    }
    return el;
  }

  _frame = (t) => {
    if (!this._running) return;
    cancelAnimationFrame(this._raf); // exactly one pending frame, even if _frame was invoked by hand
    this._raf = requestAnimationFrame(this._frame);
    // Refresh estimate: mean, then 20-sample EMA, of the raw callback interval, whether or not the callback ticks.
    // Only an interval within 0.7-1.5x the estimate refines it. A longer one is a dropped frame (busy main thread or
    // GPU), not the screen: following it would let the frame budget slide down with the frame rate and stall
    // adaptive resolution. A shorter one restarts the estimate (a faster screen, or a slow frame seeded it), and so
    // do 10 s of nothing but longer ones (the rate itself dropped: another screen, Low Power Mode, Energy Saver's
    // 30 fps; also a scene that never fits one refresh period, which then reads as its own rate). Published once
    // 4 intervals agree with it.
    const raw = this._rafT ? t - this._rafT : 0; this._rafT = t;
    if (raw > 1 && raw < 250) { // 0 / NaN: first callback, or a call by hand; >= 250 ms: hidden tab, breakpoint
      const m = this._rafMs;
      if (raw > m * 0.7 && raw < m * 1.5) {
        this._rafMs = m + (raw - m) / Math.min(20, ++this._rafN + 1); this._rafLong = 0;
        if (this._rafN >= 4) this.refreshRate = this.profiler.frame.refresh = 1000 / this._rafMs;
      } else if (!m || raw < m * 0.7 || (this._rafLong += raw) > 10000) { this._rafMs = raw; this._rafN = 0; this._rafLong = 0; }
    }
    if (!this.refreshRate && this._calib > 0) { this._calib--; this._last = t; return; } // measure first (header)
    // pacing (see header): a callback less than 1000 / targetFps - 1 ms after the last tick is skipped
    const fps = this.targetFps;
    if (fps > 0 && t - this._last < 1000 / fps - 1) return;
    let dt = (t - this._last) / 1000; this._last = t;
    if (dt > 0.25) dt = 0.25; // tab was hidden
    else if (!(dt >= 0)) dt = 0; // first rAF timestamp can precede start()
    try { this.tick(dt); } catch (e) { this._frameError(e); }
    if (this._bootLeft > 0 && (this._bootLeft -= dt) <= 0) bootHealthy(); // a healthy run: its boot marker goes
  };

  // a frame threw (header): a lost context takes the lost path; anything else is logged and shown
  _frameError(e) {
    if (this.contextLost || this.renderer.getContext().isContextLost()) { this._contextLost(null); return; }
    console.error('[engine] frame error', e);
    try { this.onFrameError(e); } catch (e2) { console.error('[engine] onFrameError failed', e2); }
  }

  /**
   * Advance one frame by `dt` seconds: early -> fixed steps -> update -> late -> render. Driven by the rAF loop
   * after start(); call it directly for manual stepping (tests, capture, paused-tab debugging).
   */
  tick(dt) {
    const P = this.profiler; P.frameBegin();
    const raw = dt > 0.25 ? 0.25 : dt >= 0 ? dt : 0; // wall dt: profiler, overlay, adaptive resolution
    const clock = this.clock; dt = clock.advance(raw); // scaled dt for the systems (0 while paused)
    this.time += dt; this.frameCount++; this.dt = dt;
    const S = this.systems;
    for (let i = 0; i < S.length; i++) S[i].__ms = 0;
    // early (input)
    for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.earlyUpdate && s.__on !== false) { const t0 = now(); s.earlyUpdate(dt); s.__ms += now() - t0; } }
    // fixed-step simulation (forced steps: clock.step(n) while paused; the surplus beyond maxSubsteps is re-queued)
    this._acc += dt; let steps = 0, forced = clock.paused ? clock.takeSteps() : 0;
    const tSim = now();
    while (steps < this.maxSubsteps && (forced > 0 || this._acc >= this.fixedDt)) {
      for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.fixedUpdate && s.__on !== false) { const t0 = now(); s.fixedUpdate(this.fixedDt); s.__ms += now() - t0; } }
      if (forced > 0) forced--; else this._acc -= this.fixedDt;
      steps++;
    }
    if (forced > 0) clock.step(forced);
    if (steps === this.maxSubsteps && !clock.paused) this._acc = 0;
    P.record('sim', now() - tSim);
    this.substeps = steps; P.frame.steps = steps;
    const alpha = this.alpha = this._acc / this.fixedDt;
    // per-frame systems
    for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.update && s.__on !== false) { const t0 = now(); s.update(dt, alpha); s.__ms += now() - t0; } }
    for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.lateUpdate && s.__on !== false) { const t0 = now(); s.lateUpdate(dt, alpha); s.__ms += now() - t0; } }
    for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.earlyUpdate || s.fixedUpdate || s.update || s.lateUpdate) P.record(s.__name, s.__ms); }
    // render
    P.begin('render'); P.gpuBegin('frame');
    this.renderer.info.reset();
    this.renderFn(this.scene, this.camera, dt);
    P.gpuEnd(); P.end('render');
    if (this.overlay) this.overlay.update(raw);
    P.frameEnd(raw);
    if (this._profileAt && clock.unscaledTime >= this._profileAt) { this._profileAt = 0; console.table(P.snapshot()); }
    if (this.adaptive && raw < 0.2) this._adapt(raw);
  }

  // adaptive resolution (header): the state, at start-up
  _resetAdaptive() {
    this._frameEMA = 1 / 60; this._prTimer = 0;
    this._prDir = 0; this._prFrom = 0; this._sFrom = 1; this._prEma = 0; // the last step (-1 / +1), ratio, scale and EMA before it
    this._prDownHold = 0; this._prDownBack = 0; this._prFloor = 0; // no step down from ratio x scale <= floor while held (s)
    this._prUpHold = 0; this._prUpBack = 0; // no step up while held (s)
  }

  // adaptive resolution (header), once per tick with the wall dt (s)
  _adapt(raw) {
    this._frameEMA += (raw - this._frameEMA) * 0.05; this._prTimer += raw;
    if (this._prDownHold > 0) this._prDownHold -= raw;
    if (this._prUpHold > 0) this._prUpHold -= raw;
    if (this._prTimer <= 2) return;
    this._prTimer = 0;
    // uncapped: the 60 fps budget as before (a 120 Hz screen keeps full resolution at 60 fps); capped: the cap, but
    // never a budget tighter than the screen allows. targetFps: 120 is how a game asks for a ProMotion display's rate
    const fps = this.targetFps, budget = 1 / (fps > 0 ? Math.min(fps, Math.max(this.refreshRate, 60)) : 60); // s; header
    const ema = this._frameEMA, pr = this.pixelRatio, dir = this._prDir;
    const S = this.onRenderScale ? this.renderScales : [], s = this.renderScale, i = S.indexOf(s), low = S.length - 1;
    this._prDir = 0;
    // the last step first: a step down that did not make the frame faster, or a step up that put it over the budget,
    // is undone and not tried again for 30 s, doubling while it keeps failing (up to 240 s)
    if (dir < 0) {
      if (ema > this._prEma * 0.95) {
        this._prDownBack = Math.min(240, this._prDownBack * 2 || 30); this._prDownHold = this._prDownBack; this._prFloor = this._prFrom * this._sFrom;
        this._undo(); return;
      }
      this._prDownBack = 0;
    } else if (dir > 0) {
      if (ema > budget * 1.11) {
        this._prUpBack = Math.min(240, this._prUpBack * 2 || 30); this._prUpHold = this._prUpBack;
        this._undo(); return;
      }
      this._prUpBack = 0;
    }
    // room to climb: under 0.69 x budget; where the loop's shortest interval (the display's period, or targetFps's) is
    // not below that, the interval cannot show room, so frames that fit (within 3 % of it) climb as a probe
    const period = Math.max(this.refreshRate > 0 ? 1 / this.refreshRate : 0, fps > 0 ? 1 / fps : 0);
    const room = Math.min(budget * 1.03, Math.max(budget * 0.69, period * 1.03));
    // the ladder (header): the scales at the full ratio (i < low: a scale step down), then the ratio at the lowest
    // scale; without scales (S empty, i -1) the ratio only
    const scaleDown = i >= 0 && i < low, scaleUp = i > 0 && pr >= this.maxPR;
    if (ema > budget * 1.11 && (scaleDown || pr > 1) && !(this._prDownHold > 0 && pr * s <= this._prFloor)) {
      this._prDir = -1; this._prFrom = pr; this._sFrom = s; this._prEma = ema;
      if (scaleDown) this.setRenderScale(S[i + 1]); else this.setPixelRatio(Math.max(1, pr - 0.25));
    } else if (ema < room && (scaleUp || pr < this.maxPR) && !(this._prUpHold > 0)) {
      this._prDir = 1; this._prFrom = pr; this._sFrom = s; this._prEma = ema;
      if (scaleUp) this.setRenderScale(S[i - 1]); else this.setPixelRatio(Math.min(this.maxPR, pr + 0.25));
    }
  }

  // adaptive resolution: back to the ratio and scale before the last step
  _undo() {
    if (this._sFrom !== this.renderScale) this.setRenderScale(this._sFrom);
    else this.setPixelRatio(this._prFrom);
  }

  dispose() {
    this.stop(); window.removeEventListener('resize', this._onWindowResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this._onContextLost);
    for (const el of this._notices.values()) el.remove();
    this._notices.clear();
    for (const s of this.systems) if (s.dispose) s.dispose();
    if (this.overlay) this.overlay.dispose();
    if (this.pixelStore) this.pixelStore.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
