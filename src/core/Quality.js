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

/** Tier ids, best first. */
export const TIER_IDS = ['desktop', 'mobile'];
export const QUALITY_STORAGE_KEY = 'vibe.quality';

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

/** Tier settings (a deep copy) with `overrides` merged per group: `tierSettings('mobile', { postfx: { aa: 'taa' } })`. */
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

/**
 * Pick the tier for this page load.
 * @param {{ search?: string, overrides?: { desktop?: object, mobile?: object }, env?: object, storageKey?: string }} [opts]
 * @returns {{ tier: string, recommended: string, reason: string, source: 'query' | 'stored' | 'recommended', settings: object, storageKey: string }}
 */
export function resolveQuality(opts = {}) {
  const search = opts.search ?? (typeof location !== 'undefined' ? location.search : '');
  const storageKey = opts.storageKey || QUALITY_STORAGE_KEY;
  const rec = recommendTier(opts.env);
  const fromQuery = normalise(new URLSearchParams(search).get('quality'));
  const fromStore = storedTier(storageKey);
  const tier = fromQuery || fromStore || rec.tier;
  return {
    tier, recommended: rec.tier, reason: rec.reason, storageKey,
    source: fromQuery ? 'query' : fromStore ? 'stored' : 'recommended',
    settings: tierSettings(tier, opts.overrides && opts.overrides[tier]),
  };
}
