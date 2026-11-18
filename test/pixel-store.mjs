// The pixel-store shadow (src/core/PixelStoreShadow.js) on a stand-in WebGL2 context that keeps its own pixel-store
// state and counts getParameter round trips: the five unpack values are answered from the shadow after one read each,
// pixelStorei always reaches the context, WebGL's conversion (ToInt32) and its INVALID_VALUE on a negative value are
// followed, other pnames pass through, a lost context passes through and records nothing, a restored context and
// reset() start over, dispose() puts the context back; three's partial-upload sequence (WebGLTextures updateTexture)
// asks the context nothing after the first frame; and over 20000 random calls a shadowed and a plain context return
// the same values and receive the same pixelStorei calls. Run: node test/pixel-store.mjs
import { shadowPixelStore } from '../src/core/PixelStoreShadow.js';
import { shadowPixelStore as fromCore } from '../src/core/index.js';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}

const C = {
  UNPACK_ROW_LENGTH: 0x0cf2, UNPACK_SKIP_ROWS: 0x0cf3, UNPACK_SKIP_PIXELS: 0x0cf4, UNPACK_ALIGNMENT: 0x0cf5,
  UNPACK_SKIP_IMAGES: 0x806d, UNPACK_IMAGE_HEIGHT: 0x806e, PACK_ROW_LENGTH: 0x0d02, VIEWPORT: 0x0ba2,
};
const SHADOWED = [C.UNPACK_ROW_LENGTH, C.UNPACK_SKIP_ROWS, C.UNPACK_SKIP_PIXELS, C.UNPACK_SKIP_IMAGES, C.UNPACK_IMAGE_HEIGHT];
const DEFAULTS = () => new Map([[C.UNPACK_ROW_LENGTH, 0], [C.UNPACK_SKIP_ROWS, 0], [C.UNPACK_SKIP_PIXELS, 0], [C.UNPACK_SKIP_IMAGES, 0],
  [C.UNPACK_IMAGE_HEIGHT, 0], [C.UNPACK_ALIGNMENT, 4], [C.PACK_ROW_LENGTH, 0]]);
/** A stand-in WebGL2 context: pixel-store state as WebGL keeps it, getParameter round trips counted, a canvas that fires events. */
function fakeGL() {
  const gl = {
    ...C, state: DEFAULTS(), lost: false, reads: 0, readsOf: new Map(), stores: [], errors: 0, canvas: new EventTarget(),
    isContextLost() { return this.lost; },
    getParameter(p) {
      this.reads++; this.readsOf.set(p, (this.readsOf.get(p) || 0) + 1);
      if (this.lost) return null;
      if (p === C.VIEWPORT) return new Int32Array([0, 0, 300, 150]);
      return this.state.has(p) ? this.state.get(p) : null;
    },
    pixelStorei(p, v) {
      if (arguments.length < 2) throw new TypeError('2 arguments required');
      this.stores.push([p, v]);
      if (this.lost) return;
      const i = v | 0;
      if (!this.state.has(p)) { this.errors++; return; }
      if (i < 0 || (p === C.UNPACK_ALIGNMENT && ![1, 2, 4, 8].includes(i))) { this.errors++; return; }
      this.state.set(p, i);
    },
    loseContext() { this.lost = true; },
    restoreContext() { this.lost = false; this.state = DEFAULTS(); this.canvas.dispatchEvent(new Event('webglcontextrestored')); },
  };
  return gl;
}

// ------------------------------------------------------------------------------------------------- install
{
  check('core exports shadowPixelStore', fromCore === shadowPixelStore);
  check('null without a context', shadowPixelStore(null) === null && shadowPixelStore(undefined) === null);
  const gl1 = fakeGL(); delete gl1.UNPACK_ROW_LENGTH; // WebGL1 has no unpack row length
  const gp1 = gl1.getParameter, ps1 = gl1.pixelStorei;
  check('null on a WebGL1 context (no UNPACK_ROW_LENGTH), nothing installed', shadowPixelStore(gl1) === null && gl1.getParameter === gp1 && gl1.pixelStorei === ps1);
  const gl = fakeGL(), gp = gl.getParameter, ps = gl.pixelStorei;
  const h = shadowPixelStore(gl);
  check('a handle with reset() and dispose()', h && typeof h.reset === 'function' && typeof h.dispose === 'function');
  check('getParameter and pixelStorei replaced on the context', gl.getParameter !== gp && gl.pixelStorei !== ps);
  check('a second call returns the same handle and wraps nothing twice', shadowPixelStore(gl) === h && (() => { const g = gl.getParameter; shadowPixelStore(gl); return gl.getParameter === g; })());
}

