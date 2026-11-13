// Asset library page: a grid of the catalogue (samples/public/catalog/catalog.json, written by
// tools/catalog-assets.mjs) with category / scope filters and a search; a card opens its details (facts, credit,
// code with a copy button, the demos that use it) and, for models and code-made assets, an interactive 3D preview that
// loads the engine only then (preview.js). Up front the page loads the catalogue and the thumbnails, nothing else.
// URL: #<entry id> opens that entry. window.__sample: the smoke test's hooks (ready, poses, info, selfTest).
const BASE = import.meta.env.BASE_URL;
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter((k) => k != null)); return e; };

const state = { q: '', cat: '', scope: '' };
let cat = null, byId = new Map();
let preview = null, previewToken = 0;

const sample = window.__sample = {
  ready: false, poses: [],
  info: () => ({ renderer: '', drawCalls: 0, triangles: 0, size: { w: innerWidth, h: innerHeight, pixelRatio: devicePixelRatio } }),
  /** Open an entry with a 3D preview, wait for it to render, close it: '' or the error. */
  async selfTest(id = 'engine-vehicle-sedan') {
    try { await openDetails(id, { wait: true }); const ok = !!preview; closeDetails(); return ok ? '' : `no 3D preview for ${id}`; } catch (e) { closeDetails(); return String(e && e.message || e); }
  },
};

function sourceOf(e) { return e.kind === 'code' ? 'Made in code' : e.credit ? e.credit.source : 'File'; }
function words(e) {
  return [e.name, e.id, e.categoryLabel, e.description, e.scope === 'engine' ? 'engine' : `demo ${e.demo || ''}`, sourceOf(e),
    e.credit && e.credit.author, ...(e.tags || []), ...(e.usedBy || []).map((d) => cat.demos[d])].join(' ').toLowerCase();
}

function matches(e) {
  if (state.cat && e.category !== state.cat) return false;
  if (state.scope && e.scope !== state.scope) return false;
  if (state.q) for (const w of state.q.toLowerCase().split(/\s+/).filter(Boolean)) if (!e._words.includes(w)) return false;
  return true;
}

function renderGrid() {
  const list = cat.entries.filter(matches);
  const grid = $('grid');
  grid.replaceChildren(...list.map((e) => {
    const img = el('img', { src: `${BASE}${e.thumb}`, alt: '', loading: 'lazy', decoding: 'async', width: 480, height: 320 });
    const meta = `${e.categoryLabel} · ${sourceOf(e)}${e.reusable ? '' : ' · not reusable'}`;
    const btn = el('button', { type: 'button', className: 'card' }, img, el('div', { className: 't' }, el('b', { textContent: e.name }), el('span', { textContent: meta })));
    btn.addEventListener('click', () => { location.hash = e.id; });
    return el('li', {}, btn);
  }));
  $('count').textContent = `${list.length} of ${cat.entries.length} assets`;
  $('empty').hidden = list.length > 0;
}

function renderChips() {
  const counts = {};
  for (const e of cat.entries) if (!state.scope || e.scope === state.scope) counts[e.category] = (counts[e.category] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const chip = (v, label, n) => {
    const b = el('button', { type: 'button' }, label, el('span', { textContent: n }));
    b.setAttribute('aria-pressed', String(state.cat === v));
    b.addEventListener('click', () => { state.cat = v; renderChips(); renderGrid(); });
    return b;
  };
  $('cats').replaceChildren(chip('', 'All', total), ...Object.keys(cat.categories).filter((k) => counts[k]).map((k) => chip(k, cat.categories[k], counts[k])));
}

function renderSources() {
  $('sources-body').replaceChildren(...cat.sources.map((s) => el('tr', {},
    el('td', {}, el('a', { href: s.url, textContent: s.name, target: '_blank', rel: 'noopener' })),
    el('td', { textContent: s.licences.join(', ') }), el('td', { textContent: s.entries }))));
}

// ------------------------------------------------------------------------------------------------ details
const REPO = 'https://github.com/BrandeisPatrick/web-engine/blob/main/';
const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const FACT_LABELS = { triangles: 'Triangles', lod1Triangles: 'Triangles (LOD 1)', animations: 'Animations', bones: 'Bones', meshes: 'Meshes', materials: 'Materials', textures: 'Textures', resolution: 'Resolution', maps: 'Maps', realSize: 'Real-world size', role: 'Role in its demo', levels: 'Levels', meshNames: 'Meshes in the file', lods: 'Levels of detail', size: 'Size', paint: 'Paint', hours: 'Time (hours)', preset: 'Preset' };

function factRows(e) {
  const rows = [];
  const add = (k, v) => { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) rows.push([k, v]); };
  add('Kind', `${e.kind === 'file' ? 'File' : 'Made in code'}, ${e.scope === 'engine' ? 'in the engine package' : `in a demo (${cat.demos[e.demo] || e.demo || e.usedBy.map((d) => cat.demos[d]).join(', ')})`}`);
  if (e.kind === 'file') {
    const files = e.where.files;
    add('Files', el('span', {}, ...files.slice(0, 4).flatMap((f, i) => [i ? el('br') : null, el('a', { href: REPO + f, textContent: f.replace('samples/public/', ''), target: '_blank', rel: 'noopener' })]), files.length > 4 ? ` and ${files.length - 4} more` : null));
    add('Size on disk', fmtBytes(e.bytes));
  } else {
    add('Module', el('a', { href: REPO + e.where.module, textContent: e.where.module, target: '_blank', rel: 'noopener' }));
    add('Export', e.where.export || `${e.where.symbol} (not exported)`);
    if (e.where.import) add('Import from', e.where.import);
  }
  for (const [k, v] of Object.entries(e.facts || {})) {
    if (k === 'skinned' || k === 'note' || k === 'use' || k === 'type' || k === 'origin' || k === 'species') continue;
    add(FACT_LABELS[k] || k, Array.isArray(v) ? v.join(', ') : typeof v === 'number' ? v.toLocaleString('en') : String(v));
  }
  if (e.credit) {
    add('Author', e.credit.author);
    add('Licence', e.credit.licence);
    if (e.credit.url) add('Source', el('a', { href: e.credit.url, textContent: e.credit.source || e.credit.url, target: '_blank', rel: 'noopener' }));
    else add('Source', e.credit.source);
  } else add('Source', 'Made in code in this repository (MIT)');
  const used = e.usedBy.length
    ? el('span', {}, ...e.usedBy.flatMap((d, i) => [i ? ', ' : null, el('a', { href: `${BASE}${d}/`, textContent: cat.demos[d] || d })]), e.via ? ` (through ${e.via})` : null)
    : 'No demo uses it today';
  add('Used by', used);
  if (!e.preview3d && e.snippet) add('3D preview', (e.preview && e.preview.mode) === 'card' ? 'none (nothing to show in 3D)' : 'none (a flat image says it all)');
  return rows;
}

