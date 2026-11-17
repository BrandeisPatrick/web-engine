// GameShell: the front door of a game in one object. A loading bar that keeps moving, then a start card (title, one
// help line, one button) over the live scene, blurred and dimmed, which clears in about a second on start; pause with
// volume, the game's own toggles and sliders, and the quality tiers, all saved. The start click is also the audio
// gesture: the shell calls audio.start() inside it.
//
//   const shell = new GameShell({ title: 'My Game', controls: [['W A S D', 'Move'], ['Space', 'Jump']],
//     storageKey: 'my-game', quality: Q, defaults: { volume: 0.7 } });     // the loading bar shows now
//   shell.setProgress(0.4, 'Textures');                                     // around your loads
//   shell.use({ engine, audio: bus, inputs: [input] });                    // once they exist (or pass them above)
//   engine.start();
//   await shell.ready();     // compileAsync + one frame, then the card. Does NOT wait for the click.
//   shell.onStart(() => { ... }); shell.onPause((paused) => { ... }); shell.state;  // 'loading'|'title'|'playing'|'paused'
//   shell.settings.get('volume'); shell.settings.on('assist', (on) => { input.assist.enabled = on; });
//   shell.addToggle('assist', 'Steering assist'); shell.addSlider('fov', 'Field of view', { min: 50, max: 90, step: 1 });
//
// What it does to the other layers, by duck typing only (each call is skipped when the method or field is missing):
//   - audio: start() inside the start click (or key), setVolume(v) from the saved volume, setPaused(on) on pause and
//     resume. With the card skipped, unlockOnGesture() instead (no gesture happened yet).
//   - inputs: each one's `enabled` is false while the card or the pause card is up (CharacterInput, VehicleInput and
//     InputMap all have it). A key that started the game re-enables them only once it is released (no jump on start).
//   - engine: engine.clock.pause() / resume() while paused (the loop keeps rendering, systems get dt 0); the canvas,
//     engine.renderer.domElement, is blurred behind the cards; renderer.compileAsync(scene, camera) before the card.
//   - quality: from resolveQuality(); its tier rows sit in the pause card (a pick stores it and reloads, as QualityMenu).
// Pause: Esc or P, the gamepad's Start button, the round pause button (top right while playing, on every device: the
// only visible way to pause and reach the settings once the start card is gone or skipped), and by itself when the
// tab is hidden or the pointer lock is lost while playing. Esc or P again, or Resume, resumes. In the title, Enter or
// Space (or the pad's A / Start) starts. The cards trap Tab focus and focus their button; focus rings are visible.
// URL: ?autostart=1 and ?bench=1 skip the card (the shell goes straight to playing at ready()); with ?bench=1 the shell
// never pauses by itself. window.__sample.ready never waits on the card: set it after `await shell.ready()`.
// prefers-reduced-motion: the blur and the cards switch without a transition.
// Settings are saved under `${storageKey}.settings` (Settings.js); `volume` is always there (default 0.7).
import { injectTheme, injectStyle } from './theme.js';
import { LoadingScreen } from './LoadingScreen.js';
import { buildTierRows, chooseTier, injectQualityStyle } from './QualityMenu.js';
import { createSettings } from './Settings.js';
import { ShellState, skipStartCard, isBenchRun } from './shellState.js';

