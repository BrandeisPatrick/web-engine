// The asset catalogue (tools/catalog-assets.mjs) is in step with the repository: every file under samples/public is
// catalogued or ignored with a reason; every entry's files, module export and thumbnail exist; every downloaded asset
// has a licence, an author and a source link; snippets import only what exists; and the committed catalog.json and
// docs/ASSETS.md are exactly what the tool writes now. Fix a failure with `node tools/catalog-assets.mjs` (after
// editing tools/asset-registry.mjs), and `node tools/render-asset-thumbs.mjs --missing` for missing thumbnails.
import fs from 'node:fs';
import path from 'node:path';
import { buildCatalog, checkSnippet, moduleExports, imageSize, ROOT, CATALOG_JSON, MARKDOWN, THUMB_DIR } from '../tools/catalog-assets.mjs';

let failed = 0, n = 0;
const check = (name, ok, got) => { n++; if (!ok) { failed++; console.log(`FAIL  ${name}`, got ?? ''); } else console.log(`PASS  ${name}`); };
const abs = (p) => path.join(ROOT, p);

const { catalog, json, markdown, problems } = await buildCatalog();
const E = catalog.entries;
const group = (re) => problems.filter((p) => re.test(p));

check('every file under samples/public is catalogued or on the ignore list', !group(/not catalogued/).length, group(/not catalogued/));
check('the ignore list gives a reason for each path', catalog.ignored.every((i) => i.reason && i.reason.length > 10));
check('every entry\'s files exist', !group(/file missing/).length, group(/file missing/));
check('every code entry\'s module exists and exports its name', !group(/module missing|does not export|no function/).length, group(/module missing|does not export|no function/));
check('every demo listed as a user really uses the asset', !group(/does not use/).length, group(/does not use/));
check('every downloaded asset has a source, author, licence and link', E.filter((e) => e.kind === 'file').every((e) => e.credit && e.credit.source && e.credit.author && e.credit.licence && (e.credit.url || e.credit.source === 'made for this repository')) && !group(/credits|no (source|author|licence|url)|is not in/).length,
  [...group(/credits|no (source|author|licence|url)|is not in/), ...E.filter((e) => e.kind === 'file' && !(e.credit && e.credit.licence)).map((e) => e.id)]);
check('every snippet imports only modules and names that exist', !group(/snippet/).length, group(/snippet/));
check('every reusable entry has a snippet; every other one a reason', E.every((e) => (e.reusable ? !!e.snippet : !!e.reason)));
check('ids are unique and categories known', !group(/duplicate id|unknown category/).length, group(/duplicate id|unknown category/));
check('every entry has its thumbnail', !group(/thumbnail missing/).length, group(/thumbnail missing/).slice(0, 10));
check('no other problems', !problems.length, problems.slice(0, 20));

// thumbnails: 480 x 320 JPEGs, small, nothing stale in the folder
const thumbs = fs.readdirSync(abs(THUMB_DIR));
const sizes = thumbs.map((f) => fs.statSync(abs(`${THUMB_DIR}/${f}`)).size), total = sizes.reduce((a, b) => a + b, 0);
const ids = new Set(E.map((e) => `${e.id}.jpg`));
check('no thumbnail without an entry', thumbs.every((f) => ids.has(f)), thumbs.filter((f) => !ids.has(f)));
check('thumbnails are 480 x 320 JPEGs', thumbs.every((f) => { const d = imageSize(`${THUMB_DIR}/${f}`); return f.endsWith('.jpg') && d && d.w === 480 && d.h === 320; }));
check(`thumbnails total ${(total / 1048576).toFixed(2)} MB (< 3 MB), each < 80 KB`, total < 3 * 1048576 && sizes.every((s) => s < 80 * 1024));

// the generated files are current
check(`${CATALOG_JSON} is what the tool writes now`, fs.existsSync(abs(CATALOG_JSON)) && fs.readFileSync(abs(CATALOG_JSON), 'utf8') === json);
check(`${MARKDOWN} is what the tool writes now`, fs.existsSync(abs(MARKDOWN)) && fs.readFileSync(abs(MARKDOWN), 'utf8') === markdown);
check('counts add up', catalog.counts.total === E.length && catalog.counts.byKind.file + catalog.counts.byKind.code === E.length && catalog.counts.byScope.engine + catalog.counts.byScope.demo === E.length);

// the checker itself catches what it should
check('checkSnippet: a name a module does not export', checkSnippet("import { NoSuchThing } from '@vibe/engine/world';").length === 1);
check('checkSnippet: an unknown module', checkSnippet("import { x } from 'left-pad';").length === 1);
check('checkSnippet: a demo entry point that boots its demo', checkSnippet("import { boot } from '../halloween/main.js';").some((s) => /starts its demo/.test(s)));
check('checkSnippet: a correct snippet passes', checkSnippet("import * as THREE from 'three';\nimport { Atmosphere } from '@vibe/engine/render';\nimport { buildKid } from '../halloween/kid.js';").length === 0);
check('moduleExports follows export * and export { a as b }', moduleExports('src/index.js').has('makeVehicleGeometry') && moduleExports('src/render/index.js').has('Noise'));

console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
