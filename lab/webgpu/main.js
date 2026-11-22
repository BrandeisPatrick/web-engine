// Renderer comparison page (lab/README.md). One renderer per load:
//   ?r=gl       A: WebGLRenderer (classic, the engine's renderer)
//   ?r=gpu      B: WebGPURenderer on the WebGPU backend
//   ?r=gpu-gl   C: WebGPURenderer with forceWebGL: true (its WebGL2 backend)
// Other query: ?post=1 (the post-processing comparison, post.js), ?bundle=1 (B: the static city in a BundleGroup),
// ?ts=1 (WebGPURenderer timestamp queries), ?frames=N (rAF frames per pose, default 300), ?sync=N (GPU-synchronised
// frames per pose, default 60), ?poses=a,b (default: every pose in poses.json), 
// The same city (city.js) is drawn at 1920x1080, pixel ratio 1, from nyc-night's bench poses (poses.json, captured from
// the production page by bench.mjs --poses). Results: the table on the page (Copy button) and window.__lab.
import * as THREE from 'three';
import { buildCity, plainScene, plainLights } from './city.js';
import POSES from './poses.json';

const q = new URLSearchParams(location.search);
const MODE = q.get('r') || 'gl', POST = q.has('post'), BUNDLE = q.has('bundle'), TS = q.has('ts') && q.get('r') !== 'gl' && !!q.get('r');
const FRAMES = +q.get('frames') || 300, SYNC = +q.get('sync') || 60, W = 1920, H = 1080;
const poseIds = (q.get('poses') || Object.keys(POSES.poses).join(',')).split(',');
const out = document.getElementById('out');
const log = (s) => { out.textContent += `${s}\n`; };
const lab = window.__lab = { ready: false, error: null, mode: MODE, post: POST, bundle: BUNDLE, rows: [], start: {}, gpuErrors: [] };
const raf = () => new Promise((r) => requestAnimationFrame(r));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r2 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 100) / 100);

async function makeRenderer() {
  const canvas = document.getElementById('c');
  let renderer, backend, gl = null, device = null;
  if (MODE === 'gl') {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    gl = renderer.getContext(); backend = 'WebGLRenderer';
  } else {
    const { WebGPURenderer } = await import('three/webgpu');
    renderer = new WebGPURenderer({ canvas, antialias: false, forceWebGL: MODE === 'gpu-gl', trackTimestamp: TS, powerPreference: 'high-performance' });
    await renderer.init();
    const b = renderer.backend;
    backend = b.isWebGPUBackend ? 'WebGPU' : b.isWebGLBackend ? 'WebGL2 (WebGPURenderer fallback)' : 'unknown';
    if (b.isWebGPUBackend) device = b.device; else gl = b.gl;
    // a validation error voids the frame's command buffer: nothing is drawn and the timings mean nothing
    if (device) device.addEventListener('uncapturederror', (e) => { lab.gpuErrors.push(String(e.error && e.error.message).split('\n')[0]); });
  }
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const px = new Uint8Array(4);
  const sync = device ? () => device.queue.onSubmittedWorkDone() : () => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  return { renderer, backend, sync, gl, device };
}

async function adapterInfo() {
  const a = navigator.gpu && await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null);
  const i = a && a.info;
  const g = document.createElement('canvas').getContext('webgl2'), dbg = g && g.getExtension('WEBGL_debug_renderer_info');
  return {
    webgpu: i ? `${i.vendor} ${i.architecture}${i.description ? ` ${i.description}` : ''}${i.isFallbackAdapter ? ' (fallback)' : ''}` : 'none',
    timestampQuery: !!(a && a.features.has('timestamp-query')),
    webgl: g && dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'none',
    ua: navigator.userAgent,
  };
}