const CSS = `
.ui-shell{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;box-sizing:border-box;
  color:var(--ui-text);font-family:var(--ui-font);pointer-events:none;-webkit-font-smoothing:antialiased}
.ui-shell *{box-sizing:border-box}
.ui-shell.open{pointer-events:auto}
.ui-shell-card{grid-area:1/1;width:min(400px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:28px 28px 24px;
  text-align:center;opacity:0;visibility:hidden;transform:translateY(6px);
  transition:opacity .45s ease,transform .45s ease,visibility 0s linear .45s}
.ui-shell-card.show{opacity:1;visibility:visible;transform:none;transition:opacity .45s ease,transform .45s ease}
.ui-shell-card h1,.ui-shell-card h2{margin:0;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#fff}
.ui-shell-card h1{font-size:26px;line-height:1.2}
.ui-shell-card h2{font-size:15px;letter-spacing:.24em}
.ui-shell-sub{margin:8px 0 0;font-size:14px;font-weight:300;color:var(--ui-mute)}
.ui-shell-help{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;margin:18px 0 0;font-size:13px;
  line-height:20px;font-weight:300;color:var(--ui-mute)}
.ui-shell-help[hidden]{display:none}
.ui-shell-help span{white-space:nowrap}
.ui-shell-help kbd{display:inline-block;margin-right:5px;padding:0 6px;border:1px solid rgba(255,255,255,.28);
  border-radius:5px;font:inherit;font-size:12px;line-height:18px;color:#fff}
.ui-shell-btn{display:block;width:100%;margin:22px 0 0;padding:13px 18px;border-radius:12px;cursor:pointer;
  border:1px solid rgba(var(--ui-accent-rgb),.9);background:rgba(var(--ui-accent-rgb),.82);color:#fff;
  font:inherit;font-size:15px;font-weight:500;letter-spacing:.12em;text-transform:uppercase}
.ui-shell-btn:hover{background:rgba(var(--ui-accent-rgb),.95)}
.ui-shell button:focus-visible,.ui-shell input:focus-visible{outline:2px solid #fff;outline-offset:3px}
.ui-shell-rows{margin:18px 0 0;text-align:left}
.ui-shell-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 0;
  border-top:1px solid rgba(255,255,255,.08);font-size:14px;font-weight:400}
.ui-shell-row label{flex:0 0 auto}
.ui-shell-row .val{min-width:3ch;text-align:right;color:var(--ui-mute);font-variant-numeric:tabular-nums;font-size:13px}
.ui-shell-row input[type=range]{flex:1 1 auto;min-width:0;max-width:170px;accent-color:var(--ui-accent);height:28px;margin:0}
.ui-shell-sw{position:relative;width:42px;height:24px;flex:0 0 auto;border-radius:999px;cursor:pointer;padding:0;
  border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);transition:background .2s}
.ui-shell-sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;
  opacity:.75;transition:transform .2s}
.ui-shell-sw[aria-checked="true"]{background:rgba(var(--ui-accent-rgb),.8);border-color:rgba(var(--ui-accent-rgb),.9)}
.ui-shell-sw[aria-checked="true"]::after{transform:translateX(18px);opacity:1}
.ui-shell-q{margin:14px 0 0;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);text-align:left}
.ui-shell-q .ui-q-title{margin:0 0 10px}
.ui-shell-q .ui-q-note{margin:0}
.ui-shell-pause{position:fixed;z-index:45;width:44px;height:44px;border-radius:50%;display:none;place-items:center;cursor:pointer;padding:0;color:var(--ui-text);
  pointer-events:auto}
.ui-shell-pause.show{display:grid}
body.ui-shell-carded .ui-touch{display:none}
.ui-shell-pause.tr{top:max(14px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right))}
.ui-shell-pause.tl{top:max(14px,env(safe-area-inset-top));left:max(14px,env(safe-area-inset-left))}
.ui-shell-pause.tc{top:max(14px,env(safe-area-inset-top));left:calc(50% - 22px)}
.ui-shell-pause svg{width:18px;height:18px}
.ui-shell-pause:focus-visible{outline:2px solid #fff;outline-offset:2px}
canvas.ui-shell-canvas{transition:filter 1s ease,transform 1s ease}
canvas.ui-shell-veil{filter:blur(1vmax) brightness(.5);transform:scale(1.06)}
canvas.ui-shell-veil.paused{filter:blur(.6vmax) brightness(.55);transform:scale(1.03)}
@media (prefers-reduced-motion:reduce){
  canvas.ui-shell-canvas,.ui-shell-card,.ui-shell-card.show,.ui-shell-sw,.ui-shell-sw::after{transition:none}
}
@media (max-width:420px){.ui-shell-card{padding:22px 18px 18px}.ui-shell-card h1{font-size:22px}}
`;
const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

