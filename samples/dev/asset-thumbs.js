// Dev-only thumbnail renderer for the asset library (not in the build; served as /dev/asset-thumbs.html?id=<entry>).
// Runs the entry's snippet in the asset runtime's neutral studio (samples/assets/runtime.js), renders it at 2x and
// downsamples to 480 x 320, measures what it made, and leaves the result in window.__thumb:
// { done, error, dataUrl (JPEG), facts }. tools/render-asset-thumbs.mjs loads one entry per page load.
import { createStage, stageEntry, measure, drawCard, THUMB_W, THUMB_H } from '../assets/runtime.js';

const q = new URLSearchParams(location.search);
const id = q.get('id');
const quality = +(q.get('q') || 0.8);
window.__thumb = { done: false, error: null, dataUrl: null, facts: null };
// deterministic thumbnails: snippets that pick a random paint or variant get the same one every run
{ let a = [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261); Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function jpeg(src) {
  const c = document.createElement('canvas'); c.width = THUMB_W; c.height = THUMB_H;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, THUMB_W, THUMB_H);
  return c.toDataURL('image/jpeg', quality);
}

async function main() {
  const cat = await (await fetch(`${import.meta.env.BASE_URL}catalog/catalog.json`, { cache: 'no-store' })).json();
  const entry = cat.entries.find((e) => e.id === id);
  if (!entry) throw new Error(`no entry '${id}'`);
  const p = entry.preview || {};
  const card = !entry.snippet || p.mode === 'card' || p.mode === 'map';
  let facts = null;
  if (card) {
    if (entry.snippet) {
      // still run it: the snippet must work even when there is nothing to picture
      const stage = createStage({ width: 64, height: 64 });
      const { run } = await stageEntry(stage, { ...entry, preview: { ...p, mode: 'object' } }, import.meta.env.BASE_URL);
      facts = { ran: true, ...(run.result && run.result.__facts ? run.result.__facts : {}) };
      stage.renderer.dispose();
    }
    const c = document.createElement('canvas');
    drawCard(c, { label: p.label || entry.categoryLabel || entry.category, title: entry.name, note: p.note || (entry.reusable === false ? 'Not reusable as is' : '') });
    document.body.appendChild(c);
    window.__thumb.dataUrl = c.toDataURL('image/jpeg', quality);
  } else {
    const stage = createStage({ width: THUMB_W, height: THUMB_H, pixelRatio: 2, preserve: true });
    document.body.appendChild(stage.renderer.domElement);
    const { run, reframe } = await stageEntry(stage, entry, import.meta.env.BASE_URL);
    window.__thumb.stage = stage;
    const n = p.frames ?? 3, dt = 1 / 60;
    let t = 0;
    for (let i = 0; i < n; i++) {
      t += dt; run.frame(dt, t);
      stage.renderer.render(stage.scene, stage.camera);
      if (p.wait && i === 0) await new Promise((r) => setTimeout(r, p.wait));
      if (i % 10 === 9) await new Promise((r) => requestAnimationFrame(r));
    }
    reframe();                       // frame what the frames left (things that grow in, settle or lay out late)
    facts = measure(stage.scene);
    const res = run.result;
    const clips = res && (res.clips || res.animations);
    if (Array.isArray(clips) && clips.length) facts.animations = clips.map((c) => c.name);
    stage.renderer.render(stage.scene, stage.camera);
    window.__thumb.dataUrl = jpeg(stage.renderer.domElement);
  }
  window.__thumb.facts = facts;
}

main().catch((e) => { window.__thumb.error = String(e && e.stack ? e.stack : e); console.warn(e); }).finally(() => { window.__thumb.done = true; });