async function main() {
  lab.start.navToScriptMs = r2(performance.now());
  lab.adapter = await adapterInfo();
  log(`renderer ${MODE}${POST ? ' + post' : ''}${BUNDLE ? ' + BundleGroup' : ''} · ${W}x${H} @1 · building the city…`);
  const city = await buildCity();
  if (Math.abs(city.offset.x - POSES.offset.x) > 1e-3 || Math.abs(city.offset.z - POSES.offset.z) > 1e-3) throw new Error(`world offset ${JSON.stringify(city.offset)} differs from the poses' ${JSON.stringify(POSES.offset)}`);
  const plain = plainScene(city.scene);
  const scene = city.scene, aim = plainLights(scene);
  lab.scene = { buildMs: city.buildMs, ...plain };
  log(`city built in ${city.buildMs} ms: ${plain.kept} meshes kept, ${plain.materials} materials; dropped ${JSON.stringify(plain.dropped)}`);
  const camera = new THREE.PerspectiveCamera(POSES.fov, W / H, POSES.near, POSES.far);
  const tInit = performance.now();
  const R = await makeRenderer();
  const { renderer, sync } = R;
  lab.backend = R.backend;
  lab.start.rendererInitMs = r2(performance.now() - tInit);
  if (BUNDLE) {
    if (!R.device) throw new Error('?bundle=1 needs the WebGPU backend');
    const { BundleGroup } = await import('three/webgpu');
    const bg = new BundleGroup();
    for (const o of [...scene.children]) if (!o.isLight && o !== scene) bg.add(o);
    scene.add(bg);
  }
  let draw = (cam) => renderer.render(scene, cam);
  if (POST) {
    const { makePost } = await import('./post.js');
    const p = await makePost({ renderer, scene, camera, W, H, webgpu: MODE !== 'gl' });
    draw = p.render; lab.post = p.describe;
  }
  const setPose = (id) => {
    const P = POSES.poses[id];
    camera.position.fromArray(P.position); camera.quaternion.fromArray(P.quaternion); camera.updateMatrixWorld();
    aim(camera.position);
  };

  // first frame: the first render call (programs / pipelines compiled, textures uploaded) and the first presented frame
  setPose(poseIds[0]);
  lab.start.sceneReadyMs = r2(performance.now());
  let t = performance.now();
  draw(camera);
  lab.start.firstRenderCallMs = r2(performance.now() - t);
  await sync();
  lab.start.firstRenderSyncedMs = r2(performance.now() - t);
  await raf();
  lab.start.firstPresentedMs = r2(performance.now());
  log(`first render call ${lab.start.firstRenderCallMs} ms (with GPU ${lab.start.firstRenderSyncedMs} ms), first frame presented at ${lab.start.firstPresentedMs} ms after navigation`);

  const info = () => { // one frame's counts, shadow pass included (WebGLRenderer resets its counts after the shadow pass)
    const I = renderer.info.render;
    renderer.info.autoReset = false; renderer.info.reset(); draw(camera); renderer.info.autoReset = true;
    return { draws: MODE === 'gl' ? I.calls : I.drawCalls, tris: I.triangles };
  };
  for (const id of poseIds) {
    setPose(id);
    for (let i = 0; i < 30; i++) { draw(camera); await raf(); } // warm: this view's programs, the GPU clock
    // played frames: rAF intervals (vsync and the frame-rate limit off in bench.mjs) and the render call's CPU time
    const cpu = [], ivl = [];
    let last = await raf();
    for (let i = 0; i < FRAMES; i++) {
      const c0 = performance.now(); draw(camera); cpu.push(performance.now() - c0);
      const ts = await raf(); ivl.push(ts - last); last = ts;
    }
    const counts = info();
    // GPU-synchronised frames: each render waited on (WebGL: 1-pixel readPixels; WebGPU: onSubmittedWorkDone)
    const syn = [], gpu = [];
    if (TS) await renderer.resolveTimestampsAsync('render');
    draw(camera); await sync(); // drains the frames the rAF loop queued
    // one synchronised frame per rAF: WebGPURenderer advances its node frame (the post passes' once-per-frame
    // updates) in its own rAF loop, so back-to-back renders in one task would skip the scene pass under post
    for (let i = 0; i < SYNC; i++) {
      await raf();
      const s0 = performance.now(); draw(camera); await sync(); syn.push(performance.now() - s0);
      if (TS) { const g = await renderer.resolveTimestampsAsync('render'); if (g > 0) gpu.push(g); }
    }
    const row = {
      pose: id, cpuMed: r2(pct(cpu, 0.5)), cpuP95: r2(pct(cpu, 0.95)), frameMed: r2(pct(ivl, 0.5)), frameP95: r2(pct(ivl, 0.95)),
      syncMed: r2(pct(syn, 0.5)), syncP95: r2(pct(syn, 0.95)), syncMax: r2(Math.max(...syn)), gpuTsMed: gpu.length ? r2(pct(gpu, 0.5)) : null,
      ...counts, heapMB: performance.memory ? r2(performance.memory.usedJSHeapSize / 1048576) : null,
    };
    lab.rows.push(row);
  }
  if (lab.gpuErrors.length) throw new Error(`${lab.gpuErrors.length} WebGPU validation error(s), the frames are void: ${lab.gpuErrors[0]}`);
  show();
  // pictures: bench.mjs calls showPose(id) and screenshots the presented canvas (a WebGPU canvas reads back blank)
  lab.showPose = async (id) => { setPose(id); for (let i = 0; i < 4; i++) { draw(camera); await raf(); } };
  lab.ready = true;
}

function show() {
  const cols = ['pose', 'cpuMed', 'cpuP95', 'frameMed', 'frameP95', 'syncMed', 'syncP95', 'syncMax', 'gpuTsMed', 'draws', 'tris', 'heapMB'];
  const cell = (v) => (v == null ? '-' : String(v));
  const wd = cols.map((c) => Math.max(c.length, ...lab.rows.map((r) => cell(r[c]).length)));
  const lines = [cols.map((c, i) => c.padEnd(wd[i])).join('  '), ...lab.rows.map((r) => cols.map((c, i) => cell(r[c]).padEnd(wd[i])).join('  '))];
  const s = lab.start;
  log(`\n${lab.backend} · ${lab.adapter.webgpu} · ${lab.adapter.webgl}\nstart: renderer init ${s.rendererInitMs} ms, first render call ${s.firstRenderCallMs} ms, first presented frame ${s.firstPresentedMs} ms\n(ms; cpu = render call, frame = rAF interval, sync = render + GPU wait, gpuTs = timestamp queries)\n${lines.join('\n')}`);
  lab.text = out.textContent;
}

document.getElementById('copy').onclick = async () => {
  const text = `${out.textContent}\n${JSON.stringify({ ...lab, showPose: undefined })}`;
  try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
};
main().catch((e) => { lab.error = String(e && e.stack || e); log(`FAILED: ${lab.error}`); console.error(e); });
