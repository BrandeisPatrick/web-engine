// Quality tiers: two presets ('desktop' for Macs / laptops / desktops with a real GPU, 'mobile' for phones and
// tablets), a recommendation from the device, and the player's stored choice. A tier is plain data: the sample
// spreads its groups into the Engine / Atmosphere / PostFX / MapWorld options, so the engine classes know nothing
// about tiers and a game can add its own keys (`defineTier`).
//
//   const q = resolveQuality();                       // { tier, recommended, source, settings }
//   const engine = new Engine({ container, ...q.settings.engine });
//   const atmo = new Atmosphere({ ..., shadows: q.settings.shadows });
//   const postfx = new PostFX(renderer, scene, camera, { ..., ...q.settings.postfx });
//   new QualityMenu({ quality: q });                  // ui layer: the settings button; a change stores the tier and reloads
//
// Order of precedence: `?quality=desktop|mobile` (not stored; legacy `high` / `low` map to desktop / mobile), then the
// stored choice (localStorage `vibe.quality`), then `recommendTier()`. Node-safe: without `window` the tier is 'desktop'.
//
// Lighter after a lost WebGL context. The Engine records every `webglcontextlost` of its canvas for the browser session
// (`recordContextLoss()`: sessionStorage `vibe.contextLost`, a count; phones drop the context when GPU memory runs
// short). While the tier comes from the recommendation, each recorded loss steps the load down one rung:
// desktop -> mobile -> mobile with `engine.maxPixelRatio` capped at LOST_MAX_PIXEL_RATIO (1). A phone (recommended
// mobile) goes straight to the cap. `?quality=` and a stored choice are never changed. The result says so:
// `lighter: true`, `contextLosses` (the count) and a `reason` that ends in '; lighter after a graphics reset'
// (`recommended` stays what the device would get). The count lives until the tab closes; `clearContextLosses()` forgets it.
//
// Lighter after a crash. A phone's OS can kill the whole tab for memory, and iOS does it without any event: no
// `webglcontextlost`, so the count above never moved and the next load was as heavy as the one that died. So on a
// device recommended 'mobile' the first resolveQuality() of a page load also runs the boot check (bootCheck): a boot
// marker in localStorage, `vibe.boot:<location.pathname>` (BOOT_MARKER_KEY), set at boot and cleared when the run is
// healthy (BOOT_HEALTHY_SECONDS, 15 s, of frames the Engine's loop drew: it calls bootHealthy()), on `pagehide` (a
// normal close, reload or navigation) and while the page is hidden (a tab killed in the background was not killed by
// us; it is set again when the page shows before it is healthy). Still there at the next boot, less than
// BOOT_MARKER_MAX_AGE (10 min) old: the previous run of this page died before it was healthy. That counts as one lost
// context (recordContextLoss), so the load takes the same lighter path and, as after a lost context, later loads in
// this tab stay lighter until it closes; the run that comes up healthy clears the marker, not the count. One console
// warning says so, and the result has `crashed: true` and a `reason` that ends in '; lighter after a crash'. A device
// recommended 'desktop' gets no marker: a desktop browser does not kill a visible tab without a trace, and two tabs of
// one page (side-by-side comparisons) would read each other's marker as a crash. Every storage access is in
// try / catch (private mode); without storage, or in Node, nothing happens.

/** Tier ids, best first. */
export const TIER_IDS = ['desktop', 'mobile'];
export const QUALITY_STORAGE_KEY = 'vibe.quality';
/** sessionStorage key of the lost-context count (see header). */
export const CONTEXT_LOSS_KEY = 'vibe.contextLost';
/** The pixel-ratio cap of the lightest rung after lost contexts (see header). */
export const LOST_MAX_PIXEL_RATIO = 1;
/** localStorage key prefix of the boot marker; `:${location.pathname}` follows (see header). */
export const BOOT_MARKER_KEY = 'vibe.boot';
/** Seconds of frames the loop draws before a run is healthy and its boot marker is cleared (see header). */
export const BOOT_HEALTHY_SECONDS = 15;
/** A boot marker older than this many seconds is stale: ignored, not a crash (see header). */
export const BOOT_MARKER_MAX_AGE = 600;

/**
 * The presets. Groups: `engine` (Engine options), `shadows` (Atmosphere `shadows`), `postfx` (PostFX options),
 * `passes` (set on the built PostFX: `postfx.aoPass.enabled`, `postfx.bloomPass.enabled`),
 * `lights` (MapWorld `lights` / NearestLights), `world` (MapWorld streaming / traffic / detail scale), `textures`
 * (largest texture edge a sample should load), `effects` (sample-side particle / decal budgets, 0..1).
 */
