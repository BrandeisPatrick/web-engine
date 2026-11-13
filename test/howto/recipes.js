// Recipe sources for docs/HOWTO.md: each marked region below is copied verbatim into a recipe, and
// test/docs.mjs fails when the copy and the region differ. The regions run:
//   - in Node by test/howto.mjs (npm test): poseInterpolator, physicsBodies, smallTrack;
//   - in headless Chrome by test/browser/howto.mjs (on the starter-drive page, real WebGL): clusteredLights,
//     gpuParticles, vehicleSound.
// Each function takes the objects a game already has (engine, scene, camera, renderer, postfx, ...) and returns what
// the tests check. Imports are the public entry points only, as a game would write them.
import * as THREE from 'three';
import { PoseInterpolator } from '@vibe/engine/core';
import {
  PhysicsWorld, VehicleController, ROAD_CAR_SPEC, DynamicsWorld, attachToPhysicsWorld, boxShape, sphereShape,
} from '@vibe/engine/physics';
import { ClusteredLights, installClusteredChunks, syncClustered, GpuParticleSystem } from '@vibe/engine/render';
import { VehicleAudio } from '@vibe/engine/audio';

/** Smooth rendering between fixed steps. `engine` needs only addSystem; `carMesh` is what you draw. */
export function poseInterpolator({ engine, physics, carMesh }) {
  const car = new VehicleController(ROAD_CAR_SPEC);
  const controls = { throttle: 1, brake: 0, steer: 0, handbrake: false };
  // #region howto:pose-interpolator
  const smooth = new PoseInterpolator(car);   // anything with .position and (optionally) .quaternion
  engine.addSystem({
    fixedUpdate(dt) {
      smooth.save();                           // BEFORE the step: the pose to blend from
      car.step(dt, controls, physics);
    },
    update(dt, alpha) {
      smooth.apply(carMesh, alpha);            // position lerp + quaternion slerp between the last two steps
    },
  });
  car.reset(new THREE.Vector3(0, 0, 0), 0, physics); smooth.snap(); // after a teleport: no blend from the old place
  // #endregion howto:pose-interpolator
  return { car, smooth };
}

/** Static colliders and loose (dynamic) boxes. */
export function physicsBodies() {
  // #region howto:physics-bodies
  const physics = new PhysicsWorld();                                    // flat ground at y = 0
  physics.addStaticBox({ center: [0, 1, -10], size: [8, 2, 1] });        // a wall, like BoxGeometry(8, 2, 1)
  physics.addStaticBox({ min: [4, 0, -4], max: [6, 0.5, 4], kind: 'kerb' });

  const dyn = new DynamicsWorld({ physics, substeps: 4 });               // loose bodies; the static world is `physics`
  attachToPhysicsWorld(dyn, physics);                                    // controllers and cars now collide with them
  const crate = dyn.addBody({ shape: boxShape(0.4, 0.4, 0.4), position: [0, 3, -5], mass: 20 }); // HALF extents
  const ball = dyn.addBody({ shape: sphereShape(0.3), position: [1, 5, -5], restitution: 0.5 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8));      // full size = 2 x the half extents

  // per fixed step, then copy the pose onto the mesh
  const step = (dt) => { dyn.step(dt); dyn.getPose(crate, mesh.position, mesh.quaternion); };
  // #endregion howto:physics-bodies
  return { physics, dyn, crate, ball, mesh, step };
}

