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
    optimizeDeps: { include: ['three', 'three/webgpu', 'three/tsl'] },
  };
};
