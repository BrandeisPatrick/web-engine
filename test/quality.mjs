// Headless checks for the quality tiers (src/core/Quality.js): the device recommendation (phone, iPad reporting a Mac,
// desktop, software renderer, low memory), resolveQuality's precedence (?quality= > stored choice > recommendation;
// legacy high / low), tierSettings' deep merge (never mutating QUALITY_TIERS), defineTier, and that the module stays
// Node-safe (no window: desktop, no storage, no ExperimentalWarning from Node's own localStorage getter).
// Run: node test/quality.mjs
import {
  QUALITY_TIERS, TIER_IDS, QUALITY_STORAGE_KEY, tierSettings, defineTier, recommendTier, storedTier, storeTier, resolveQuality,
} from '../src/core/Quality.js';
import * as core from '@vibe/engine/core';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return !re || re.test(e.message); } };
const warnings = [];
process.on('warning', (w) => warnings.push(`${w.name}: ${w.message}`));

// user agents (trimmed to what the rules read) and a desktop baseline every env case starts from
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
};
const DESK = { userAgent: UA.mac, maxTouchPoints: 0, coarse: false, deviceMemory: 8, hardwareConcurrency: 10, renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)' };
const env = (o) => ({ ...DESK, ...o });

// ================================================================================================= Node safety
{
  check('node: no window -> recommend desktop', recommendTier().tier === 'desktop' && recommendTier().reason === 'no window');
  check('node: storedTier() is null without window', storedTier() === null);
  storeTier('mobile'); // a no-op, must not throw
  const q = resolveQuality({ search: '' });
  check('node: resolveQuality() -> desktop, recommended', q.tier === 'desktop' && q.source === 'recommended' && q.storageKey === QUALITY_STORAGE_KEY, `${q.tier} / ${q.source}`);
  check('core index re-exports the tier API', core.resolveQuality === resolveQuality && core.QUALITY_TIERS === QUALITY_TIERS && core.TIER_IDS === TIER_IDS);
  check('tier ids: desktop, mobile (best first)', TIER_IDS.join() === 'desktop,mobile');
}

