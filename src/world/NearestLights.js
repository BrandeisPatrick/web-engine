// Moved to the render layer (it depends on three.js only): render/NearestLights.js. Re-exported here so
// `import { NearestLights } from '@vibe/engine/world'` and deep imports of this file keep working.
export { NearestLights } from '../render/NearestLights.js';