// ------------------------------------------------------------------------------------------- reads, stores
{
  const gl = fakeGL();
  gl.pixelStorei(C.UNPACK_ROW_LENGTH, 64); // set before the shadow: the first read must see it
  gl.stores.length = 0;
  shadowPixelStore(gl);
  const first = SHADOWED.map((p) => gl.getParameter(p));
  check('first read of each value asks the context once', gl.reads === 5 && SHADOWED.every((p) => gl.readsOf.get(p) === 1), `${gl.reads} reads`);
  check('a value set before the shadow was installed is read back', first[0] === 64 && first.slice(1).every((v) => v === 0), JSON.stringify(first));
  for (let i = 0; i < 100; i++) for (const p of SHADOWED) gl.getParameter(p);
  check('later reads ask the context nothing', gl.reads === 5, `${gl.reads} reads`);
  gl.pixelStorei(C.UNPACK_SKIP_PIXELS, 17); gl.pixelStorei(C.UNPACK_SKIP_ROWS, 3); gl.pixelStorei(C.UNPACK_IMAGE_HEIGHT, 256);
  check('every pixelStorei reaches the context', gl.stores.length === 3 && gl.state.get(C.UNPACK_SKIP_PIXELS) === 17 && gl.state.get(C.UNPACK_IMAGE_HEIGHT) === 256);
  check('reads after a store return the stored value without a round trip', gl.getParameter(C.UNPACK_SKIP_PIXELS) === 17 && gl.getParameter(C.UNPACK_SKIP_ROWS) === 3
    && gl.getParameter(C.UNPACK_IMAGE_HEIGHT) === 256 && gl.reads === 5);
  gl.pixelStorei(C.UNPACK_ROW_LENGTH, 7.9);
  check('a fractional value is stored as WebGL converts it (7.9 -> 7)', gl.getParameter(C.UNPACK_ROW_LENGTH) === 7 && gl.state.get(C.UNPACK_ROW_LENGTH) === 7);
  gl.pixelStorei(C.UNPACK_SKIP_IMAGES, true);
  check('true is stored as 1', gl.getParameter(C.UNPACK_SKIP_IMAGES) === 1 && gl.state.get(C.UNPACK_SKIP_IMAGES) === 1);
  gl.pixelStorei(C.UNPACK_ROW_LENGTH, -5);
  check('a negative value (INVALID_VALUE) leaves the shadow as the context: unchanged', gl.errors === 1 && gl.getParameter(C.UNPACK_ROW_LENGTH) === 7 && gl.state.get(C.UNPACK_ROW_LENGTH) === 7);
  gl.pixelStorei(C.UNPACK_ROW_LENGTH, 2 ** 32 + 9);
  check('a value past 2^32 wraps as WebGL wraps it (ToInt32)', gl.getParameter(C.UNPACK_ROW_LENGTH) === 9 && gl.state.get(C.UNPACK_ROW_LENGTH) === 9);
  let threw = false;
  try { gl.pixelStorei(C.UNPACK_ROW_LENGTH); } catch { threw = true; }
  check('a call the context rejects (missing argument) throws and records nothing', threw && gl.getParameter(C.UNPACK_ROW_LENGTH) === 9 && gl.state.get(C.UNPACK_ROW_LENGTH) === 9);
  const r0 = gl.reads;
  gl.getParameter(C.UNPACK_ALIGNMENT); gl.getParameter(C.UNPACK_ALIGNMENT); gl.getParameter(C.PACK_ROW_LENGTH); const vp = gl.getParameter(C.VIEWPORT);
  check('other pnames pass through on every read (UNPACK_ALIGNMENT, PACK_ROW_LENGTH, VIEWPORT)', gl.reads === r0 + 4 && vp instanceof Int32Array && vp[2] === 300);
  gl.pixelStorei(C.UNPACK_ALIGNMENT, 3);
  check('a pname the shadow does not hold is only forwarded', gl.errors === 2 && gl.getParameter(C.UNPACK_ALIGNMENT) === 4);
}

// --------------------------------------------------------------------------------- lost / restored context
{
  const gl = fakeGL(), gp0 = gl.getParameter, ps0 = gl.pixelStorei; const h = shadowPixelStore(gl);
  gl.pixelStorei(C.UNPACK_ROW_LENGTH, 40); gl.getParameter(C.UNPACK_ROW_LENGTH);
  gl.loseContext();
  const r0 = gl.reads;
  const v = gl.getParameter(C.UNPACK_ROW_LENGTH);
  check('lost context: a read goes to the context (null, as WebGL answers)', v === null && gl.reads === r0 + 1);
  gl.pixelStorei(C.UNPACK_ROW_LENGTH, 99);
  check('lost context: pixelStorei is forwarded and records nothing', gl.stores.at(-1)[1] === 99);
  gl.restoreContext();
  const r1 = gl.reads;
  check('restored context: the shadow starts over from the context (defaults)', gl.getParameter(C.UNPACK_ROW_LENGTH) === 0 && gl.reads === r1 + 1
    && gl.getParameter(C.UNPACK_ROW_LENGTH) === 0 && gl.reads === r1 + 1);
  gl.pixelStorei(C.UNPACK_SKIP_ROWS, 5); gl.state.set(C.UNPACK_SKIP_ROWS, 6); // someone changed it behind the shadow's back
  h.reset();
  const r2 = gl.reads;
  check('reset(): the next read asks the context again', gl.getParameter(C.UNPACK_SKIP_ROWS) === 6 && gl.reads === r2 + 1);
  h.dispose();
  check('dispose(): the context methods are the originals again', gl.getParameter === gp0 && gl.pixelStorei === ps0);
  gl.canvas.dispatchEvent(new Event('webglcontextrestored'));
  check('dispose(): the restore listener is gone (no error after an event)', gl.getParameter === gp0);
  const r3 = gl.reads;
  gl.getParameter(C.UNPACK_SKIP_ROWS); gl.getParameter(C.UNPACK_SKIP_ROWS);
  check('dispose(): every read reaches the context', gl.reads === r3 + 2);
  check('dispose(): a new shadow can be installed', shadowPixelStore(gl) !== h && shadowPixelStore(gl) !== null);
}
{
  // a real context's methods live on its prototype: dispose() deletes the own properties and the prototype's show again
  class ProtoGL { constructor() { Object.assign(this, C); this.n = 0; } getParameter() { this.n++; return 0; } pixelStorei() {} isContextLost() { return false; } }
  const gl = new ProtoGL(); const h = shadowPixelStore(gl);
  check('prototype methods: replaced by own properties', Object.prototype.hasOwnProperty.call(gl, 'getParameter') && Object.prototype.hasOwnProperty.call(gl, 'pixelStorei'));
  h.dispose();
  check('prototype methods: dispose() leaves no own properties', !Object.prototype.hasOwnProperty.call(gl, 'getParameter') && !Object.prototype.hasOwnProperty.call(gl, 'pixelStorei')
    && gl.getParameter === ProtoGL.prototype.getParameter);
}

