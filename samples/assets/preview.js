// Interactive 3D preview of one catalogue entry (loaded by main.js only when a details view opens): the entry's own
// snippet running in the asset runtime's studio, with orbit controls (mouse or touch). One preview at a time; close()
// frees its WebGL context.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStage, stageEntry } from './runtime.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} entry  catalogue entry
 * @returns {Promise<{ close(): void, renderer: import('three').WebGLRenderer }>}
 */
export async function openPreview(canvas, entry) {
  const host = canvas.parentElement;           // read now: the page may swap the canvas out while this loads
  const box = host.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const stage = createStage({ canvas, width: w, height: h, pixelRatio: Math.min(2, devicePixelRatio || 1) });
  stage.camera.aspect = w / h;
  const base = import.meta.env.BASE_URL;
  let closed = false, raf = 0;
  const { run, framing, mode, reframe } = await stageEntry(stage, entry, base);
  const controls = new OrbitControls(stage.camera, canvas);
  const aim = (f) => { controls.target.copy(f.target); controls.update(); };
  aim(framing);
  controls.enableDamping = true;
  controls.enablePan = mode !== 'sky';
  if (mode === 'sky') { controls.rotateSpeed = -0.35; controls.enableZoom = false; }
  let t = 0, last = performance.now(), frames = 0;
  const loop = () => {
    if (closed) return;
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    run.frame(dt, t);
    // assets that grow in or lay out over their first frames get framed again once, as the thumbnails are
    if (++frames === (entry.preview && entry.preview.frames ? Math.min(60, entry.preview.frames) : 3)) aim(reframe());
    controls.update();
    stage.renderer.render(stage.scene, stage.camera);
    raf = requestAnimationFrame(loop);
  };
  const ro = new ResizeObserver(() => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    stage.renderer.setSize(r.width, r.height, false);
    stage.camera.aspect = r.width / r.height; stage.camera.updateProjectionMatrix();
  });
  ro.observe(host);
  loop();
  return {
    renderer: stage.renderer,
    close() {
      closed = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      stage.renderer.dispose(); stage.renderer.forceContextLoss();
    },
  };
}
