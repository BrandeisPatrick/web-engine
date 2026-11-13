import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// Dev server / build for the samples: a multi-page app rooted at samples/ (index.html lists them; each sample is a
// folder with its own index.html, served at /<name>/). Samples import the engine as the package `@vibe/engine`;
// inside this repository that resolves to ./src (a game that installs the package gets it from node_modules).
// Every samples/<name>/index.html is a page: a new sample folder needs no registration here (list it on
// samples/index.html for people). `public` (static files), `shared` (modules) and `dev` (loose dev pages) are not
// samples; `assets` (the Asset library page) is built by the second pass below.
const NOT_SAMPLES = new Set(['public', 'shared', 'dev', 'assets']);
const SAMPLES = fs.readdirSync(here('./samples'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !NOT_SAMPLES.has(d.name) && fs.existsSync(here(`./samples/${d.name}/index.html`)))
  .map((d) => d.name).sort();
const input = { index: here('./samples/index.html') };
for (const s of SAMPLES) input[s] = here(`./samples/${s}/index.html`);
// The Asset library page (samples/assets/: the asset catalogue, with 3D previews that run engine and demo modules) is
// built by a second pass, `vite build --mode assets` (npm run build runs both): built together, its imports would make
// Rollup split the code the demos share into many small chunks, and the demos would load differently. Built apart,
// the demos' output is what it was without the page; the page gets its own chunks next to theirs.
const ASSET_PAGE = here('./samples/assets/index.html');

// BASE_PATH=/web-engine/ builds for GitHub Pages (a project site under a sub-path): the engine's and the samples'
// asset URLs go through import.meta.env.BASE_URL, so nothing else changes (`npm run deploy`, tools/deploy-pages.mjs).
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH || '/',
  root: here('./samples'),
  server: { port: 5190, strictPort: true, fs: { allow: [here('.')] } },
  // the second pass adds to dist/ (and leaves the public files the first one copied)
  ...(mode === 'assets' ? { publicDir: false } : {}),
  build: mode === 'assets'
    ? { target: 'es2022', outDir: here('./dist'), emptyOutDir: false, rollupOptions: { input: { assets: ASSET_PAGE } } }
    : { target: 'es2022', outDir: here('./dist'), emptyOutDir: true, rollupOptions: { input } },
  resolve: {
    alias: [
      { find: /^@vibe\/engine\/(core|physics|render|anim|input|camera|audio|ui|world)$/, replacement: `${here('./src')}/$1/index.js` },
      { find: /^@vibe\/engine$/, replacement: here('./src/index.js') },
    ],
  },
}));