// ------------------------------------------------------------------- three's partial upload, frame after frame
// WebGLTextures updateTexture (three r180) for a texture with updateRanges: read three values, set the row length,
// per range set the skips and upload, then put the three values back
function threeUpload(gl, width, ranges) {
  const row = gl.getParameter(gl.UNPACK_ROW_LENGTH), px = gl.getParameter(gl.UNPACK_SKIP_PIXELS), rows = gl.getParameter(gl.UNPACK_SKIP_ROWS);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, width);
  for (const [start] of ranges) { gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, start % width); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, Math.floor(start / width)); }
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, row); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, px); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, rows);
}
{
  const plain = fakeGL(), gl = fakeGL(); shadowPixelStore(gl);
  for (let f = 0; f < 120; f++) for (const g of [plain, gl]) { threeUpload(g, 1024, [[f * 3, 4], [2048 + f, 8]]); threeUpload(g, 512, [[f, 2]]); }
  check('three partial uploads, 120 frames x 2 textures: 3 reads in all (the first frame), 720 without the shadow', gl.reads === 3 && plain.reads === 720, `${gl.reads} / ${plain.reads}`);
  check('three partial uploads: the context receives the same pixelStorei calls', JSON.stringify(gl.stores) === JSON.stringify(plain.stores));
  check('three partial uploads: the context ends in the same state', JSON.stringify([...gl.state]) === JSON.stringify([...plain.state]));
}

// ------------------------------------------------------------------------- random calls, shadowed vs plain
{
  let s = 12345; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const plain = fakeGL(), gl = fakeGL(); shadowPixelStore(gl);
  const PN = [...SHADOWED, C.UNPACK_ALIGNMENT, C.PACK_ROW_LENGTH, C.VIEWPORT];
  const VALUES = [0, 1, 2, 3, 4, 8, 17, 255, 4096, -1, -7, 2.5, 1e10, -1e10, NaN, Infinity, true, false, '12', null];
  let same = true, firstDiff = '';
  for (let i = 0; i < 20000 && same; i++) {
    const p = PN[Math.floor(rnd() * PN.length)], r = rnd();
    if (r < 0.002) { for (const g of [plain, gl]) g.loseContext(); continue; }
    if (r < 0.02) { for (const g of [plain, gl]) if (g.lost) g.restoreContext(); continue; }
    if (r < 0.5) { const v = VALUES[Math.floor(rnd() * VALUES.length)]; plain.pixelStorei(p, v); gl.pixelStorei(p, v); continue; }
    const a = plain.getParameter(p), b = gl.getParameter(p);
    const ja = a instanceof Int32Array ? [...a].join() : a, jb = b instanceof Int32Array ? [...b].join() : b;
    if (ja !== jb) { same = false; firstDiff = `call ${i}: pname 0x${p.toString(16)} plain ${ja} shadowed ${jb}`; }
  }
  check('20000 random calls (values, lost and restored contexts): every read the same as without the shadow', same, firstDiff);
  check('20000 random calls: the same pixelStorei calls reach the context, the same final state', JSON.stringify(gl.stores) === JSON.stringify(plain.stores)
    && JSON.stringify([...gl.state]) === JSON.stringify([...plain.state]));
  const trips = (g) => SHADOWED.reduce((n, p) => n + (g.readsOf.get(p) || 0), 0);
  check('20000 random calls: under a quarter of the round trips for the five values (the rest: lost spells, first reads)', trips(gl) * 4 < trips(plain), `${trips(gl)} vs ${trips(plain)}`);
}

for (const r of results) console.log(r);
console.log(`\n${results.length - failures}/${results.length} pixel-store checks passed`);
process.exit(failures ? 1 : 0);
