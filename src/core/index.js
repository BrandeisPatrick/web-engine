export { Engine } from './Engine.js';
export { Profiler, ProfilerOverlay } from './Profiler.js';
export { Assets } from './Assets.js';
export { Events } from './Events.js';
export { Clock } from './Clock.js';
export { Entity, EntitySystem } from './Entity.js';
// render interpolation between fixed steps: save() before each step, apply(object3d, alpha) per frame
export { PoseInterpolator } from './PoseInterpolator.js';
// deterministic math for simulation code (IEEE-exact: + - * / sqrt only); mulberry32 / clamp live under MathDet
// to avoid clashing with the render and world layers' exports
export { hashU32, hashF64, hashF64Array, detAtan, detAtan2, detAsin, detAcos, detSqrt } from './mathDet.js';
export * as MathDet from './mathDet.js';
// browser measurement harness (window.__sample): fixed poses, GPU-synced bench, captures, diffs
export { createBenchHarness, readBenchParams, lookStats, LOOK_HUES } from './Bench.js';
// quality tiers (desktop / mobile): presets, device recommendation, stored choice
export { QUALITY_TIERS, TIER_IDS, QUALITY_STORAGE_KEY, tierSettings, defineTier, recommendTier, storedTier, storeTier, resolveQuality } from './Quality.js';
/** @typedef {import('./Quality.js').TierSettings} TierSettings  one quality tier's settings (resolveQuality().settings) */
/** @typedef {import('./Quality.js').QualityChoice} QualityChoice  resolveQuality's result */
