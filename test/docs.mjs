// Docs drift check: the agent and reader docs must name only things that exist. Fails when, in README.md, ENGINE.md,
// AGENTS.md or docs/HOWTO.md (a file that does not exist yet is skipped):
//   - a relative Markdown link points at a missing file, or at a heading anchor the target does not have
//     (docs/DESIGN-NOTES.md is link-checked too);
//   - a repository path in inline code (`src/...`, `samples/...`, `test/...`, `tools/...`, `bench/...`, `docs/...`,
//     or a layer-relative one such as `render/GBuffer.js`) does not exist;
//   - a fenced code block imports a name from `@vibe/engine` or a layer entry point (`@vibe/engine/core`, ...) that
//     the entry point does not export;
//   - an old embedded-engine path (`engine/src/`, `engine/tools/`) appears;
//   - a count of test suites disagrees with test/all.mjs.
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

for (const rel of [...DOCS, ...LINK_ONLY]) {
  const abs = join(root, rel);
  if (!existsSync(abs)) { console.log(`skip  ${rel} (not there yet)`); continue; }
  const lines = scan(readFileSync(abs, 'utf8'));
  checkLinks(rel, lines);
  if (LINK_ONLY.includes(rel)) continue;
  checkPaths(rel, lines);
  await checkImports(rel, lines);
  checkOldPathsAndCounts(rel, lines);
}

console.log(`docs: ${checks} checks, ${failures} failure${failures === 1 ? '' : 's'}`);
process.exit(failures ? 1 : 0);
