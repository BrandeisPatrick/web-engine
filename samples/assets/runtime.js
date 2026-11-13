// Asset library runtime: runs a catalogue entry's code snippet (samples/public/catalog/catalog.json) in a small
// stage and frames what it made. The same code renders the committed thumbnails (samples/dev/asset-thumbs.html, driven
// by tools/render-asset-thumbs.mjs) and the interactive 3D preview of the Asset library page (samples/assets/), so a
// preview is the snippet itself running, not a separate recipe.
//
// Snippet conventions (the catalogue's snippets are written to be pasted into a page in samples/<name>/):
//   - single-line `import ... from '...'` statements: three, three's addons, @vibe/engine[/sub], and the
//     demos' own modules as '../<demo>/<file>.js'
//   - `scene`, `renderer` and `camera` exist (a THREE.Scene, WebGLRenderer, PerspectiveCamera)
//   - `import.meta.env.BASE_URL` is the site root (Vite)
//   - a line `// every frame: <code>` is code the page runs once per frame; `dt` (s) and `t` (s) are in scope
// Entry `preview` options: mode ('object' default | 'flat' | 'sky' | 'env' | 'lut' | 'card'), result (a snippet
// variable to hand back), frames (frames to run before a capture), az / el (deg), zoom, target, studio (false: no
// studio lights), ground (false: no shadow catcher).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const THUMB_W = 480, THUMB_H = 320;
export const BG = 0x1c1f26;

const MODULES = {
  three: () => Promise.resolve(THREE),
  '@vibe/engine': () => import('@vibe/engine'),
  '@vibe/engine/core': () => import('@vibe/engine/core'),
  '@vibe/engine/physics': () => import('@vibe/engine/physics'),
  '@vibe/engine/render': () => import('@vibe/engine/render'),
  '@vibe/engine/anim': () => import('@vibe/engine/anim'),
  '@vibe/engine/audio': () => import('@vibe/engine/audio'),
  '@vibe/engine/world': () => import('@vibe/engine/world'),
  'three/addons/loaders/GLTFLoader.js': () => import('three/addons/loaders/GLTFLoader.js'),
  'three/addons/utils/SkeletonUtils.js': () => import('three/addons/utils/SkeletonUtils.js'),
  'three/addons/environments/RoomEnvironment.js': () => Promise.resolve({ RoomEnvironment }),
};
// the demos' modules, loaded only when a snippet imports one (their entry points and viewers are left out: they boot)
const DEMO = import.meta.glob(['../nyc-night/*.js', '../miami-drive/*.js', '../halloween/*.js',
  '!../*/main.js', '!../*/hud.js', '!../miami-drive/car-viewer.js']);

const IMPORT_RE = /^\s*import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/;
const FRAME_RE = /^\s*\/\/\s*every frame:\s*(.+)$/;

/**
 * Parse a snippet into { imports: [{ clause, spec }], body, frame: [code] }. Throws on an import it cannot resolve.
 * @param {string} src
 */
export function parseSnippet(src) {
  const imports = [], body = [], frame = [];
  for (const line of src.split('\n')) {
    const m = IMPORT_RE.exec(line);
    if (m) { imports.push({ clause: m[1].trim(), spec: m[2] }); continue; }
    const f = FRAME_RE.exec(line);
    if (f) frame.push(f[1]);
    body.push(line);
  }
  return { imports, body: body.join('\n'), frame };
}

function bindClause(clause, i) {
  const ns = /^\*\s+as\s+(\w+)$/.exec(clause);
  if (ns) return `const ${ns[1]} = __mods[${i}];`;
  const named = /^\{([^}]*)\}$/.exec(clause);
  if (named) {
    const parts = named[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^(\w+)\s+as\s+(\w+)$/, '$1: $2'));
    return `const { ${parts.join(', ')} } = __mods[${i}];`;
  }
  if (/^\w+$/.test(clause)) return `const ${clause} = __mods[${i}].default;`;
  throw new Error(`unsupported import clause: ${clause}`);
}