// ================================================================================================= recommendTier
{
  const rec = (o) => recommendTier(env(o));
  const cases = [
    ['desktop: Apple GPU, 8 GB, 10 cores', {}, 'desktop', 'desktop GPU'],
    ['desktop: Windows, discrete GPU', { userAgent: UA.windows, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)' }, 'desktop', 'desktop GPU'],
    ['desktop: touchscreen laptop, fine pointer', { userAgent: UA.windows, maxTouchPoints: 10, coarse: false }, 'desktop', 'desktop GPU'],
    ['phone: iPhone', { userAgent: UA.iphone, maxTouchPoints: 5, coarse: true }, 'mobile', 'phone'],
    ['phone: Android', { userAgent: UA.android, maxTouchPoints: 5, coarse: true, renderer: 'Adreno (TM) 750' }, 'mobile', 'phone'],
    ['tablet: iPad reporting a Mac (touch points 5)', { userAgent: UA.mac, maxTouchPoints: 5, coarse: true }, 'mobile', 'tablet'],
    ['tablet: iPad user agent', { userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', maxTouchPoints: 5 }, 'mobile', 'tablet'],
    ['touch screen: coarse pointer + multi-touch', { userAgent: UA.windows, maxTouchPoints: 10, coarse: true }, 'mobile', 'touch screen'],
    ['software renderer: SwiftShader', { renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' }, 'mobile', 'software renderer'],
    ['software renderer: llvmpipe', { userAgent: UA.windows, renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' }, 'mobile', 'software renderer'],
    ['integrated GPU: Intel HD 620', { userAgent: UA.windows, renderer: 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)' }, 'mobile', 'integrated GPU'],
    ['low memory: 4 GB', { deviceMemory: 4 }, 'mobile', 'low memory or few cores'],
    ['few cores: 4', { hardwareConcurrency: 4 }, 'mobile', 'low memory or few cores'],
    ['unknown memory / cores: desktop', { deviceMemory: 0, hardwareConcurrency: 0 }, 'desktop', 'desktop GPU'],
  ];
  for (const [name, o, tier, reason] of cases) {
    const r = rec(o);
    check(`recommend ${name} -> ${tier}`, r.tier === tier && r.reason === reason, `${r.tier}: ${r.reason}`);
  }
}

// ================================================================================================= resolveQuality precedence
{
  const store = new Map();
  const mock = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  // a browser-like global scope: window first (the module checks it before touching localStorage)
  globalThis.window = globalThis;
  Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true });
  const PHONE = env({ userAgent: UA.iphone, maxTouchPoints: 5, coarse: true });
  const res = (search, o = {}) => resolveQuality({ search, env: DESK, ...o });

  let q = res('');
  check('recommended: desktop env, nothing stored', q.tier === 'desktop' && q.source === 'recommended' && q.recommended === 'desktop');
  q = resolveQuality({ search: '', env: PHONE });
  check('recommended: phone env -> mobile', q.tier === 'mobile' && q.source === 'recommended' && q.reason === 'phone');

  storeTier('mobile');
  check('storeTier writes vibe.quality', store.get(QUALITY_STORAGE_KEY) === 'mobile' && storedTier() === 'mobile');
  q = res('');
  check('stored beats recommended', q.tier === 'mobile' && q.source === 'stored' && q.recommended === 'desktop', `${q.tier} / ${q.source}`);
  q = res('?quality=desktop');
  check('query beats stored', q.tier === 'desktop' && q.source === 'query');
  check('query is not stored', store.get(QUALITY_STORAGE_KEY) === 'mobile');
  q = res('?quality=bogus');
  check('unknown query value is ignored (falls to stored)', q.tier === 'mobile' && q.source === 'stored');

  // legacy ?quality=high|low (the Halloween game's old flag) and legacy stored values
  q = res('?quality=low');
  check('legacy ?quality=low -> mobile', q.tier === 'mobile' && q.source === 'query');
  q = resolveQuality({ search: '?quality=high', env: PHONE });
  check('legacy ?quality=high -> desktop (on a phone)', q.tier === 'desktop' && q.source === 'query');
  store.set(QUALITY_STORAGE_KEY, 'high');
  check('legacy stored "high" reads as desktop', storedTier() === 'desktop');
  store.set(QUALITY_STORAGE_KEY, 'garbage');
  check('garbage stored value reads as null', storedTier() === null && res('').source === 'recommended');
  storeTier('low');
  check('storeTier normalises legacy "low" to mobile', store.get(QUALITY_STORAGE_KEY) === 'mobile');
  storeTier('nonsense');
  check('storeTier ignores an unknown tier', store.get(QUALITY_STORAGE_KEY) === 'mobile');
  storeTier(null);
  check('storeTier(null) clears the choice', !store.has(QUALITY_STORAGE_KEY) && res('').source === 'recommended');

  // a game's own storage key
  storeTier('mobile', 'game.quality');
  q = res('', { storageKey: 'game.quality' });
  check('own storageKey: stored there, read from there', q.tier === 'mobile' && q.source === 'stored' && q.storageKey === 'game.quality' && res('').tier === 'desktop');

  // settings follow the tier, with per-tier overrides
  q = res('?quality=mobile', { overrides: { mobile: { postfx: { aa: 'taa' } }, desktop: { postfx: { aa: 'none' } } } });
  check('settings: the resolved tier\'s, with its override', q.settings.postfx.aa === 'taa' && q.settings.postfx.ssr === false && q.settings.engine.maxPixelRatio === 1.5);

  // a throwing storage (Safari private mode, blocked site data): no throw, nothing stored
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('SecurityError'); }, configurable: true });
  check('blocked storage: storedTier null, storeTier no-op', storedTier() === null && !throws(() => storeTier('mobile')) && res('').source === 'recommended');
  delete globalThis.localStorage; delete globalThis.window;
}

// ================================================================================================= tierSettings / defineTier
{
  const before = JSON.stringify(QUALITY_TIERS);
  const s = tierSettings('mobile', { postfx: { aa: 'taa' }, shadows: { cascades: 2 }, extra: { x: 1 } });
  check('merge: overridden key', s.postfx.aa === 'taa' && s.shadows.cascades === 2);
  check('merge: sibling keys kept', s.postfx.ssr === false && s.postfx.gbuffer === false && s.shadows.kernel === 'fast' && s.shadows.singleMapSize === 1024);
  check('merge: new group added', s.extra && s.extra.x === 1);
  check('merge: QUALITY_TIERS not mutated', JSON.stringify(QUALITY_TIERS) === before);
  s.engine.maxPixelRatio = 9; s.lights.clustered = true;
  check('result is a deep copy (editing it leaves the preset)', QUALITY_TIERS.mobile.engine.maxPixelRatio === 1.5 && QUALITY_TIERS.mobile.lights.clustered === false);
  check('unknown tier falls back to desktop', tierSettings('ultra').postfx.ssr === true);
  check('no overrides: equal to the preset', JSON.stringify(tierSettings('desktop')) === JSON.stringify(QUALITY_TIERS.desktop));
  const arr = tierSettings('desktop', { world: { list: [1, 2] } });
  check('arrays replace, not merge', Array.isArray(arr.world.list) && arr.world.list.join() === '1,2');

  defineTier('mobile', { effects: { ghosts: 3 }, postfx: { motionBlur: 0.5 } });
  check('defineTier: adds and changes keys', QUALITY_TIERS.mobile.effects.ghosts === 3 && QUALITY_TIERS.mobile.effects.particles === 0.4 && QUALITY_TIERS.mobile.postfx.motionBlur === 0.5);
  check('defineTier: later tierSettings see it', tierSettings('mobile').effects.ghosts === 3 && tierSettings('desktop').effects.ghosts === undefined);
  check('defineTier: unknown tier throws', throws(() => defineTier('ultra', {}), /unknown tier/));
}

await new Promise((r) => setImmediate(r)); // warnings are emitted on a later tick
check('no warnings (Node localStorage untouched)', warnings.length === 0, warnings.join('; '));

console.log('Quality tiers (src/core/Quality.js)\n');
for (const r of results) console.log(r);
console.log(`\n${failures ? `${failures} FAILED` : 'all passed'} (${results.length} checks)`);
process.exit(failures ? 1 : 0);