/** A small track without the world layer: hills from a function, a road with more grip than the grass beside it. */
export function smallTrack() {
  // #region howto:small-track
  const hills = (x, z) => 3 * Math.sin(x / 60) * Math.cos(z / 80);       // metres; any (x, z, y) => height works
  const physics = new PhysicsWorld({ heightfield: hills });
  physics.setSurfaceProvider((x, z, out) => {                            // per wheel, per step
    const onRoad = Math.abs(x) < 5;                                      // a straight road along z, 10 m wide
    out.mu = onRoad ? 1 : 0.6; out.crr = onRoad ? 1 : 4; out.tag = onRoad ? 'asphalt' : 'grass';
    return out;
  });
  const car = new VehicleController(ROAD_CAR_SPEC);
  car.reset(new THREE.Vector3(0, hills(0, 0), 0), 0, physics);           // heading 0 faces -Z, down the road

  // the ground mesh: a plane with the same heights, so what you see is what the car drives on
  const ground = new THREE.PlaneGeometry(400, 400, 100, 100).rotateX(-Math.PI / 2);
  const p = ground.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hills(p.getX(i), p.getZ(i)));
  ground.computeVertexNormals();
  // #endregion howto:small-track
  return { physics, car, hills, ground };
}

/** Clustered lights without MapWorld: every lamp lights the scene, at a per-pixel cost that depends on how many reach it. */
export function clusteredLights({ scene, camera, postfx, engine, lamps }) {
  // #region howto:clustered-lights
  installClusteredChunks();                                  // 1. once per page, before materials compile
  const cl = new ClusteredLights({ maxLights: 256 });        // 2. the light list
  lamps.forEach(([x, y, z], i) => cl.setLight(i, x, y, z, 14, 6, 4.2, 2.4, 1.5)); // range m, colour x intensity, decay
  syncClustered(scene, true);                                // 3. lit materials use it (also ones added later)
  postfx.onInternalResize = (w, h) => cl.setSize(w, h);      // 4. the scene target's size in pixels...
  postfx.onInternalResize(postfx.internalWidth, postfx.internalHeight); // ...now and on every resize
  engine.addSystem({ lateUpdate() { cl.update(camera); } }, 'lights'); // 5. per frame, after the camera moved
  // #endregion howto:clustered-lights
  return cl;
}

/** GPU particles: tens of thousands of sprites, simulated on the GPU. */
export function gpuParticles({ renderer, scene, camera, engine, atmosphere }) {
  // #region howto:gpu-particles
  if (!GpuParticleSystem.isSupported(renderer)) return null; // WebGL2 + float render targets; else use ParticleSystem
  const dust = new GpuParticleSystem(renderer, { max: 16384, blending: 'normal', drag: 0.25, lit: true, sun: atmosphere });
  scene.add(dust.mesh);
  const p = { x: 0, y: 0.2, z: -6, vx: 0, vy: 1.5, vz: 0, life: 2, size0: 0.3, size1: 1.2, alpha: 0.5, r: 0.8, g: 0.75, b: 0.65 };
  engine.addSystem({
    update(dt) {
      for (let i = 0; i < 20; i++) {                         // reuse one params object: no allocation per spawn
        p.vx = (Math.random() - 0.5) * 2; p.vz = (Math.random() - 0.5) * 2;
        dust.emit(p);
      }
      dust.update(dt, camera);                               // after the camera moved
    },
  }, 'dust');
  // #endregion howto:gpu-particles
  return dust;
}

/** Engine sound for a car: the engine's electric-motor synth, driven by the car's state. */
export function vehicleSound({ car, controls, engine }) {
  // #region howto:vehicle-sound
  const audio = new VehicleAudio({ volume: 0.6, ambience: false });
  addEventListener('keydown', () => audio.start(), { once: true });  // browsers start audio only in a gesture
  const sound = { speedKmh: 0, rpmLike: 0, thrust: 0, grounded: true, mode: 'ground', wheelSlip: 0 };
  engine.addSystem({
    update(dt) {
      sound.speedKmh = Math.abs(car.forwardSpeed) * 3.6;
      sound.rpmLike = controls.throttle;                    // motor load 0..1
      sound.grounded = car.grounded; sound.wheelSlip = car.wheelSlip;
      audio.update(dt, sound);
    },
  }, 'car-sound');
  // #endregion howto:vehicle-sound
  return { audio, sound };
}
