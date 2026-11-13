// Asset catalogue: one list of every asset the repository has, downloaded files and assets made in code.
//
//   node tools/catalog-assets.mjs           write samples/public/catalog/catalog.json and docs/ASSETS.md
//   node tools/catalog-assets.mjs --check   write nothing; exit 1 when either file is out of date or a check fails
//
// Sources, merged and checked here:
//   - the texture-set manifests under samples/public (manifest.json: one entry per set; a 512 px tier next to a 1K
//     folder joins its entry)
//   - the CREDITS.md files: every downloaded asset's author, licence and source link are taken from (or checked
//     against) its row there
//   - tools/asset-registry.mjs: the assets made in code, the downloaded files no manifest describes, and the files
//     under samples/public that are not assets (IGNORE, each with its reason)
//   - tools/asset-measurements.json: facts measured in the browser by tools/render-asset-thumbs.mjs (triangles,
//     meshes, animation names of what each snippet makes)
//   - the files themselves: sizes on disk, JPEG dimensions, glTF / GLB triangle counts and animation names
// Checks (each failure is listed and makes --check exit 1): every file under samples/public is in an entry or on the
// ignore list; every entry's files, module, export and thumbnail exist; every downloaded asset has an author, a licence
// and a source link; every snippet imports only what exists; ids are unique; categories are known.
// test/asset-catalog.mjs runs the same build in the Node test suite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const CATALOG_JSON = 'samples/public/catalog/catalog.json';
export const MARKDOWN = 'docs/ASSETS.md';
export const THUMB_DIR = 'samples/public/catalog/thumbs';
export const MEASUREMENTS = 'tools/asset-measurements.json';

const abs = (p) => path.join(ROOT, p);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const exists = (p) => fs.existsSync(abs(p));
const read = (p) => fs.readFileSync(abs(p), 'utf8');
const size = (p) => fs.statSync(abs(p)).size;

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(abs(dir), { withFileTypes: true })) {
    if (e.name === '.DS_Store') continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out.sort();
}