export const QUALITY_TIERS = {
  desktop: {
    label: 'Mac / desktop', blurb: 'Full lighting: reflections, light shafts, soft shadows, every street lamp lit.',
    engine: { maxPixelRatio: 2, adaptiveResolution: true },
    shadows: { cascades: 3, kernel: 'pcss', nearMapSize: 2048, skipUnlit: true },
    postfx: { gbuffer: true, aa: 'taa', ssr: true, volumetric: true, motionBlur: 0 },
    passes: { ao: true, bloom: true },
    lights: { clustered: true, clusteredRange: 220 },
    world: { streamRadius: 900, traffic: 150, pedestrians: 60, detail: 1 },
    textures: { maxSize: 2048, anisotropy: 8 },
    effects: { particles: 1, decals: 1 },
  },
  mobile: {
    label: 'Phone / tablet', blurb: 'Lighter: fewer lit lamps, simpler shadows, no screen-space reflections. Saves battery.',
    engine: { maxPixelRatio: 1.5, adaptiveResolution: true },
    shadows: { cascades: 1, kernel: 'fast', singleMapSize: 1024, skipUnlit: true },
    postfx: { gbuffer: false, aa: 'fxaa', ssr: false, volumetric: false, motionBlur: 0 },
    passes: { ao: false, bloom: true },
    lights: { clustered: false, clusteredRange: 90 },
    world: { streamRadius: 450, traffic: 40, pedestrians: 16, detail: 0.5 },
    textures: { maxSize: 1024, anisotropy: 2 },
    effects: { particles: 0.4, decals: 0.5 },
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(base, over) {
  const out = { ...base };
  for (const k in over) out[k] = isObj(over[k]) && isObj(base[k]) ? merge(base[k], over[k]) : over[k];
  return out;
}

/**
 * Tier settings (a deep copy) with `overrides` merged per group: `tierSettings('mobile', { postfx: { aa: 'taa' } })`.
 * @param {string} tier
 * @param {object} [overrides]
 * @returns {TierSettings}
 */
export function tierSettings(tier, overrides) {
  const base = QUALITY_TIERS[tier] || QUALITY_TIERS.desktop;
  return merge(JSON.parse(JSON.stringify(base)), overrides || {});
}

/** Add or change keys of a tier for every later `tierSettings` / `resolveQuality` call (a game's own budgets). */
export function defineTier(tier, patch) {
  if (!QUALITY_TIERS[tier]) throw new Error(`defineTier: unknown tier '${tier}'`);
  QUALITY_TIERS[tier] = merge(QUALITY_TIERS[tier], patch);
}

/**
 * The tier this device should default to, and why. `env` is for tests: { userAgent, maxTouchPoints, coarse,
 * deviceMemory, hardwareConcurrency, renderer (the unmasked WebGL renderer string), width, height }.
 * @returns {{ tier: 'desktop' | 'mobile', reason: string }}
 */
export function recommendTier(env) {
  const hasWin = typeof window !== 'undefined', nav = typeof navigator !== 'undefined' ? navigator : {};
  if (!env && !hasWin) return { tier: 'desktop', reason: 'no window' };
  const e = env || {};
  const ua = e.userAgent ?? nav.userAgent ?? '';
  const touch = e.maxTouchPoints ?? nav.maxTouchPoints ?? 0;
  const coarse = e.coarse ?? (hasWin && window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false);
  const renderer = e.renderer ?? '';
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) return { tier: 'mobile', reason: 'phone' };
  // iPadOS reports a Mac user agent: a "Mac" with a multi-touch screen is a tablet
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1)) return { tier: 'mobile', reason: 'tablet' };
  if (coarse && touch > 1) return { tier: 'mobile', reason: 'touch screen' };
  if (/SwiftShader|llvmpipe|Software/i.test(renderer)) return { tier: 'mobile', reason: 'software renderer' };
  if (/Mali|Adreno|PowerVR|Intel\(R\) (HD|UHD) Graphics [2-6]\d\d\b/i.test(renderer)) return { tier: 'mobile', reason: 'integrated GPU' };
  const mem = e.deviceMemory ?? nav.deviceMemory, cores = e.hardwareConcurrency ?? nav.hardwareConcurrency;
  if ((mem && mem <= 4) || (cores && cores <= 4)) return { tier: 'mobile', reason: 'low memory or few cores' };
  return { tier: 'desktop', reason: 'desktop GPU' };
}