async function loadModule(spec) {
  if (MODULES[spec]) return MODULES[spec]();
  if (DEMO[spec]) return DEMO[spec]();
  throw new Error(`snippet imports '${spec}', which the asset runtime does not provide`);
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

/**
 * Run `snippet` against `ctx` ({ scene, renderer, camera, base }). Resolves { result, frame(dt, t) }.
 * @param {string} snippet
 * @param {{ scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.Camera, base: string }} ctx
 * @param {string} [resultName]
 */
export async function runSnippet(snippet, ctx, resultName) {
  const { imports, body, frame } = parseSnippet(snippet);
  const mods = await Promise.all(imports.map((im) => loadModule(im.spec)));
  const head = imports.map((im, i) => bindClause(im.clause, i)).join('\n');
  const tail = frame.map((c) => `__frame.push((dt, t) => { ${c} });`).join('\n');
  const ret = resultName ? `\nreturn ${resultName};` : '';
  const src = `${head}\n${body.replace(/import\.meta\.env\.BASE_URL/g, '__BASE')}\n${tail}${ret}`;
  const fn = new AsyncFunction('__mods', '__BASE', '__frame', 'scene', 'renderer', 'camera', src);
  const frames = [];
  const result = await fn(mods, ctx.base, frames, ctx.scene, ctx.renderer, ctx.camera);
  return { result, frame: (dt, t) => { for (const f of frames) f(dt, t); } };
}

/**
 * A preview stage: renderer, scene with neutral studio lighting (room environment, key light with a soft shadow on a
 * shadow catcher), camera. `canvas` optional.
 */
export function createStage({ canvas, width = THUMB_W, height = THUMB_H, pixelRatio = 1, preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.05, 5000);
  const pm = new THREE.PMREMGenerator(renderer);
  const roomEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  const studio = new THREE.Group();
  studio.userData.stage = true;
  const hemi = new THREE.HemisphereLight(0xdfe6f0, 0x2a2622, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  studio.add(hemi, key, key.target);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.35 }));
  catcher.receiveShadow = true;
  catcher.userData.stage = true;
  return { renderer, scene, camera, studio, key, catcher, roomEnv, width, height };
}

function contentBox(scene) {
  // visible meshes only (games park hidden things far away), instanced meshes with instances, no particles
  const box = new THREE.Box3(), b = new THREE.Box3();
  const visit = (o) => {
    if (!o.visible || o.userData.stage || o.isLight || o.isCamera || o.isPoints || o.isSprite) return;
    if ((o.isMesh || o.isLine) && o.geometry && !(o.isInstancedMesh && o.count === 0)) {
      b.makeEmpty();
      if (o.isInstancedMesh || o.isBatchedMesh) o.computeBoundingBox();   // the cached box goes stale when instances move
      b.expandByObject(o, false);
      // expandByObject also walks the children: only this object's own bounds are wanted here
      if (o.children.length) {
        const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
        if (o.isInstancedMesh) { if (!o.boundingBox) o.computeBoundingBox(); b.copy(o.boundingBox).applyMatrix4(o.matrixWorld); }
        else b.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
      }
      if (!b.isEmpty() && Number.isFinite(b.min.x) && Number.isFinite(b.max.x) && b.max.x - b.min.x < 1e5) box.union(b);
    }
    for (const c of o.children) visit(c);
  };
  scene.updateMatrixWorld(true);
  for (const o of scene.children) visit(o);
  return box;
}

const DEG = Math.PI / 180;

/**
 * Place the camera, key light and shadow catcher around what the snippet added. Returns the framing { target, dist }.
 */