/**
 * @typedef {object} GameShellOptions
 * @property {string} [title='']  the game's name (start card and loading screen)
 * @property {string} [subtitle]  one short line under the title
 * @property {Array<[string, string]>} [controls]  [key, action] pairs for the help line, e.g. [['W A S D', 'Drive']];
 *   ['Esc', 'Pause'] is added unless a pair already names Esc
 * @property {string} [touchHelp]  the help line on touch screens instead of the key list
 * @property {string} [startLabel='Play']  the start button's text
 * @property {any} [engine]  the Engine (clock, renderer, scene, camera are read)
 * @property {any} [audio]  an AudioBus or anything with start() / setVolume(v) / setPaused(on)
 * @property {Array<{ enabled: boolean }>} [inputs]  inputs switched off behind the cards
 * @property {{ tier: string, recommended: string, storageKey?: string }} [quality]  resolveQuality(); tiers in the pause card
 * @property {(tier: string) => void} [onQualityChange]  instead of the reload when a tier is picked
 * @property {string} [storageKey='game']  settings are saved under `${storageKey}.settings`
 * @property {Record<string, number | boolean | string>} [defaults]  setting defaults (volume: 0.7 unless given)
 * @property {number} [version=1]  settings version (bump to drop saved values)
 * @property {boolean} [loading=true]  show the loading screen (false: the game has its own)
 * @property {boolean} [autostart]  skip the start card (default: ?autostart=1 or ?bench=1 in the URL)
 * @property {boolean} [autoPause]  pause when the tab is hidden or the pointer lock is lost (default: true, false with ?bench=1)
 * @property {'auto' | boolean} [pauseButton=true]  the round pause button while playing: true on every device (it is
 *   the visible way into the pause card and its settings, also with ?autostart=1), 'auto' only on touch screens, false never
 * @property {'tr' | 'tl' | 'tc'} [pauseCorner='tr']  where it sits (top right, top left, top centre); QualityMenu's gear
 *   also defaults to top right: drop the gear (the tiers are in the pause card) or move one of them
 * @property {HTMLElement} [parent=document.body]
 * @property {import('./Settings.js').SettingsStorage | null} [storage]  settings storage (default localStorage)
 */

/**
 * @typedef {object} GameShellParts  what use() / ready() accept once the game has built it
 * @property {any} [engine]
 * @property {any} [audio]
 * @property {Array<{ enabled: boolean }>} [inputs]  added to the inputs already known
 */

const isTyping = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') && t.type !== 'range');
const nextFrame = () => new Promise((res) => {
  let done = false; const fin = () => { if (!done) { done = true; res(); } };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fin);
  setTimeout(fin, 120); // a hidden tab runs no rAF: never hang ready() on it
});

export class GameShell {
  /** @param {GameShellOptions} [o] */
  constructor(o = {}) {
    injectTheme(); injectStyle('ui-shell', CSS);
    this.options = o;
    this.engine = null; this.audio = null;
    /** @type {Array<{ enabled: boolean }>} */
    this.inputs = [];
    this.quality = o.quality || null;
    this.bench = isBenchRun();
    this.skipCard = o.autostart ?? skipStartCard();
    this.autoPause = o.autoPause ?? !this.bench;
    /** @type {import('./Settings.js').Settings} */
    this.settings = createSettings(`${o.storageKey || 'game'}.settings`, { volume: 0.7, ...(o.defaults || {}) },
      { version: o.version ?? 1, ...(o.storage !== undefined ? { storage: o.storage } : {}) });
    this.settings.define('volume', 0.7, { min: 0, max: 1 });
    this.settings.on('volume', () => this._applyVolume());
    this._fsm = new ShellState();
    /** @type {Array<() => void>} */ this._startCbs = [];
    /** @type {Array<(paused: boolean) => void>} */ this._pauseCbs = [];
    this._pausedClock = false; this._holdKey = null; this._padPrev = 0; this._padRaf = 0;
    this._touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this._locked = false; this._readyP = null; this._canvas = null;
    this._disposers = [];

    this.loading = o.loading === false ? null : new LoadingScreen({ title: o.title || '', label: 'Loading…', compositor: true, parent: o.parent });
    this._build(o);
    this.use(o);
    this._listen();
    this._fsm.on((to, from, reason) => this._onState(to, from, reason));
  }