// ------------------------------------------------------------------------------------------------ file facts
/** Width and height of a JPEG (first SOFn marker) or PNG, or null. */
export function imageSize(p) {
  const b = fs.readFileSync(abs(p));
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/** The JSON of a .glb or .gltf file, plus its binary chunk (GLB) or null. */
function gltfJson(p) {
  const b = fs.readFileSync(abs(p));
  if (p.endsWith('.gltf')) return { json: JSON.parse(b.toString('utf8')) };
  const len = b.readUInt32LE(12);
  return { json: JSON.parse(b.subarray(20, 20 + len).toString('utf8')) };
}

const primTris = (json, prim) => {
  const mode = prim.mode ?? 4;
  if (mode !== 4) return 0;
  const acc = prim.indices != null ? json.accessors[prim.indices] : json.accessors[prim.attributes.POSITION];
  return Math.floor(acc.count / 3);
};

/** Triangles (each mesh once), meshes, materials, textures, skins, animation names, image sizes of a glTF / GLB. */
export function gltfFacts(p, meshNames = null) {
  const { json } = gltfJson(p);
  const meshes = (json.meshes || []).filter((m) => !meshNames || meshNames.includes(m.name));
  const tris = meshes.reduce((s, m) => s + m.primitives.reduce((t, pr) => t + primTris(json, pr), 0), 0);
  const f = { triangles: tris, meshes: meshes.length };
  if (meshNames) {
    const lod = (json.meshes || []).filter((m) => meshNames.some((n) => m.name === `${n}_lod1`));
    if (lod.length) f.lod1Triangles = lod.reduce((s, m) => s + m.primitives.reduce((t, pr) => t + primTris(json, pr), 0), 0);
    return f;
  }
  f.materials = (json.materials || []).length;
  f.textures = (json.textures || []).length;
  if (json.skins && json.skins.length) f.bones = json.skins.reduce((s, k) => s + k.joints.length, 0);
  if (json.animations && json.animations.length) f.animations = json.animations.map((a) => a.name);
  return f;
}

// ------------------------------------------------------------------------------------------------ module exports
const _exports = new Map();
/** Names a JS module exports (export function / class / const / let / var, export { a as b }, export * from). */
export function moduleExports(p) {
  if (_exports.has(p)) return _exports.get(p);
  const names = new Set();
  _exports.set(p, names);
  if (!exists(p)) return names;
  const src = read(p);
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([\w$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+(?:const|let|var)\s+([\w$]+\s*=[^;]*?,\s*[\w$]+\s*=)/gm)) for (const n of m[1].matchAll(/([\w$]+)\s*=/g)) names.add(n[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/gm)) {
    for (const part of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const a = /^(?:[\w$]+\s+as\s+)?([\w$]+)$/.exec(part);
      if (a) names.add(a[1]);
    }
  }
  for (const m of src.matchAll(/^export\s+\*\s+as\s+([\w$]+)\s+from/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm)) {
    for (const n of moduleExports(rel(path.resolve(path.dirname(abs(p)), m[1])))) names.add(n);
  }
  return names;
}

/** Repo path of a snippet import specifier (snippets are written for a page in samples/<name>/), or null. */
export function specifierPath(spec) {
  const sub = /^@vibe\/engine(?:\/(\w+))?$/.exec(spec);
  if (sub) return sub[1] ? `src/${sub[1]}/index.js` : 'src/index.js';
  if (spec.startsWith('../')) return `samples/${spec.slice(3)}`;
  return null;
}
const ADDONS = ['three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js', 'three/addons/environments/RoomEnvironment.js'];

const IMPORT_RE = /^\s*import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/;
/** Problems of a snippet's imports: unknown modules, names a module does not export, multi-line imports. */
export function checkSnippet(snippet) {
  const bad = [];
  const lines = snippet.split('\n');
  for (const line of lines) {
    if (/^\s*import\b/.test(line) && !IMPORT_RE.test(line)) { bad.push(`import not on one line: ${line.trim()}`); continue; }
    const m = IMPORT_RE.exec(line);
    if (!m) continue;
    const [, clause, spec] = m;
    if (spec === 'three' || ADDONS.includes(spec)) continue;
    const p = specifierPath(spec);
    if (!p) { bad.push(`unknown module '${spec}'`); continue; }
    if (!exists(p)) { bad.push(`module '${spec}' (${p}) does not exist`); continue; }
    if (/(^|\/)main\.js$|hud\.js$|car-viewer\.js$/.test(p)) bad.push(`'${spec}' starts its demo when imported`);
    const named = /^\{([^}]*)\}$/.exec(clause.trim());
    if (named) {
      const have = moduleExports(p);
      for (const part of named[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        const n = part.split(/\s+as\s+/)[0];
        if (!have.has(n)) bad.push(`'${spec}' has no export '${n}'`);
      }
    }
  }
  if (/^\s*export\b/m.test(snippet)) bad.push('snippets must not export');
  return bad;
}

// ------------------------------------------------------------------------------------------------ credits
/** The CREDITS.md row (table line or paragraph) containing `token`, and its cells by header. */
export function creditRow(file, token) {
  const text = read(file);
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.includes(token));
  if (i < 0) return null;
  const line = lines[i];
  const out = { line, cells: {} };
  if (line.trim().startsWith('|')) {
    let h = i;
    while (h > 0 && lines[h - 1].trim().startsWith('|')) h--;
    const split = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
    const head = split(lines[h]), cells = split(line);
    head.forEach((k, j) => { out.cells[k.toLowerCase()] = cells[j] || ''; });
    // the section heading above the table (licence or source stated there)
    for (let k = h - 1; k >= 0; k--) if (/^#+\s/.test(lines[k])) { out.heading = lines[k]; break; }
  }
  return out;
}

const firstUrl = (s) => { const m = /(https?:\/\/[^\s>)|]+)/.exec(s || ''); return m ? m[1] : ''; };
const cell = (cells, re) => { for (const k in cells) if (re.test(k)) return cells[k]; return ''; };
const clean = (s) => String(s || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*]/g, '').replace(/<([^>]+)>/g, '$1').trim();