export function frameStage(stage, opts = {}) {
  const { scene, camera, key, catcher } = stage;
  const mode = opts.mode || 'object';
  if (mode === 'sky') {
    const look = opts.look || [0, 0.12, -1];
    camera.fov = opts.fov || 55; camera.near = 0.1; camera.far = 20000;
    camera.position.set(0, 1.7, 0);
    const target = new THREE.Vector3(...look).normalize().add(camera.position);
    camera.lookAt(target); camera.updateProjectionMatrix();
    return { target, dist: 1 };
  }
  const box = contentBox(scene);
  if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(1, 1, 1));
  const center = opts.target ? new THREE.Vector3(...opts.target) : box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  let r = Math.max(1e-3, size.length() / 2);
  if (mode === 'flat' || mode === 'lut') {
    // a face-on view of a flat swatch (a texture on a plane facing +Z)
    const fitH = Math.max(size.y, size.x / camera.aspect) / 2;
    const dist = (fitH / Math.tan((camera.fov * DEG) / 2)) * (opts.zoom ? 1 / opts.zoom : 1.04);
    camera.position.set(center.x, center.y, center.z + dist);
    camera.near = dist / 100; camera.far = dist * 10;
    camera.lookAt(center); camera.updateProjectionMatrix();
    return { target: center, dist };
  }
  const az = (opts.az ?? 35) * DEG, el = (opts.el ?? 18) * DEG;
  // fit the bounding sphere into the smaller of the two view angles
  const vfov = camera.fov * DEG, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  let dist = opts.dist || r / Math.sin(Math.min(vfov, hfov) / 2);
  const place = () => {
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.near = Math.max(0.01, dist - r * 4) / 4; camera.far = dist + r * 20;
    camera.lookAt(center); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  };
  place();
  if (!opts.dist && !opts.target) {
    // fit the box's corners (not its sphere) into 84 % of the frame, and centre their projection
    const v = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
    for (let it = 0; it < 6; it++) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let k = 0; k < 8; k++) {
        v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(camera);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      const ext = Math.max((x1 - x0) / 2, (y1 - y0) / 2);
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      const h = dist * Math.tan(vfov / 2);
      center.addScaledVector(right, ((x0 + x1) / 2) * h * camera.aspect).addScaledVector(up, ((y0 + y1) / 2) * h);
      dist *= ext / 0.84;
      place();
    }
  }
  dist /= opts.zoom || 1;
  place();
  if (key) {
    key.position.copy(center).add(new THREE.Vector3(-0.55, 1.1, 0.75).normalize().multiplyScalar(r * 4));
    key.target.position.copy(center);
    const s = key.shadow.camera;
    s.left = -r * 1.6; s.right = r * 1.6; s.top = r * 1.6; s.bottom = -r * 1.6; s.near = r * 0.5; s.far = r * 9;
    s.updateProjectionMatrix();
  }
  if (catcher) {
    catcher.position.set(center.x, box.min.y - r * 0.002, center.z);
    catcher.scale.setScalar(r * 12);
  }
  return { target: center, dist };
}

/** Stage the entry: lights / catcher / environment per preview mode, run the snippet, frame it. */
export async function stageEntry(stage, entry, base) {
  const p = entry.preview || {};
  const mode = p.mode || 'object';
  const { scene } = stage;
  const studio = p.studio !== false && mode !== 'sky';
  if (studio) { scene.add(stage.studio); scene.environment = stage.roomEnv; scene.environmentIntensity = 0.55; }
  if (studio && p.ground !== false && mode === 'object') scene.add(stage.catcher);
  const run = await runSnippet(entry.snippet, { scene, renderer: stage.renderer, camera: stage.camera, base }, p.result);
  // one frame first: some assets only lay out their instances in their per-frame update
  run.frame(1 / 60, 1 / 60);
  if (mode === 'lut') addLutChart(scene, run.result, (await import('@vibe/engine/render')).lutLookup);
  if (mode === 'env') addMirrorBall(scene);
  // shadows from everything the snippet made (it may not set castShadow itself)
  if (studio && p.shadows !== false) {
    scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) && !o.userData.stage && !o.material?.transparent) o.castShadow = true; });
  }
  let look = p.look;
  const sun = run.result && run.result.sunDir;
  if (mode === 'sky' && !look && sun && sun.isVector3) { const h = Math.hypot(sun.x, sun.z) || 1; look = [sun.x / h, 0.1, sun.z / h]; }
  const reframe = () => {
    const f = frameStage(stage, { ...p, mode, look });
    if (mode === 'env') { stage.camera.position.set(0, 0.25, 3.3); stage.camera.lookAt(0, 0, 0); f.target = new THREE.Vector3(); }
    return f;
  };
  const framing = reframe();
  return { run, framing, mode, reframe };
}

function addMirrorBall(scene) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 64, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.04 }));
  ball.userData.stage = true;
  scene.add(ball);
}

