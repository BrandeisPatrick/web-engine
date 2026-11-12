// render/TextureSets.js: the shared manifest (one request per texture root) and the "is this set shipped" rule the
// world layer uses to decide whether to request a set's maps (world/Shore.js).
import { sharedTextureManifest, manifestListsSet, TextureSets, textureBase } from '../src/render/TextureSets.js';

let failed = 0, n = 0;
const check = (name, ok, got) => { n++; if (!ok) { failed++; console.log(`FAIL  ${name}`, got ?? ''); } else console.log(`PASS  ${name}`); };

check('no manifest: unknown, so a set is tried (legacy behaviour)', manifestListsSet(null, 'rock_boulder_dry') === true);
check('malformed manifest (no sets object): tried', manifestListsSet({}, 'x') === true && manifestListsSet({ sets: 3 }, 'x') === true);
const m = { sets: { brick_red: { id: 'brick_wall_006' }, asphalt: { id: 'asphalt_02' }, odd: null } };
check('listed by id', manifestListsSet(m, 'asphalt_02') === true && manifestListsSet(m, 'brick_wall_006') === true);
check('listed by role key', manifestListsSet(m, 'brick_red') === true);
check('not listed: not requested', manifestListsSet(m, 'rock_boulder_dry') === false && manifestListsSet({ sets: {} }, 'withered_grass') === false);

// one fetch per base, the result shared (null included)
const realFetch = globalThis.fetch, calls = [];
globalThis.fetch = async (url) => { calls.push(String(url)); if (/\/a\//.test(url)) return { ok: true, json: async () => m }; if (/\/b\//.test(url)) return { ok: false }; throw new Error('offline'); };
try {
  const [a1, a2] = await Promise.all([sharedTextureManifest('/a/'), sharedTextureManifest('/a/')]);
  const a3 = await sharedTextureManifest('/a/');
  check('same base: one request, the same object', a1 === m && a2 === m && a3 === m && calls.filter((u) => u === '/a/manifest.json').length === 1, calls);
  const b1 = await sharedTextureManifest('/b/'), b2 = await sharedTextureManifest('/b/');
  check('missing manifest: null, remembered (one request)', b1 === null && b2 === null && calls.filter((u) => u === '/b/manifest.json').length === 1, calls);
  const c1 = await sharedTextureManifest('/c/');
  check('offline: null, no throw', c1 === null);
  const prev = TextureSets.options.base;
  TextureSets.options.base = '/a/';
  const d = await sharedTextureManifest();
  check('default base follows TextureSets.options.base', textureBase() === '/a/' && d === m && calls.filter((u) => u === '/a/manifest.json').length === 1);
  TextureSets.options.base = prev;
} finally { globalThis.fetch = realFetch; }
console.log(failed ? `${failed} of ${n} check(s) FAILED` : `all ${n} checks passed`);
process.exit(failed ? 1 : 0);