  /** @returns {import('./shellState.js').ShellStateName} 'loading' | 'title' | 'playing' | 'paused' */
  get state() { return this._fsm.state; }

  /**
   * Hand the shell what the game built after the constructor (each optional; inputs are added).
   * @param {GameShellParts} parts
   * @returns {this}
   */
  use(parts = {}) {
    if (parts.engine) this.engine = parts.engine;
    if (parts.audio) { this.audio = parts.audio; this._applyVolume(); }
    if (parts.inputs) for (const i of parts.inputs) if (i && !this.inputs.includes(i)) this.inputs.push(i);
    if (this.state !== 'playing') this._setInputs(false);
    return this;
  }

  /**
   * Move the loading bar (0..1) and optionally its label.
   * @param {number} p
   * @param {string} [label]
   */
  setProgress(p, label) { if (this.loading) this.loading.setProgress(p, label); return this; }

  /**
   * Finish loading: compile the scene's shaders (renderer.compileAsync), wait one frame, then show the start card
   * (or go straight to playing when the card is skipped). Resolves once the card is up; it never waits for the click.
   * Safe to call more than once (the same promise).
   * @param {GameShellParts} [parts]  as use()
   * @returns {Promise<void>}
   */
  ready(parts) {
    if (parts) this.use(parts);
    if (this._readyP) return this._readyP;
    this._readyP = (async () => {
      this.setProgress(1, 'Preparing…');
      const e = this.engine, r = e && e.renderer;
      if (r && typeof r.compileAsync === 'function' && e.scene && e.camera) {
        try { await r.compileAsync(e.scene, e.camera); } catch { /* compile on first draw instead */ }
      }
      await nextFrame(); await nextFrame();
      this._canvas = (r && r.domElement) || null;
      const c = this._canvas;
      if (c) { // veiled at once behind the card (no 1 s fade in), the transition armed for the reveal
        if (!this.skipCard) c.classList.add('ui-shell-veil');
        void c.offsetWidth;
        c.classList.add('ui-shell-canvas');
      }
      if (this.skipCard) {
        if (this.audio && typeof this.audio.unlockOnGesture === 'function') this.audio.unlockOnGesture();
        this._fsm.go('playing', 'autostart');
      } else this._fsm.go('title', 'ready');
      if (this.loading) { const l = this.loading; this.loading = null; l.hide(this._reduced() ? 0 : 450); }
    })();
    return this._readyP;
  }

  /** Start the game from the title card (what the button does). Call it inside a user gesture for audio. */
  start(reason = 'api') {
    if (this.state !== 'title') return false;
    const a = this.audio;
    if (a) { try { if (typeof a.start === 'function') a.start(); } catch (err) { console.warn('[GameShell] audio.start failed', err); } }
    this._applyVolume();
    return this._fsm.go('playing', reason);
  }

  /** Pause (from playing). */
  pause(reason = 'api') { return this._fsm.go('paused', reason); }
  /** Resume (from paused). */
  resume(reason = 'api') { return this._fsm.go('playing', reason); }
  /** Pause or resume; returns true when now paused. */
  toggle(reason = 'api') {
    if (this.state === 'playing') this.pause(reason); else if (this.state === 'paused') this.resume(reason);
    return this.state === 'paused';
  }

  /**
   * Run fn when the game starts (the start click, or ready() with the card skipped); at once if it already started.
   * @param {() => void} fn
   * @returns {this}
   */
  onStart(fn) { if (this._fsm.started) fn(); else this._startCbs.push(fn); return this; }

