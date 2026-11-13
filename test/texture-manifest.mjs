// render/TextureSets.js: the shared manifest (one request per texture root) and the "is this set shipped" rule the
// world layer uses to decide whether to request a set's maps (world/Shore.js).
// Also the maxAnisotropy option (texture arrays and loadTextureSet maps).
import { sharedTextureManifest, manifestListsSet, TextureSets, textureBase, makeDataArrayTexture, loadTextureSet } from '../src/render/TextureSets.js';

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

// TextureSets.options.maxAnisotropy: caps the texture arrays (makeDataArrayTexture) and loadTextureSet maps; unset =
// the GPU maximum. loadTextureSet runs its JPG path on a stub fetch + a stub <img> (ImageLoader) that loads at once.
const gpu16 = { capabilities: { getMaxAnisotropy: () => 16 } };
const arrA = () => makeDataArrayTexture(new Uint8Array(4 * 4 * 4 * 2), 4, 2, true, gpu16, { free: false }).anisotropy;
const fakeImg = () => { const ls = {}; return { width: 4, height: 4, addEventListener: (k, f) => { ls[k] = f; }, removeEventListener() {}, set src(v) { setTimeout(() => ls.load.call(this), 0); } }; };
const prevDoc = globalThis.document, prevOpts = { ...TextureSets.options };
globalThis.document = { createElementNS: fakeImg };
globalThis.fetch = async () => ({ ok: true, blob: async () => new Blob([new Uint8Array(8)]) });
let setN = 0;
const setA = async (renderer = gpu16) => {
  const s = await loadTextureSet(`aniso_${setN++}`, { renderer, base: '/aniso/', maps: ['map', 'normalMap'] });
  return s ? [s.map.anisotropy, s.normalMap.anisotropy] : null;
};
try {
  TextureSets.configure({ log: false, maxAnisotropy: null });
  const [a0, s0] = [arrA(), await setA()];
  check('maxAnisotropy unset: arrays and sets get the GPU maximum, as before', a0 === 16 && s0 && s0[0] === 16 && s0[1] === 16, { a0, s0 });
  TextureSets.configure({ maxAnisotropy: 8 });
  const [a8, s8] = [arrA(), await setA()];
  check('maxAnisotropy 8: both families capped', a8 === 8 && s8 && s8[0] === 8 && s8[1] === 8, { a8, s8 });
  TextureSets.configure({ maxAnisotropy: 32 });
  const [a32, s32] = [arrA(), await setA()];
  check('maxAnisotropy above the GPU maximum: clamped to it', a32 === 16 && s32 && s32[0] === 16 && s32[1] === 16, { a32, s32 });
  TextureSets.configure({ maxAnisotropy: 8 });
  check('no renderer: 4 regardless of the cap', makeDataArrayTexture(new Uint8Array(4 * 4 * 4), 4, 1, true, null, { free: false }).anisotropy === 4);
} finally {
  globalThis.fetch = realFetch; globalThis.document = prevDoc;
  TextureSets.configure({ log: prevOpts.log, maxAnisotropy: prevOpts.maxAnisotropy });
}
console.log(failed ? `${failed} of ${n} check(s) FAILED` : `all ${n} checks passed`);
process.exit(failed ? 1 : 0);