function resolveCredit(e, problems) {
  const c = e.credit || {};
  if (c.selfMade) return { source: 'made for this repository', author: 'the repository', licence: 'MIT (the repository licence)', url: '', creditsFile: null };
  if (!c.file || !exists(c.file)) { problems.push(`${e.id}: credits file missing (${c.file})`); return null; }
  const row = creditRow(c.file, c.row);
  if (!row) { problems.push(`${e.id}: no row containing '${c.row}' in ${c.file}`); return null; }
  const cells = row.cells, ctx = `${row.heading || ''} ${row.line}`;
  const author = c.author || clean(cell(cells, /^author/));
  let licence = c.licence || clean(cell(cells, /^licen[cs]e/));
  if (!licence && /CC0/.test(ctx)) licence = 'CC0 1.0';
  const url = c.url || firstUrl(cell(cells, /source/)) || firstUrl(row.line);
  const source = c.source || (/polyhaven/.test(url) ? 'Poly Haven' : /poly\.pizza/.test(url) ? 'poly.pizza' : '');
  const out = { source, author, licence, url, creditsFile: c.file };
  for (const k of ['source', 'author', 'licence', 'url']) if (!out[k]) problems.push(`${e.id}: no ${k} (from ${c.file})`);
  // what the registry states must be in the credits file too (a typo or a stale credit fails here)
  const text = read(c.file);
  if (c.author && !c.author.split(/[,;(]/)[0].split(/\s+/).filter((w) => w.length > 2).every((w) => text.includes(w))) problems.push(`${e.id}: author '${c.author}' is not in ${c.file}`);
  if (c.url && !text.includes(c.url) && !text.includes(c.url.replace(/^https:\/\/polyhaven\.com\/a\//, ''))) problems.push(`${e.id}: url '${c.url}' is not in ${c.file}`);
  return out;
}

// ------------------------------------------------------------------------------------------------ texture manifests
const AREA_DEMO = { nyc: 'nyc-night', miami: 'miami-drive', halloween: 'halloween' };
const MAP_NAMES = { Diffuse: 'albedo', nor_gl: 'normal (OpenGL)', Rough: 'roughness', AO: 'ambient occlusion', Displacement: 'displacement' };

function manifestEntries(problems) {
  const out = new Map();
  const manifests = walk('samples/public').filter((p) => p.endsWith('/manifest.json'));
  for (const mp of manifests) {
    const m = JSON.parse(read(mp));
    const dir = path.posix.dirname(mp), area = dir.split('/')[2];
    for (const role of Object.keys(m.sets || {}).sort()) {
      const s = m.sets[role];
      const pid = s.id.replace(/_2k$/, '');
      const key = `${area}-${s.id}`;
      let e = out.get(key);
      const files = walk(`${dir}/${s.id}`);
      const diff = files.find((f) => /\/diff\.jpg$/.test(f));
      const res = diff ? imageSize(diff) : null;
      const tier = { dir: `${dir}/`, resolution: res ? `${res.w} x ${res.h}` : '?', ktx2: !!s.ktx2 || files.some((f) => f.endsWith('.ktx2')) };
      if (!e) {
        const credits = exists(`${dir}/CREDITS.md`) && read(`${dir}/CREDITS.md`).includes(pid) ? `${dir}/CREDITS.md` : `samples/public/${area}/CREDITS.md`;
        e = {
          id: key, name: s.name, category: 'texture-set', kind: 'file', usedBy: [AREA_DEMO[area]], files: [], manifests: [],
          credit: { file: credits, row: pid, author: (s.authors || []).join(', '), licence: /CC0/.test(m.source || '') ? 'CC0 1.0' : '', url: `https://polyhaven.com/a/${pid}` },
          tags: ['poly haven', 'pbr', 'photo scan', role, ...(s.ktx2 ? ['ktx2'] : [])],
          facts: { role, realSize: s.size ? `${s.size[0]} x ${s.size[1]} m` : undefined, maps: Object.keys(s.maps || {}).map((k) => MAP_NAMES[k] || k).join(', '), tiers: [] },
          description: '',
          _snippet: { base: `${dir.replace('samples/public/', '')}/`, id: s.id, ktx2: !!s.ktx2, area },
        };
        out.set(key, e);
      }
      e.files.push(...files);
      e.manifests.push(mp);
      e.facts.tiers.push(tier);
    }
  }
  for (const e of out.values()) {
    const t = e.facts.tiers.sort((a, b) => b.resolution.localeCompare(a.resolution, 'en', { numeric: true }));
    e.facts.resolution = t.map((x) => `${x.resolution}${x.ktx2 ? ' (JPG + KTX2)' : ''} in ${x.dir.replace('samples/public/', '')}`).join('; ');
    delete e.facts.tiers;
    const sn = e._snippet; delete e._snippet;
    const demo = { nyc: 'the Night NYC walk', miami: 'the Miami drive' }[sn.area];
    e.description = `Poly Haven PBR scan used by ${demo} as its '${e.facts.role}' surface${t.length > 1 ? '; a 1K desktop tier and a 512 px phone tier' : ''}${sn.ktx2 ? '; KTX2 (Basis) copies next to the JPGs, which stay as the fallback' : ''}. The engine's TextureSets loads it by manifest id.`;
    e.snippet = `import * as THREE from 'three';
import { ${sn.ktx2 ? 'TextureSets, ' : ''}loadTextureManifest, loadTextureSet } from '@vibe/engine/render';
${sn.ktx2 ? "TextureSets.configure({ basisPath: import.meta.env.BASE_URL + 'miami/basis/' });   // KTX2 transcoder\n" : ''}const base = import.meta.env.BASE_URL + '${sn.base}';
const manifest = await loadTextureManifest(base);
const set = await loadTextureSet('${sn.id}', { renderer, base, manifest });
const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap }));
scene.add(ball);`;
  }
  return [...out.values()];
}

// ------------------------------------------------------------------------------------------------ build
const CAT_ORDER = ['vehicle', 'character', 'building', 'prop', 'vegetation', 'boat', 'sign', 'road', 'water', 'texture-set', 'texture', 'sky', 'environment', 'effect', 'grade', 'map', 'sound'];

function demoOf(modulePath) {
  const m = /^samples\/([^/]+)\//.exec(modulePath || '');
  return m ? m[1] : null;
}

function demoSources(demo) {
  return walk(`samples/${demo}`).filter((p) => p.endsWith('.js')).map(read).join('\n');
}

/**
 * Build the catalogue. Resolves { catalog, json, markdown, problems }.
 */
export async function buildCatalog() {
  const reg = await import(`${pathToFileURL(abs('tools/asset-registry.mjs')).href}?t=${Date.now()}`);
  const problems = [];
  const measured = exists(MEASUREMENTS) ? JSON.parse(read(MEASUREMENTS)) : {};
  const demoSrc = Object.fromEntries(Object.keys(reg.DEMOS).map((d) => [d, demoSources(d)]));
  const entries = [];

  for (const e of [...manifestEntries(problems), ...reg.FILE_ENTRIES.map((x) => ({ ...x, kind: 'file' })), ...reg.CODE_ENTRIES.map((x) => ({ ...x, kind: 'code' }))]) {
    const out = {
      id: e.id, name: e.name, category: e.category, categoryLabel: reg.CATEGORIES[e.category] || e.category, kind: e.kind,
      scope: 'demo', demo: null, where: null, usedBy: e.usedBy || [], via: e.via || null, reusable: e.reusable !== false,
      reason: e.reason || null, credit: null, bytes: null, facts: { ...(e.facts || {}) }, tags: e.tags || [],
      thumb: `catalog/thumbs/${e.id}.jpg`, preview3d: false, description: e.description || '', snippet: e.snippet || null,
      preview: e.preview || {},
    };
    if (!reg.CATEGORIES[e.category]) problems.push(`${e.id}: unknown category '${e.category}'`);
    if (e.kind === 'file') {
      const files = [...new Set(e.files)];
      for (const f of files) if (!exists(f)) problems.push(`${e.id}: file missing: ${f}`);
      const present = files.filter(exists);
      out.where = { files, ...(e.manifests ? { manifests: [...new Set(e.manifests)] } : {}) };
      out.bytes = present.reduce((s, f) => s + size(f), 0);
      out.demo = e.usedBy && e.usedBy.length === 1 ? e.usedBy[0] : null;
      out.credit = resolveCredit(e, problems);
      // facts from the files themselves
      const glb = present.find((f) => /\.(glb|gltf)$/.test(f));
      if (glb && !e.gltfMeshes && present.filter((f) => /\.glb$/.test(f)).length > 1) {
        out.facts.levels = present.filter((f) => /\.glb$/.test(f)).map((f) => `${path.posix.basename(f)}: ${gltfFacts(f).triangles} triangles`).join('; ');
      } else if (glb) Object.assign(out.facts, gltfFacts(glb, e.gltfMeshes || null));
      if (e.category === 'environment' || (e.category === 'texture-set' && !e.manifests)) {
        const img = present.find((f) => /\.jpg$/.test(f));
        const d = img && imageSize(img);
        if (d) out.facts.resolution = `${d.w} x ${d.h}`;
      }
      if (e.gltfMeshes) out.facts.meshNames = e.gltfMeshes.join(', ');
    } else {
      const mod = e.module;
      if (!mod || !exists(mod)) problems.push(`${e.id}: module missing: ${mod}`);
      const name = e.export || e.symbol;
      if (e.export && !moduleExports(mod).has(e.export)) problems.push(`${e.id}: ${mod} does not export '${e.export}'`);
      if (e.symbol && exists(mod) && !new RegExp(`function\\s+${e.symbol}\\b`).test(read(mod))) problems.push(`${e.id}: no function '${e.symbol}' in ${mod}`);
      const demo = demoOf(mod);
      out.scope = demo ? 'demo' : 'engine';
      out.demo = demo;
      const sub = /^src\/(\w+)\//.exec(mod || '');
      out.where = { module: mod, export: e.export || null, symbol: e.symbol || null, import: sub ? `@vibe/engine/${sub[1]}` : demo ? `../${mod.slice('samples/'.length)}` : null };
      // a demo listed as a user must import the name (or build a MapWorld when the entry comes through it)
      for (const d of out.usedBy) {
        if (!demoSrc[d]) { problems.push(`${e.id}: unknown demo '${d}'`); continue; }
        const via = e.via === 'MapWorld' ? /\bMapWorld\b/ : e.via === 'Atmosphere' ? /\b(Atmosphere|MapWorld)\b/ : null;
        if (via ? !via.test(demoSrc[d]) : !new RegExp(`\\b${name}\\b`).test(demoSrc[d])) problems.push(`${e.id}: demo '${d}' does not use ${via ? e.via : name}`);
      }
      if (!out.reusable && !e.reason) problems.push(`${e.id}: not reusable but no reason given`);
    }
    if (out.snippet) for (const b of checkSnippet(out.snippet)) problems.push(`${e.id}: snippet: ${b}`);
    if (out.reusable && !out.snippet) problems.push(`${e.id}: no snippet`);
    const m = (out.preview.mode || 'object') === 'object' ? measured[e.id] : null;
    if (m) {
      for (const k of ['triangles', 'animations', 'skinned', 'instances', 'meshes']) {
        if (m[k] == null || m[k] === 0 || out.facts[k] != null) continue;
        if (k === 'meshes' || k === 'instances') continue;
        if (k === 'skinned') { out.facts.skinned = true; continue; }
        out.facts[k] = m[k];
      }
    }
    const mode = out.preview.mode || 'object';
    out.preview3d = !!out.snippet && !['card', 'lut', 'map', 'flat'].includes(mode);
    if (!exists(`samples/public/${out.thumb}`)) problems.push(`${e.id}: thumbnail missing (${out.thumb}): run node tools/render-asset-thumbs.mjs --only=${e.id}`);
    for (const k of Object.keys(out.facts)) if (out.facts[k] === undefined || out.facts[k] === '') delete out.facts[k];
    entries.push(out);
  }

  // unique ids
  const seen = new Set();
  for (const e of entries) { if (seen.has(e.id)) problems.push(`duplicate id '${e.id}'`); seen.add(e.id); }

  // coverage of samples/public
  const covered = new Set();
  for (const e of entries) if (e.kind === 'file') { for (const f of e.where.files) covered.add(f); for (const f of e.where.manifests || []) covered.add(f); }
  for (const f of walk('samples/public')) {
    if (covered.has(f)) continue;
    if (/\/CREDITS\.md$/.test(f)) continue; // credits files are read by this tool, not assets
    if (reg.IGNORE.some((i) => (i.path.endsWith('/') ? f.startsWith(i.path) : f === i.path))) continue;
    problems.push(`not catalogued and not on the ignore list: ${f}`);
  }
  for (const i of reg.IGNORE) if (!i.reason) problems.push(`ignore entry without a reason: ${i.path}`);

  entries.sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) || (a.kind === b.kind ? 0 : a.kind === 'file' ? -1 : 1) || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id));

  const counts = { total: entries.length, byCategory: {}, byKind: { file: 0, code: 0 }, byScope: { engine: 0, demo: 0 }, notReusable: 0 };
  for (const e of entries) {
    counts.byCategory[e.category] = (counts.byCategory[e.category] || 0) + 1;
    counts.byKind[e.kind]++; counts.byScope[e.scope]++;
    if (!e.reusable) counts.notReusable++;
  }
  const sources = sourcesOf(entries);
  const catalog = {
    about: 'Every asset of the @vibe/engine repository: downloaded files under samples/public and assets made in code (engine package and demos). Generated by tools/catalog-assets.mjs from tools/asset-registry.mjs, the texture manifests and the CREDITS.md files; do not edit by hand. Snippets assume a THREE scene, renderer and camera, and are written for a page in samples/<name>/ (demo modules import as ../<demo>/<file>.js); a line "// every frame: ..." runs once per frame with dt and t (seconds).',
    demos: reg.DEMOS, categories: reg.CATEGORIES, counts, sources, ignored: reg.IGNORE, entries,
  };
  const json = `${JSON.stringify(catalog, null, 1)}\n`;
  return { catalog, json, markdown: markdown(catalog), problems };
}

function sourcesOf(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e.credit || !e.credit.source || e.credit.source === 'made for this repository') continue;
    const k = e.credit.source.replace(/,.*$/, '').replace(/ \(.*$/, '');
    const s = map.get(k) || { name: k, licences: new Set(), count: 0, url: '' };
    s.licences.add(e.credit.licence.replace(/\s*\(.*$/, ''));
    s.count++;
    if (!s.url) s.url = { 'Poly Haven': 'https://polyhaven.com', 'Quaternius via poly.pizza': 'https://poly.pizza', 'Khronos glTF Sample Assets': 'https://github.com/KhronosGroup/glTF-Sample-Assets' }[k] || (/OpenStreetMap/.test(k) ? 'https://www.openstreetmap.org/copyright' : e.credit.url);
    map.set(k, s);
  }
  return [...map.values()].map((s) => ({ name: s.name, url: s.url, licences: [...s.licences].sort(), entries: s.count })).sort((a, b) => b.entries - a.entries);
}

// ------------------------------------------------------------------------------------------------ markdown
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
function markdown(cat) {
  const L = [];
  L.push('# Asset catalogue', '');
  L.push('Generated by `tools/catalog-assets.mjs` from `tools/asset-registry.mjs`, the texture manifests and the `CREDITS.md` files; do not edit by hand. The same data, with every code snippet in full, is in [`samples/public/catalog/catalog.json`](../samples/public/catalog/catalog.json); the samples site shows it as the Asset library page (`samples/assets/`).', '');
  const c = cat.counts;
  L.push(`${c.total} entries: ${c.byKind.file} downloaded files, ${c.byKind.code} made in code; ${c.byScope.engine} in the engine package, ${c.byScope.demo} inside a demo (${c.notReusable} of them not reusable as is).`, '');
  L.push('Snippets assume a THREE `scene`, `renderer` and `camera`, and are written for a page in `samples/<name>/` (Vite: `import.meta.env.BASE_URL` is the site root; demo modules import as `../<demo>/<file>.js`). A line `// every frame: ...` is code to run once per frame (`dt`, `t` in seconds).', '');
  L.push('## Sources', '');
  L.push('| Source | Licences | Entries |', '|---|---|---|');
  for (const s of cat.sources) L.push(`| [${esc(s.name)}](${s.url}) | ${esc(s.licences.join(', '))} | ${s.entries} |`);
  L.push('', 'Everything else is made in code in this repository (MIT).', '');
  L.push('## Contents', '');
  for (const k of Object.keys(cat.categories)) if (c.byCategory[k]) L.push(`- [${cat.categories[k]}](#${slug(cat.categories[k])}) (${c.byCategory[k]})`);
  L.push('');
  for (const k of Object.keys(cat.categories)) {
    const list = cat.entries.filter((e) => e.category === k);
    if (!list.length) continue;
    L.push(`## ${cat.categories[k]}`, '');
    L.push('| | Asset | Where | Credit | Use |', '|---|---|---|---|---|');
    for (const e of list) {
      const thumb = `<img src="../samples/public/${e.thumb}" width="120" alt="">`;
      const where = e.kind === 'file'
        ? e.where.files.slice(0, 3).map((f) => `\`${f.replace('samples/public/', '')}\``).join('<br>') + (e.where.files.length > 3 ? `<br>+${e.where.files.length - 3} more` : '')
        : `\`${e.where.module}\`<br>${e.where.export ? `\`${e.where.export}\`` : `\`${e.where.symbol}\` (not exported)`}`;
      const scope = e.scope === 'engine' ? 'engine' : `demo: ${e.demo || e.usedBy.join(', ')}`;
      const credit = e.credit ? `${esc(e.credit.author)}, ${esc(e.credit.licence)}${e.credit.url ? ` ([source](${e.credit.url}))` : ''}` : 'made in code';
      let use;
      if (!e.reusable) use = `Not reusable as is: ${esc(e.reason)}`;
      else {
        const first = e.snippet.split('\n').find((l) => /\(/.test(l) && !/^\s*import\b/.test(l) && !/^\s*\/\//.test(l)) || e.snippet.split('\n')[0];
        use = `\`${esc(first.trim()).replace(/`/g, "'")}\``;
      }
      L.push(`| ${thumb} | **${esc(e.name)}**<br>${e.kind === 'file' ? 'file' : 'code'}, ${scope}<br><sub>\`${e.id}\`</sub> | ${where} | ${credit} | ${use} |`);
    }
    L.push('');
  }
  L.push('## Not catalogued', '');
  L.push('Files under `samples/public` that are not assets:', '');
  for (const i of cat.ignored) L.push(`- \`${i.path}\`: ${i.reason}`);
  L.push('- every `CREDITS.md`: the credits this catalogue reads', '');
  return `${L.join('\n')}\n`;
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');

// ------------------------------------------------------------------------------------------------ CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { json, markdown: md, problems, catalog } = await buildCatalog();
  let stale = [];
  if (check) {
    if (!exists(CATALOG_JSON) || read(CATALOG_JSON) !== json) stale.push(CATALOG_JSON);
    if (!exists(MARKDOWN) || read(MARKDOWN) !== md) stale.push(MARKDOWN);
  } else {
    fs.mkdirSync(path.dirname(abs(CATALOG_JSON)), { recursive: true });
    fs.writeFileSync(abs(CATALOG_JSON), json);
    fs.writeFileSync(abs(MARKDOWN), md);
  }
  const c = catalog.counts;
  console.log(`[catalog] ${c.total} entries (${c.byKind.file} files, ${c.byKind.code} made in code; engine ${c.byScope.engine}, demos ${c.byScope.demo}; not reusable ${c.notReusable})${check ? '' : ` -> ${CATALOG_JSON}, ${MARKDOWN}`}`);
  for (const s of stale) console.log(`[catalog] out of date: ${s} (run node tools/catalog-assets.mjs)`);
  for (const p of problems) console.log(`[catalog] problem: ${p}`);
  process.exit(problems.length || stale.length ? 1 : 0);
}
