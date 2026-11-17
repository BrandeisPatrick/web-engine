// Camera layer: rig base + collision utilities, vehicle chase rig, third- / first-person character rigs, orbit and
// free-fly debug rigs. Reactive options: rig.addTrauma(x) on every rig, ChaseRig { feel: 'road' } (ROAD_FEEL),
// ThirdPersonRig / FirstPersonRig { landingDip, sprintFov } and rig.land(speed).
export { CameraRig, CameraCollision, LandingSpring, treeCanopy } from './CameraRig.js';
export { ChaseRig, ChaseRig as ChaseCamera, defaultChaseModes, ROAD_FEEL } from './ChaseRig.js';
export { OrbitRig } from './OrbitRig.js';
export { FreeFlyRig, freeFlyActions } from './FreeFlyRig.js';
export { ThirdPersonRig } from './ThirdPersonRig.js';
export { FirstPersonRig, SprintFov } from './FirstPersonRig.js';
import { clamp, smooth01, damp, damp60, wrapPi, springStep } from './CameraRig.js';
/** Small math helpers used by the rigs (namespaced to avoid clashing with other layers). */
export const CameraMath = Object.freeze({ clamp, smooth01, damp, damp60, wrapPi, springStep });
/** @typedef {import('./ChaseRig.js').ChaseTargetState} ChaseTargetState  what ChaseRig reads from its target's state */
/** @typedef {import('./ThirdPersonRig.js').ThirdPersonTargetState} ThirdPersonTargetState  what ThirdPersonRig reads */
/** @typedef {import('./ChaseRig.js').ChaseFeel} ChaseFeel  ChaseRig's road-feel parameters (ROAD_FEEL) */
