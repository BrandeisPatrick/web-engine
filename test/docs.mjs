// Docs drift check: the agent and reader docs must name only things that exist. Fails when, in README.md, ENGINE.md,
// AGENTS.md or docs/HOWTO.md (a file that does not exist yet is skipped):
//   - a relative Markdown link points at a missing file, or at a heading anchor the target does not have
//     (docs/DESIGN-NOTES.md is link-checked too);
//   - a repository path in inline code (`src/...`, `samples/...`, `test/...`, `tools/...`, `bench/...`, `docs/...`,
//     or a layer-relative one such as `render/GBuffer.js`) does not exist;
//   - a fenced code block imports a name from `@vibe/engine` or a layer entry point (`@vibe/engine/core`, ...) that
//     the entry point does not export;
//   - an old embedded-engine path (`engine/src/`, `engine/tools/`) appears;
//   - a count of test suites disagrees with test/all.mjs;
//   - a fenced code block marked `<!-- from: <file>#<id> -->` (on one of the two lines before it) differs from the
//     region `// #region howto:<id>` ... `// #endregion howto:<id>` of that file (dedented), or names a missing
//     file / region; and in docs/HOWTO.md every js block must carry such a mark (recipes are copies of code that runs:
//     the starters, test/howto/recipes.js run by test/howto.mjs and test/browser/howto.mjs, test/browser/check-page.mjs);
//   - the tier table in ENGINE.md "Quality tiers" (rows `group.key` | desktop | mobile) disagrees with QUALITY_TIERS in
//     src/core/Quality.js: a value differs, a setting has no row, or a row names no setting.
// Paths with placeholders (`<name>`, `*`, `{...}`, `${...}`) and generated folders (`types/`, `dist/`) are skipped.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const DOCS = ['README.md', 'ENGINE.md', 'AGENTS.md', 'docs/HOWTO.md'];
const LINK_ONLY = ['docs/DESIGN-NOTES.md'];
const LAYERS = ['core', 'physics', 'render', 'anim', 'input', 'camera', 'audio', 'ui', 'world'];
const TOP = ['src', 'samples', 'test', 'tools', 'bench', 'docs', '.github'];
// layer-relative paths resolve under these folders
const PATH_BASES = ['', 'src', 'src/render', 'src/physics'];
const PATH_HEADS = [...TOP, ...LAYERS, 'passes', 'dynamics'];

let failures = 0, checks = 0;
const fail = (file, line, msg) => { failures++; console.log(`FAIL  ${file}:${line}  ${msg}`); };

// --- entry point exports
const exportsOf = new Map();
async function exportsFor(spec) {
  if (exportsOf.has(spec)) return exportsOf.get(spec);
  const m = /^@vibe\/engine(?:\/(\w+))?$/.exec(spec);
  let names = null;
  if (m && (!m[1] || LAYERS.includes(m[1]))) {
    const file = join(root, 'src', m[1] || '', 'index.js');
    names = new Set(Object.keys(await import(pathToFileURL(file).href)));
  }
  exportsOf.set(spec, names);
  return names;
}