  /**
   * Run fn(paused) on every pause (true) and resume (false).
   * @param {(paused: boolean) => void} fn
   * @returns {this}
   */
  onPause(fn) { this._pauseCbs.push(fn); return this; }

  /**
   * Add an on / off switch to the pause card, saved under `key` (default false unless `defaults` gave one).
   * React with shell.settings.on(key, fn).
   * @param {string} key
   * @param {string} label
   * @returns {this}
   */
  addToggle(key, label) {
    this.settings.define(key, false);
    const row = this._row(label), sw = document.createElement('button'), id = `ui-shell-${key}`;
    sw.type = 'button'; sw.className = 'ui-shell-sw'; sw.id = id; sw.setAttribute('role', 'switch');
    row.querySelector('label').htmlFor = id;
    sw.addEventListener('click', () => this.settings.set(key, !this.settings.get(key)));
    this.settings.on(key, (v) => sw.setAttribute('aria-checked', String(!!v)));
    row.append(sw);
    return this;
  }

  /**
   * Add a slider to the pause card, saved under `key` (default `min` unless `defaults` gave one).
   * @param {string} key
   * @param {string} label
   * @param {{ min?: number, max?: number, step?: number, format?: (v: number) => string }} [o]  min 0, max 1,
   *   step (max - min) / 20; format shows the value (default: a percentage for 0..1, else the number)
   * @returns {this}
   */
  addSlider(key, label, o = {}) {
    const min = o.min ?? 0, max = o.max ?? 1, step = o.step ?? (max - min) / 20;
    const fmt = o.format || ((v) => (min === 0 && max === 1 ? `${Math.round(v * 100)}` : String(+v.toFixed(3))));
    this.settings.define(key, min, { min, max });
    const row = this._row(label), input = document.createElement('input'), val = document.createElement('span'), id = `ui-shell-${key}`;
    input.type = 'range'; input.id = id; input.min = String(min); input.max = String(max); input.step = String(step);
    row.querySelector('label').htmlFor = id;
    val.className = 'val'; val.setAttribute('aria-hidden', 'true');
    input.addEventListener('input', () => this.settings.set(key, +input.value));
    this.settings.on(key, (v) => { input.value = String(v); val.textContent = fmt(+v); });
    row.append(input, val);
    return this;
  }

  /** Remove every element and listener and give the inputs back (enabled). */
  dispose() {
    for (const off of this._disposers) off();
    this._disposers = [];
    if (this._padRaf) cancelAnimationFrame(this._padRaf);
    if (this.loading) this.loading.dispose();
    if (this._canvas) this._canvas.classList.remove('ui-shell-canvas', 'ui-shell-veil', 'paused');
    this._setInputs(true);
    this.root.remove(); this.pauseButton.remove();
    if (typeof document !== 'undefined') document.body.classList.remove('ui-shell-carded');
  }