// window first: Node 22+ has a global localStorage getter that warns (ExperimentalWarning) on first touch
function storage() { try { return typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }
const normalise = (v) => (v === 'high' ? 'desktop' : v === 'low' ? 'mobile' : TIER_IDS.includes(v) ? v : null);

/** The stored choice, or null. */
export function storedTier(key = QUALITY_STORAGE_KEY) { const s = storage(); try { return s ? normalise(s.getItem(key)) : null; } catch { return null; } }
/** Store the player's choice (null clears it: back to the recommendation). */
export function storeTier(tier, key = QUALITY_STORAGE_KEY) {
  const s = storage(); if (!s) return;
  try { if (tier == null) s.removeItem(key); else if (normalise(tier)) s.setItem(key, normalise(tier)); } catch { /* private mode */ }
}

// as storage(): window first
function session() { try { return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; } }
/** WebGL context losses recorded in this browser session (see header); 0 without storage. */
export function contextLosses(key = CONTEXT_LOSS_KEY) {
  const s = session();
  try { const n = s ? parseInt(s.getItem(key) || '0', 10) : 0; return n > 0 ? n : 0; } catch { return 0; }
}
/** Count one more lost context for this session (the Engine calls it on `webglcontextlost`). Returns the new count. */
export function recordContextLoss(key = CONTEXT_LOSS_KEY) {
  const s = session(), n = contextLosses(key) + 1;
  try { if (s) s.setItem(key, String(n)); } catch { /* private mode, blocked site data */ }
  return n;
}
/** Forget this session's lost contexts: the next resolveQuality() is not lightened. */
export function clearContextLosses(key = CONTEXT_LOSS_KEY) { const s = session(); try { if (s) s.removeItem(key); } catch { /* blocked */ } }

let _boot = null; // this page load's boot check (bootCheck): { result, healthy, logged, disarm, stop }
/**
 * The boot check (see header), once per page load: resolveQuality() runs it first thing. Reads the marker the previous
 * run of this page left (there: it died before it was healthy, so one lost context is recorded) and sets this run's;
 * later calls return the first result. Nothing happens unless `mobile` (the device is recommended 'mobile').
 * @param {{ mobile?: boolean, storage?: Storage | null, key?: string, now?: number, win?: any, doc?: any, force?: boolean }} [o]
 *   storage / key / now (ms) / win / doc replace localStorage, the key from location.pathname, Date.now(), window and
 *   document (tests); force: run it again (tests)
 * @returns {{ key: string, armed: boolean, crashed: boolean, age: number | null }}  armed: this run's marker is set;
 *   crashed: the previous run died (age: seconds since its marker was set)
 */
export function bootCheck(o = {}) {
  if (_boot && !o.force) return _boot.result;
  if (_boot) _boot.stop();
  const result = { key: '', armed: false, crashed: false, age: null };
  const b = _boot = { result, healthy: false, logged: false, disarm: () => {}, stop: () => {} };
  const st = o.storage !== undefined ? o.storage : storage();
  const key = result.key = o.key ?? (typeof location !== 'undefined' && location.pathname ? `${BOOT_MARKER_KEY}:${location.pathname}` : '');
  if (!o.mobile || !st || !key) return result;
  let prev = null;
  try { prev = st.getItem(key); } catch { return result; } // private mode, blocked site data
  const now = o.now ?? Date.now();
  if (prev !== null) {
    const age = (now - Number(prev)) / 1000;
    if (age >= 0 && age <= BOOT_MARKER_MAX_AGE) { result.crashed = true; result.age = Math.round(age); }
  }
  const arm = () => { try { st.setItem(key, String(o.now ?? Date.now())); return true; } catch { return false; } };
  b.disarm = () => { try { st.removeItem(key); } catch { /* blocked */ } };
  result.armed = arm();
  if (result.crashed) recordContextLoss();
  if (!result.armed) return result;
  // a normal close / reload / navigation, or hidden: no marker; shown again (bfcache, back in view) before healthy: set
  const win = o.win !== undefined ? o.win : typeof window !== 'undefined' ? window : null;
  const doc = o.doc !== undefined ? o.doc : typeof document !== 'undefined' ? document : null;
  const onHide = () => b.disarm();
  const onShow = (e) => { if (!b.healthy && (!e || e.type !== 'pageshow' || e.persisted)) arm(); };
  const onVis = () => (doc.hidden ? onHide() : onShow());
  const on = (t, ev, fn) => { if (t && typeof t.addEventListener === 'function') t.addEventListener(ev, fn); };
  const off = (t, ev, fn) => { if (t && typeof t.removeEventListener === 'function') t.removeEventListener(ev, fn); };
  on(win, 'pagehide', onHide); on(win, 'pageshow', onShow); on(doc, 'visibilitychange', onVis);
  b.stop = () => { off(win, 'pagehide', onHide); off(win, 'pageshow', onShow); off(doc, 'visibilitychange', onVis); };
  return result;
}
/**
 * This run is healthy: its boot marker is cleared and stays cleared (see header). The Engine's loop calls it after
 * BOOT_HEALTHY_SECONDS of drawn frames; once is enough.
 */
export function bootHealthy() {
  const b = _boot;
  if (!b || b.healthy) return;
  b.healthy = true; b.disarm(); b.stop();
}

/**
 * @typedef {{
 *   label: string, blurb: string,
 *   engine: { maxPixelRatio: number, adaptiveResolution: boolean, [key: string]: any },
 *   shadows: { cascades: number, kernel: 'pcf' | 'fast' | 'pcss', skipUnlit?: boolean, [key: string]: any },
 *   postfx: { gbuffer: boolean, aa: string, ssr: boolean | object, volumetric: boolean | object, motionBlur: number, [key: string]: any },
 *   passes: { ao: boolean, bloom: boolean },
 *   lights: { clustered: boolean, clusteredRange: number },
 *   world: { streamRadius: number, traffic: number, pedestrians: number, detail: number },
 *   textures: { maxSize: number, anisotropy: number },
 *   effects: { particles: number, decals: number },
 *   [group: string]: any,
 * }} TierSettings
 *   One tier's settings (QUALITY_TIERS.desktop / .mobile, plus overrides). Spread the groups into the classes:
 *   Engine({ ...s.engine }), Atmosphere({ shadows: s.shadows }), PostFX(..., { ...s.postfx }); `passes` is applied by
 *   the game (postfx.aoPass.enabled = s.passes.ao; postfx.bloomPass.enabled = s.passes.bloom); `lights.clustered`
 *   says whether to use ClusteredLights; `textures` / `effects` are budgets a game reads. A game adds its own groups
 *   through `overrides` (e.g. `{ desktop: { walk: { lamps: 6 } } }` -> s.walk.lamps).
 */
/**
 * @typedef {object} QualityChoice  resolveQuality's result
 * @property {'desktop'|'mobile'|string} tier  the tier in effect
 * @property {'desktop'|'mobile'|string} recommended  what the device would get
 * @property {string} reason  why it was recommended
 * @property {'query'|'stored'|'recommended'} source  where `tier` came from (?quality=, the stored choice, the device)
 * @property {TierSettings} settings  the tier's groups, overrides merged
 * @property {string} storageKey
 * @property {number} contextLosses  WebGL context losses recorded this session (see header)
 * @property {boolean} lighter  this load was stepped down because of them (only when source is 'recommended')
 * @property {boolean} crashed  the previous run of this page died before it was healthy (boot check, see header); it
 *   is counted in contextLosses
 */
/**
 * Pick the tier for this page load.
 * @param {{ search?: string, overrides?: { desktop?: object, mobile?: object, [tier: string]: object | undefined }, env?: object, storageKey?: string, contextLosses?: number, crashed?: boolean }} [opts]
 *   overrides: per tier, groups merged over the preset (a game's own groups too); contextLosses: instead of the
 *   session's count (tests); crashed: instead of the boot check's answer, for `crashed` and the reason (tests)
 * @returns {QualityChoice}
 */
export function resolveQuality(opts = {}) {
  const search = opts.search ?? (typeof location !== 'undefined' ? location.search : '');
  const storageKey = opts.storageKey || QUALITY_STORAGE_KEY;
  const rec = recommendTier(opts.env);
  const fromQuery = normalise(new URLSearchParams(search).get('quality'));
  const fromStore = storedTier(storageKey);
  // the boot check first (header): a previous run that died is recorded as one more lost context
  const boot = bootCheck({ mobile: rec.tier === 'mobile' });
  const crashed = typeof opts.crashed === 'boolean' ? opts.crashed : boot.crashed;
  const losses = Number.isFinite(opts.contextLosses) ? Math.max(0, opts.contextLosses) : contextLosses();
  // lighter after lost contexts (header): one rung per loss, recommended tiers only
  const lighter = !fromQuery && !fromStore && losses > 0;
  let tier = fromQuery || fromStore || rec.tier, rungs = lighter ? losses : 0;
  if (rungs > 0 && tier === 'desktop') { tier = 'mobile'; rungs--; }
  const settings = tierSettings(tier, opts.overrides && opts.overrides[tier]);
  if (rungs > 0) settings.engine.maxPixelRatio = Math.min(settings.engine.maxPixelRatio ?? 2, LOST_MAX_PIXEL_RATIO);
  const source = fromQuery ? 'query' : fromStore ? 'stored' : 'recommended';
  if (boot.crashed && _boot && !_boot.logged) {
    _boot.logged = true;
    console.warn(`[engine] the last run of this page stopped before it ran smoothly (it started ${boot.age} s ago; a crash, or the tab killed for memory): `
      + (lighter ? `loading lighter (${tier}, pixel ratio up to ${settings.engine.maxPixelRatio})` : `not lighter, the tier was chosen (${source})`));
  }
  return {
    tier, recommended: rec.tier, storageKey, source,
    reason: lighter ? `${rec.reason}; lighter after ${crashed ? 'a crash' : 'a graphics reset'}` : rec.reason,
    settings, contextLosses: losses, lighter, crashed,
  };
}