// --- suite count from test/all.mjs
const suiteCount = (readFileSync(join(root, 'test/all.mjs'), 'utf8').match(/\{\s*file:\s*'/g) || []).length;

// --- Markdown helpers
/** Lines with a flag for fenced code, so prose checks skip code and import checks read only code. */
function scan(text) {
  const out = []; let fence = null;
  text.split('\n').forEach((line, i) => {
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f) { fence = fence ? (line.trim().startsWith(fence) ? null : fence) : f[1]; out.push({ line, n: i + 1, code: false, fence: true }); return; }
    out.push({ line, n: i + 1, code: !!fence, fence: false });
  });
  return out;
}
/** GitHub heading anchors of a Markdown file. */
const anchorCache = new Map();
function anchors(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const set = new Set(), seen = new Map();
  for (const l of scan(readFileSync(file, 'utf8'))) {
    if (l.code || l.fence) continue;
    const h = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(l.line);
    if (!h) continue;
    const text = h[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    let slug = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/ /g, '-');
    const k = seen.get(slug) || 0; seen.set(slug, k + 1);
    if (k) slug += '-' + k;
    set.add(slug);
  }
  for (const m of readFileSync(file, 'utf8').matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) set.add(m[1]);
  anchorCache.set(file, set);
  return set;
}

function checkLinks(rel, lines) {
  const abs = join(root, rel);
  for (const { line, n, code } of lines) {
    if (code) continue;
    const prose = line.replace(/`[^`]*`/g, '');
    for (const m of prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\b(?:href|src)="([^"]+)"/g)) {
      const target = m[1] || m[2];
      if (/^(https?:|mailto:)/.test(target)) continue;
      checks++;
      const [p, frag] = target.split('#');
      const file = p ? normalize(join(dirname(abs), decodeURIComponent(p))) : abs;
      if (!existsSync(file)) { fail(rel, n, `link target missing: ${target}`); continue; }
      if (frag && /\.md$/.test(file) && !anchors(file).has(frag)) fail(rel, n, `no heading for anchor: ${target}`);
    }
  }
}

function resolveRepoPath(p) {
  p = p.replace(/[.,;:)]+$/, '');
  return PATH_BASES.some((b) => existsSync(join(root, b, p)));
}

function checkPaths(rel, lines) {
  for (const { line, n, code } of lines) {
    if (code) continue;
    for (const span of line.matchAll(/`([^`]+)`/g)) {
      for (const m of span[1].matchAll(/(?:^|[\s(,'"=:])([.\w-]+(?:\/[^\s`'",()]*)+)/g)) {
        const p = m[1];
        if (/[<>*{}$]/.test(p)) continue;
        const head = p.split('/')[0];
        if (!PATH_HEADS.includes(head)) continue;
        checks++;
        if (!resolveRepoPath(p)) fail(rel, n, `path does not exist: ${p}`);
      }
    }
  }
}

async function checkImports(rel, lines) {
  // join each fenced block, then read every `import { ... } from '...'`
  let block = [], start = 0;
  const blocks = [];
  for (const l of lines) {
    if (l.fence) { if (block.length) blocks.push({ text: block.join('\n'), start }); block = []; start = l.n + 1; continue; }
    if (l.code) block.push(l.line);
  }
  for (const b of blocks) {
    for (const m of b.text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](@vibe\/engine[^'"]*)['"]/g)) {
      const line = b.start + b.text.slice(0, m.index).split('\n').length - 1;
      const names = await exportsFor(m[2]);
      checks++;
      if (!names) { fail(rel, line, `unknown entry point ${m[2]}`); continue; }
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (!name) continue;
        checks++;
        if (!names.has(name)) fail(rel, line, `${name} is not exported by ${m[2]}`);
      }
    }
  }
}

function checkOldPathsAndCounts(rel, lines) {
  for (const { line, n } of lines) {
    checks++;
    const old = /(?<!@vibe\/)\bengine\/(src|tools)\//.exec(line); // `@vibe/engine/tools/*` is the package subpath
    if (old) fail(rel, n, `old embedded path ${old[0]} (use src/ or tools/)`);
    for (const m of line.matchAll(/\b(\d+)\s+(?:headless\s+)?(?:test\s+)?suites\b/g)) {
      checks++;
      if (+m[1] !== suiteCount) fail(rel, n, `"${m[0]}" but test/all.mjs lists ${suiteCount} suites`);
    }
  }
}

// --- snippets copied from marked regions of running code
const regionCache = new Map();
function region(file, id) {
  const abs = join(root, file);
  if (!existsSync(abs)) return { error: `snippet source missing: ${file}` };
  if (!regionCache.has(abs)) regionCache.set(abs, readFileSync(abs, 'utf8').split('\n'));
  const L = regionCache.get(abs);
  const s = L.findIndex((l) => l.trim() === `// #region howto:${id}`);
  const e = L.findIndex((l, i) => i > s && l.trim() === `// #endregion howto:${id}`);
  if (s < 0 || e < 0) return { error: `no region howto:${id} in ${file}` };
  const body = L.slice(s + 1, e).filter((l) => !/^\s*\/\/ #(end)?region howto:/.test(l));
  const ind = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length));
  return { text: body.map((l) => l.slice(ind).trimEnd()).join('\n').trim() };
}

function checkSnippets(rel, lines) {
  const requireMark = rel === 'docs/HOWTO.md';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.fence || l.code) continue;
    const open = /^\s*```(\w*)/.exec(l.line);
    if (!open || (i > 0 && lines[i - 1].code)) continue; // a closing fence
    let j = i + 1; const body = [];
    while (j < lines.length && !lines[j].fence) body.push(lines[j++].line);
    const mark = [lines[i - 1], lines[i - 2]].map((x) => x && /<!--\s*from:\s*([^#\s]+)#([\w-]+)\s*-->/.exec(x.line)).find(Boolean);
    i = j;
    if (!mark) {
      if (requireMark && /^(js|javascript|mjs)$/.test(open[1])) { checks++; fail(rel, l.n, 'js block without a <!-- from: file#region --> source mark'); }
      continue;
    }
    checks++;
    const r = region(mark[1], mark[2]);
    if (r.error) { fail(rel, l.n, r.error); continue; }
    const text = body.map((x) => x.trimEnd()).join('\n').trim();
    if (text !== r.text) {
      const a = text.split('\n'), b = r.text.split('\n');
      const k = a.findIndex((x, n) => x !== b[n]);
      fail(rel, l.n, `snippet differs from ${mark[1]}#${mark[2]} at its line ${k + 1}: doc "${(a[k] ?? '').trim()}" vs source "${(b[k] ?? '').trim()}"`);
    }
  }
}

// --- ENGINE.md "Quality tiers": the table of both tiers' values is QUALITY_TIERS
async function checkTierTable() {
  const rel = 'ENGINE.md';
  const { QUALITY_TIERS: T } = await import(pathToFileURL(join(root, 'src/core/Quality.js')).href);
  const lines = readFileSync(join(root, rel), 'utf8').split('\n');
  const start = lines.findIndex((l) => /^###\s+Quality tiers\s*$/.test(l));
  if (start < 0) { checks++; fail(rel, 0, 'no "### Quality tiers" section'); return; }
  const fmt = (v) => (v === undefined ? '-' : `\`${typeof v === 'string' ? `'${v}'` : String(v)}\``);
  const want = new Map();
  for (const g of Object.keys(T.desktop)) {
    if (g === 'label' || g === 'blurb') continue;
    for (const k of new Set([...Object.keys(T.desktop[g] || {}), ...Object.keys(T.mobile[g] || {})])) want.set(`${g}.${k}`, [fmt(T.desktop[g][k]), fmt(T.mobile[g][k])]);
  }
  const seen = new Set();
  for (let i = start + 1; i < lines.length && !/^#{1,3}\s/.test(lines[i]); i++) {
    const m = /^\|\s*`([\w]+\.[\w]+)`\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/.exec(lines[i]);
    if (!m) continue;
    checks++;
    const [, id, d, mo] = m, w = want.get(id);
    seen.add(id);
    if (!w) { fail(rel, i + 1, `tier table row \`${id}\` is not in QUALITY_TIERS`); continue; }
    if (d !== w[0] || mo !== w[1]) fail(rel, i + 1, `tier table \`${id}\`: doc ${d} | ${mo}, QUALITY_TIERS ${w[0]} | ${w[1]}`);
  }
  for (const id of want.keys()) { checks++; if (!seen.has(id)) fail(rel, start + 1, `tier table has no row for \`${id}\` (QUALITY_TIERS ${want.get(id).join(' | ')})`); }
}
await checkTierTable();

for (const rel of [...DOCS, ...LINK_ONLY]) {
  const abs = join(root, rel);
  if (!existsSync(abs)) { console.log(`skip  ${rel} (not there yet)`); continue; }
  const lines = scan(readFileSync(abs, 'utf8'));
  checkLinks(rel, lines);
  if (LINK_ONLY.includes(rel)) continue;
  checkPaths(rel, lines);
  await checkImports(rel, lines);
  checkOldPathsAndCounts(rel, lines);
  checkSnippets(rel, lines);
}

console.log(`docs: ${checks} checks, ${failures} failure${failures === 1 ? '' : 's'}`);
process.exit(failures ? 1 : 0);