  // ------------------------------------------------------------------ DOM
  _build(o) {
    const root = this.root = document.createElement('div');
    root.className = 'ui-shell';
    // start card: one title, one help line, one button
    const card = this.startCard = this._card('Start');
    const h1 = document.createElement('h1'); h1.textContent = o.title || ''; h1.id = 'ui-shell-title';
    card.setAttribute('aria-labelledby', h1.id); card.append(h1);
    if (o.subtitle) { const s = document.createElement('p'); s.className = 'ui-shell-sub'; s.textContent = o.subtitle; card.append(s); }
    card.append(this._help(o));
    this.startButton = this._button(o.startLabel || 'Play', () => this.start('click'));
    card.append(this.startButton);
    // pause card: Resume, settings rows, quality tiers, the help line
    const pc = this.pauseCard = this._card('Paused');
    const h2 = document.createElement('h2'); h2.textContent = 'Paused';
    this.resumeButton = this._button('Resume', () => this.resume('click'));
    this.rows = document.createElement('div'); this.rows.className = 'ui-shell-rows';
    pc.append(h2, this.resumeButton, this.rows);
    this.addSlider('volume', 'Volume', { min: 0, max: 1, step: 0.05 });
    if (this.quality) {
      injectQualityStyle();
      const q = document.createElement('div'); q.className = 'ui-shell-q';
      const t = document.createElement('p'); t.className = 'ui-q-title'; t.textContent = 'Graphics quality';
      const { group } = buildTierRows(this.quality, (tier) => chooseTier(/** @type {any} */ (this.quality), tier, o.onQualityChange || null));
      const note = document.createElement('p'); note.className = 'ui-q-note'; note.textContent = 'Changing quality reloads the page.';
      q.append(t, group, note); pc.append(q);
    }
    pc.append(this._help(o));
    root.append(card, pc);
    // the round pause button (while playing; see pauseButton)
    const pb = this.pauseButton = document.createElement('button');
    pb.type = 'button'; pb.className = `ui-shell-pause ui-glass ${o.pauseCorner || 'tr'}`; pb.innerHTML = PAUSE_ICON;
    pb.setAttribute('aria-label', 'Pause and settings'); pb.title = 'Pause and settings (Esc)';
    pb.addEventListener('click', (e) => { e.stopPropagation(); this.pause('button'); });
    pb.addEventListener('pointerdown', (e) => e.stopPropagation());
    const parent = o.parent || document.body;
    parent.append(root, pb);
  }

  _card(label) {
    const c = document.createElement('section');
    c.className = 'ui-shell-card ui-glass'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true');
    c.setAttribute('aria-label', label); c.inert = true;
    return c;
  }

