// The lab's dev server (`npm run lab`): the repository's Vite config with the repository root as the web root, so the
// lab pages under lab/ and the samples under samples/ are both served (/lab/webgpu/, /samples/nyc-night/), with the
// samples' public files (/nyc/...) and the @vibe/engine aliases. Never built or deployed: vite.config.js builds samples/.
import { fileURLToPath } from 'node:url';
import base from '../vite.config.js';

const root = fileURLToPath(new URL('..', import.meta.url));
export default (env) => {
  const c = base(env);
  return {
    ...c, root, publicDir: `${root}samples/public`,
    server: { ...c.server, port: 5192 },
    cacheDir: `${root}lab/.cache`, // its own pre-bundle cache (git-ignored): another dev server re-optimising node_modules/.vite cannot pull it away mid-run
    // every three entry the lab imports, pre-bundled at start: one found later makes Vite re-optimise and the page's
    // pending dynamic imports fail
    optimizeDeps: { include: ['three', 'three/webgpu', 'three/tsl', ...['tsl/display/GTAONode', 'tsl/display/SSRNode', 'tsl/display/TRAANode', 'tsl/display/BloomNode'].map((m) => `three/addons/${m}.js`)] },
  };
};