async function openDetails(id, { wait = false } = {}) {
  const e = byId.get(id);
  if (!e) return;
  const dlg = $('details');
  closePreview();
  $('d-cat').textContent = `${e.categoryLabel} · ${sourceOf(e)}`;
  $('d-name').textContent = e.name;
  $('d-desc').textContent = e.description;
  $('d-warn').hidden = e.reusable;
  $('d-warn').textContent = e.reusable ? '' : `Not reusable as is: ${e.reason}.`;
  $('d-facts').replaceChildren(...factRows(e).flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', {}, v)]));
  $('d-code-wrap').hidden = !e.snippet;
  $('d-code').textContent = e.snippet || '';
  $('d-copy').textContent = 'Copy';
  const img = $('d-img'), canvas = $('d-canvas');
  img.src = `${BASE}${e.thumb}`; img.hidden = false; canvas.hidden = true;
  $('d-status').textContent = e.preview3d ? 'Loading the 3D preview…' : '';
  if (!dlg.open) dlg.showModal();
  dlg.querySelector('.d-body').scrollTop = 0; dlg.querySelector('.d-wrap').scrollTop = 0;
  if (!e.preview3d) return;
  const token = ++previewToken;
  const p = (async () => {
    const { openPreview } = await import('./preview.js');
    if (token !== previewToken) return;
    canvas.hidden = false;
    const pv = await openPreview(canvas, e);
    if (token !== previewToken) { pv.close(); return; }
    preview = pv; img.hidden = true;
    $('d-status').textContent = 'Drag to orbit, scroll or pinch to zoom';
  })().catch((err) => {
    console.warn('[assets] preview failed', err);
    if (token === previewToken) { canvas.hidden = true; img.hidden = false; $('d-status').textContent = 'The 3D preview could not start here; the picture is from the same code.'; }
    if (wait) throw err;
  });
  if (wait) { await p; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }
}

function closePreview() {
  previewToken++;
  if (preview) { preview.close(); preview = null; }
  // a fresh canvas: a WebGL context lost on purpose cannot be reused by the next preview
  const old = $('d-canvas'), c = el('canvas', { id: 'd-canvas', hidden: true });
  old.replaceWith(c);
}

function closeDetails() {
  closePreview();
  const dlg = $('details');
  if (dlg.open) dlg.close();
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

function onHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && byId.has(id)) openDetails(id);
  else if ($('details').open) closeDetails();
}

// ------------------------------------------------------------------------------------------------ boot
async function boot() {
  cat = await (await fetch(`${BASE}catalog/catalog.json`)).json();
  for (const e of cat.entries) { e._words = words(e); byId.set(e.id, e); }
  const c = cat.counts;
  $('intro').textContent = `${c.total} assets in the repository: ${c.byKind.file} downloaded files and ${c.byKind.code} made in code, ${c.byScope.engine} of them part of the engine package. Pick one for its credit, a 3D preview and the code that loads or creates it.`;
  renderChips(); renderGrid(); renderSources();
  let t = 0;
  $('q').addEventListener('input', (ev) => { clearTimeout(t); t = setTimeout(() => { state.q = ev.target.value.trim(); renderGrid(); }, 80); });
  for (const b of $('scope').querySelectorAll('button')) {
    b.addEventListener('click', () => {
      state.scope = b.dataset.v;
      for (const o of $('scope').querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b));
      renderChips(); renderGrid();
    });
  }
  $('d-close').addEventListener('click', closeDetails);
  // Esc closes the dialog without closeDetails; the event comes later, so skip it when the dialog is open again
  $('details').addEventListener('close', () => { if ($('details').open) return; closePreview(); if (location.hash) history.replaceState(null, '', location.pathname + location.search); });
  $('details').addEventListener('click', (ev) => { if (ev.target === $('details')) closeDetails(); });
  $('d-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('d-code').textContent); $('d-copy').textContent = 'Copied'; } catch { $('d-copy').textContent = 'Select and copy'; }
  });
  addEventListener('hashchange', onHash);
  onHash();
  sample.ready = true;
}

boot().catch((e) => { console.error('[assets] could not load the catalogue', e); $('count').textContent = 'The catalogue could not be loaded.'; });