/** A test chart (hue sweep over a grey ramp) graded through `lut` on the CPU: the lower half graded, the top as is. */
function addLutChart(scene, lut, lookup) {
  const W = 480, H = 320, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), out = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1), half = y < H / 2, v = (y % (H / 2)) / (H / 2 - 1);
      let r, gg, b;
      if (v > 0.8) { r = gg = b = u; } else {
        const h = u * 6, k = (n) => { const t = (n + h) % 6; return Math.max(0, Math.min(1, Math.abs(t - 3) - 1)); };
        const sat = 1 - v / 0.8 * 0.85, val = 0.35 + 0.6 * (1 - v / 0.8 * 0.5);
        r = val * (1 - sat + sat * k(5)); gg = val * (1 - sat + sat * k(3)); b = val * (1 - sat + sat * k(1));
      }
      if (!half && lut) {
        // the chart is display-referred sRGB; PostFX applies the LUT to display-referred colour (Lut.js)
        lookup(lut, r, gg, b, out); r = out[0]; gg = out[1]; b = out[2];
      }
      const i = (y * W + x) * 4;
      img.data[i] = Math.round(Math.max(0, Math.min(1, r)) * 255); img.data[i + 1] = Math.round(Math.max(0, Math.min(1, gg)) * 255);
      img.data[i + 2] = Math.round(Math.max(0, Math.min(1, b)) * 255); img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(15,17,21,0.9)'; g.fillRect(0, H / 2 - 1, W, 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scene.add(m);
}

/**
 * Geometry facts of what the snippet made: unique triangles (shared geometries counted once, instancing not
 * multiplied), meshes, instanced meshes and their instance counts, skinned meshes, bones.
 */
export function measure(scene) {
  const seen = new Set();
  let tris = 0, meshes = 0, instanced = 0, instances = 0, skinned = 0, points = 0;
  scene.traverse((o) => {
    if (o.userData.stage || isStageChild(o) || !isShown(o)) return;
    if (o.isPoints) { points++; return; }
    if (!o.isMesh || !o.geometry || (o.isInstancedMesh && o.count === 0)) return;
    meshes++;
    if (o.isInstancedMesh) { instanced++; instances += o.count; }
    if (o.isSkinnedMesh) skinned++;
    const g = o.geometry;
    if (seen.has(g)) return;
    seen.add(g);
    const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
    tris += Math.floor((g.drawRange && Number.isFinite(g.drawRange.count) ? Math.min(n, g.drawRange.count) : n) / 3);
  });
  return { triangles: tris, meshes, instanced, instances, skinned, points };
}

function isShown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function isStageChild(o) {
  for (let p = o.parent; p; p = p.parent) if (p.userData && p.userData.stage) return true;
  return false;
}

/**
 * Draw a placeholder card (things that have no picture: sounds, map data, assets that cannot be shown outside their
 * demo) onto a 2D canvas of THUMB_W x THUMB_H.
 */
export function drawCard(canvas, { label, title, note }) {
  canvas.width = THUMB_W; canvas.height = THUMB_H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#1c1f26'; g.fillRect(0, 0, THUMB_W, THUMB_H);
  g.strokeStyle = '#2c313b'; g.lineWidth = 2; g.strokeRect(24, 24, THUMB_W - 48, THUMB_H - 48);
  g.textAlign = 'center';
  g.fillStyle = '#7d8696'; g.font = '500 15px "Avenir Next", system-ui, sans-serif';
  g.fillText(label.toUpperCase(), THUMB_W / 2, THUMB_H / 2 - 22);
  g.fillStyle = '#d6dbe3'; g.font = '600 22px "Avenir Next", system-ui, sans-serif';
  wrap(g, title, THUMB_W / 2, THUMB_H / 2 + 12, THUMB_W - 100, 28);
  if (note) { g.fillStyle = '#7d8696'; g.font = '14px "Avenir Next", system-ui, sans-serif'; g.fillText(note, THUMB_W / 2, THUMB_H - 52); }
}

function wrap(g, text, x, y, maxW, lh) {
  const words = String(text).split(' '); let line = '', lines = [];
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  lines = lines.slice(0, 2);
  lines.forEach((l, i) => g.fillText(l, x, y + i * lh));
}
