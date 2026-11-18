// Pixel-store shadow: answers gl.getParameter for WebGL2's unpack pixel-store state (UNPACK_ROW_LENGTH,
// UNPACK_SKIP_ROWS, UNPACK_SKIP_PIXELS, UNPACK_IMAGE_HEIGHT, UNPACK_SKIP_IMAGES) from a copy kept in the page, instead
// of a synchronous round trip to the GPU process. Every other getParameter and every pixelStorei still reach the
// context; the shadow only records what pixelStorei set.
//
// Why: three.js (r180) reads UNPACK_ROW_LENGTH, UNPACK_SKIP_PIXELS and UNPACK_SKIP_ROWS on every upload of a texture
// that has updateRanges (WebGLTextures updateTexture), to put them back afterwards; copyTextureToTexture reads those
// and the two 3D ones. Chrome answers each read only after the GPU process has run every command queued before it, so
// the main thread waits for the GPU and the two stop overlapping. The engine uploads such textures every frame (the
// clustered light lists, the GPU particles' spawn rows): on nyc-night that was about 11 reads and 10 ms of waiting per
// frame, a played frame of 16 ms for 9 ms of GPU work. With the shadow the reads cost nothing and the uploads are the
// same calls with the same values, so the picture is the same.
//
// shadowPixelStore(gl) -> { reset(), dispose() } | null. Installs instance properties gl.pixelStorei and
// gl.getParameter (three looks both up on the context at call time, so the renderer needs nothing else); a second
// call on the same context returns the same handle; null when `gl` is not a WebGL2 context. The Engine calls it on
// its renderer's context in the constructor (src/core/Engine.js); a page that makes its own WebGLRenderer can call it
// on renderer.getContext().
// A shadowed value is unknown until the first read, which asks the context once (so pixelStorei calls made before the
// shadow was installed are honoured); after that pixelStorei keeps it current. pixelStorei(pname, v) records v as WebGL
// converts it (ToInt32) and only when the call can succeed (v >= 0: a negative value is INVALID_VALUE and leaves the
// state as it was). While the context is lost, reads go to the context (null, as WebGL answers) and nothing is
// recorded; on `webglcontextrestored` of gl.canvas (a restored context starts from the defaults) and on reset() every
// value is unknown again. dispose() removes the properties and the listener.
// Allocation: none per call (a fixed array of five values).

const UNPACK_ROW_LENGTH = 0x0cf2, UNPACK_SKIP_ROWS = 0x0cf3, UNPACK_SKIP_PIXELS = 0x0cf4;
const UNPACK_SKIP_IMAGES = 0x806d, UNPACK_IMAGE_HEIGHT = 0x806e;

/** pname -> slot in the shadow, -1 when not shadowed. */
function slotOf(p) {
  switch (p) {
    case UNPACK_ROW_LENGTH: return 0;
    case UNPACK_SKIP_ROWS: return 1;
    case UNPACK_SKIP_PIXELS: return 2;
    case UNPACK_SKIP_IMAGES: return 3;
    case UNPACK_IMAGE_HEIGHT: return 4;
    default: return -1;
  }
}

/** @type {WeakMap<object, { reset: () => void, dispose: () => void }>} */
const installed = new WeakMap();

/**
 * Answer getParameter for the unpack pixel-store state from a page-side shadow (see the file header).
 * @param {any} gl  a WebGL2RenderingContext (renderer.getContext())
 * @returns {{ reset: () => void, dispose: () => void } | null}  null when `gl` is not a WebGL2 context
 */
export function shadowPixelStore(gl) {
  if (!gl || typeof gl.getParameter !== 'function' || typeof gl.pixelStorei !== 'function' || gl.UNPACK_ROW_LENGTH !== UNPACK_ROW_LENGTH) return null;
  const had = installed.get(gl);
  if (had) return had;
  const pixelStorei = gl.pixelStorei, getParameter = gl.getParameter;
  const value = [0, 0, 0, 0, 0], known = [false, false, false, false, false];
  const lost = () => typeof gl.isContextLost === 'function' && gl.isContextLost();
  const reset = () => { known.fill(false); };
  /** @param {number} pname @param {number} param */
  gl.pixelStorei = function (pname, param) {
    pixelStorei.apply(gl, arguments); // first, as called: a call that throws (too few arguments) records nothing
    const s = slotOf(pname);
    if (s >= 0 && !lost()) {
      const v = param | 0; // WebGL's GLint conversion (ToInt32)
      if (v >= 0) { value[s] = v; known[s] = true; }
    }
  };
  /** @param {number} pname */
  gl.getParameter = function (pname) {
    const s = slotOf(pname);
    if (s < 0 || lost()) return getParameter.apply(gl, arguments);
    if (!known[s]) { const v = getParameter.call(gl, pname); if (typeof v !== 'number') return v; value[s] = v; known[s] = true; }
    return value[s];
  };
  const canvas = gl.canvas && typeof gl.canvas.addEventListener === 'function' ? gl.canvas : null;
  if (canvas) canvas.addEventListener('webglcontextrestored', reset);
  const handle = {
    reset,
    dispose() {
      if (installed.get(gl) !== handle) return;
      installed.delete(gl);
      delete gl.pixelStorei; delete gl.getParameter;
      // a context whose methods were own properties before (a stand-in) gets them back
      if (gl.pixelStorei !== pixelStorei) gl.pixelStorei = pixelStorei;
      if (gl.getParameter !== getParameter) gl.getParameter = getParameter;
      if (canvas) canvas.removeEventListener('webglcontextrestored', reset);
    },
  };
  installed.set(gl, handle);
  return handle;
}