  _button(text, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ui-shell-btn'; b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }

  _help(o) {
    const p = document.createElement('p'); p.className = 'ui-shell-help';
    if (this._touch && o.touchHelp) { p.textContent = o.touchHelp; return p; }
    const list = [...(o.controls || [])];
    if (list.length && !list.some(([k]) => /\besc\b/i.test(k))) list.push(['Esc', 'Pause']);
    for (const [k, v] of list) {
      const s = document.createElement('span'), kbd = document.createElement('kbd');
      kbd.textContent = k; s.append(kbd, document.createTextNode(v)); p.append(s);
    }
    if (!list.length) p.hidden = true;
    return p;
  }

  _row(label) {
    const row = document.createElement('div'); row.className = 'ui-shell-row';
    const l = document.createElement('label'); l.textContent = label; row.append(l);
    this.rows.append(row);
    return row;
  }

  // ------------------------------------------------------------------ behaviour
  _reduced() { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  _applyVolume() {
    const a = this.audio;
    if (a && typeof a.setVolume === 'function') { try { a.setVolume(this.settings.get('volume')); } catch { /* not started */ } }
  }

  _setInputs(on) { for (const i of this.inputs) if (i && 'enabled' in i) i.enabled = on; }

  _show(card, on) {
    card.classList.toggle('show', on); card.inert = !on;
  }

  _onState(to, from, reason) {
    const title = to === 'title', paused = to === 'paused', playing = to === 'playing';
    this._show(this.startCard, title);
    this._show(this.pauseCard, paused);
    this.root.classList.toggle('open', title || paused);
    if (typeof document !== 'undefined') document.body.classList.toggle('ui-shell-carded', title || paused); // touch sticks hide behind the cards
    const c = this._canvas;
    if (c) { c.classList.toggle('ui-shell-veil', title || paused); c.classList.toggle('paused', paused); }
    const pbo = this.options.pauseButton ?? true;
    this.pauseButton.classList.toggle('show', playing && (pbo === true || (pbo === 'auto' && this._touch)));
    // the clock and the sound
    const clock = this.engine && this.engine.clock, a = this.audio;
    if (paused) {
      if (clock && !clock.paused) { clock.pause(); this._pausedClock = true; }
      if (a && typeof a.setPaused === 'function') { try { a.setPaused(true); } catch { /* not started */ } }
      if (typeof document !== 'undefined' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    } else if (from === 'paused') {
      if (clock && this._pausedClock) clock.resume();
      this._pausedClock = false;
      if (a && typeof a.setPaused === 'function') { try { a.setPaused(false); } catch { /* not started */ } }
    }
    // inputs: off behind the cards; on in play (after a start key is released)
    if (!playing) this._setInputs(false);
    else if (reason === 'key' && this._holdKey) {
      const code = this._holdKey, t0 = performance.now();
      const wait = () => {
        if (this.state !== 'playing') return;
        if (!this._keysDown.has(code) || performance.now() - t0 > 1500) this._setInputs(true); else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
    } else this._setInputs(true);
    this._holdKey = null;
    // focus: the card's button; leaving a card drops focus from it (Space must not press a hidden button)
    if (title) this.startButton.focus({ preventScroll: true });
    else if (paused) this.resumeButton.focus({ preventScroll: true });
    else if (this.root.contains(document.activeElement)) /** @type {HTMLElement} */ (document.activeElement).blur();
    // callbacks
    if (playing && from !== 'paused') for (const fn of this._startCbs.splice(0)) fn();
    if (paused || from === 'paused') for (const fn of this._pauseCbs) fn(paused);
  }

  _listen() {
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); this._disposers.push(() => t.removeEventListener(ev, fn, opt)); };
    /** @type {Set<string>} */ this._keysDown = new Set();
    on(window, 'keyup', (e) => this._keysDown.delete(e.code));
    on(window, 'blur', () => this._keysDown.clear());
    on(window, 'keydown', (e) => {
      this._keysDown.add(e.code);
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const st = this.state;
      if (st === 'title' && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) {
        if (isTyping(e.target)) return;
        e.preventDefault(); this._holdKey = e.code; this.start('key'); return;
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && (st === 'playing' || st === 'paused')) {
        if (isTyping(e.target) && e.code === 'KeyP') return;
        e.preventDefault(); this.toggle('key'); return;
      }
      if (e.code === 'Tab' && (st === 'title' || st === 'paused')) this._trapTab(e);
    });
    on(document, 'visibilitychange', () => { if (document.hidden && this.autoPause && this.state === 'playing') this.pause('hidden'); });
    on(document, 'pointerlockchange', () => {
      const locked = !!document.pointerLockElement, was = this._locked; this._locked = locked;
      if (was && !locked && this.autoPause && this.state === 'playing') this.pause('pointerlock');
    });
    on(window, 'pointerdown', (e) => {
      if (e.pointerType === 'touch' && !this._touch) {
        this._touch = true;
        if (this.state === 'playing' && this.options.pauseButton !== false) this.pauseButton.classList.add('show');
      }
    }, { capture: true, passive: true });
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      on(window, 'gamepadconnected', () => { if (!this._padRaf) this._padRaf = requestAnimationFrame(this._pollPad); });
    }
  }

  // gamepad: Start toggles pause (and starts from the title, as A does). Polled only while a pad is connected.
  _pollPad = () => {
    this._padRaf = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let bits = 0, any = false;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      any = true;
      if (p.buttons[9] && p.buttons[9].pressed) bits |= 1;  // Start
      if (p.buttons[0] && p.buttons[0].pressed) bits |= 2;  // A
    }
    const down = bits & ~this._padPrev; this._padPrev = bits;
    if (down) {
      if (this.state === 'title') this.start('pad');
      else if (down & 1) this.toggle('pad');
    }
    if (any) this._padRaf = requestAnimationFrame(this._pollPad);
  };

  _trapTab(e) {
    const card = this.state === 'title' ? this.startCard : this.pauseCard;
    const f = /** @type {HTMLElement[]} */ ([...card.querySelectorAll('button,input')]).filter((x) => !x.hidden && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], at = document.activeElement;
    if (e.shiftKey && (at === first || !card.contains(at))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !card.contains(at))) { e.preventDefault(); first.focus(); }
  }
}
