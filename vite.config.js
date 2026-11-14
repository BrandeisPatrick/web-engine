import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// Dev server / build for the samples: a multi-page app rooted at samples/ (index.html lists them; each sample is a
// folder with its own index.html, served at /<name>/). Samples import the engine as the package `@vibe/engine`;
// inside this repository that resolves to ./src (a game that installs the package gets it from node_modules).
// Every samples/<name>/index.html is a page: a new sample folder needs no registration here (list it on
// samples/index.html for people). `public` (static files), `shared` (modules) and `dev` (loose dev pages) are not samples.
const NOT_SAMPLES = new Set(['public', 'shared', 'dev']);
const SAMPLES = fs.readdirSync(here('./samples'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !NOT_SAMPLES.has(d.name) && fs.existsSync(here(`./samples/${d.name}/index.html`)))
  .map((d) => d.name).sort();
// Two build passes (npm run build runs both). The first builds the games; the second, `vite build --mode extras`, builds
// the pages that are not games: the Asset library (samples/assets/, whose 3D previews import engine and demo modules)
// and the starters (samples/starter-*). Built together with the games, their imports make Rollup split the code the
// demos share into many small chunks (each demo then loads 7 to 11 scripts instead of 4). Built apart, the demos'
// chunks are what they were without those pages; the extra pages get their own chunks next to theirs.
const isExtra = (name) => name === 'assets' || name.startsWith('starter-');
const input = { index: here('./samples/index.html') };
for (const s of SAMPLES) if (!isExtra(s)) input[s] = here(`./samples/${s}/index.html`);
const extraInput = {};
for (const s of SAMPLES) if (isExtra(s)) extraInput[s] = here(`./samples/${s}/index.html`);

// BASE_PATH=/web-engine/ builds for GitHub Pages (a project site under a sub-path): the engine's and the samples'
// asset URLs go through import.meta.env.BASE_URL, so nothing else changes (`npm run deploy`, tools/deploy-pages.mjs).
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH || '/',
  root: here('./samples'),
  server: { port: 5190, strictPort: true, fs: { allow: [here('.')] } },
  // the second pass adds to dist/ (and leaves the public files the first one copied)
  ...(mode === 'extras' ? { publicDir: false } : {}),
  build: mode === 'extras'
    ? { target: 'es2022', outDir: here('./dist'), emptyOutDir: false, rollupOptions: { input: extraInput } }
    : { target: 'es2022', outDir: here('./dist'), emptyOutDir: true, rollupOptions: { input } },
  resolve: {
    alias: [
      { find: /^@vibe\/engine\/(core|physics|render|anim|input|camera|audio|ui|world)$/, replacement: `${here('./src')}/$1/index.js` },
      { find: /^@vibe\/engine$/, replacement: here('./src/index.js') },
    ],
  },
}));
