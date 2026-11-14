// Recipe sources for docs/HOWTO.md: each marked region below is copied verbatim into a recipe, and
// test/docs.mjs fails when the copy and the region differ. The regions run:
//   - in Node by test/howto.mjs (npm test): vanSpec, poseInterpolator, physicsBodies, smallTrack;
//   - in headless Chrome by test/browser/howto.mjs (on the starter-drive page, real WebGL): clusteredLights,
//     lampsByTier, headlights, gpuParticles, vehicleSound, getInOut.
// Each function takes the objects a game already has (engine, scene, camera, renderer, postfx, ...) and returns what
// the tests check. Imports are the public entry points only, as a game would write them.
import * as THREE from 'three';
import { PoseInterpolator } from '@vibe/engine/core';
import {
  PhysicsWorld, VehicleController, ROAD_CAR_SPEC, DynamicsWorld, attachToPhysicsWorld, boxShape, sphereShape,
} from '@vibe/engine/physics';
import { ClusteredLights, installClusteredChunks, syncClustered, NearestLights, GpuParticleSystem } from '@vibe/engine/render';
import { VehicleAudio } from '@vibe/engine/audio';
import { CharacterInput, CHARACTER_ACTIONS, VehicleInput, VEHICLE_ACTIONS, VEHICLE_TOUCH_LAYOUT } from '@vibe/engine/input';
import { ChaseRig, ThirdPersonRig } from '@vibe/engine/camera';

/** A van from the road car: heavier, less power, a lower top speed (the VehicleController JSDoc's example). */
export function vanSpec() {
  // #region howto:van-spec
  const van = new VehicleController({ ...ROAD_CAR_SPEC, mass: 2200, motorPower: 90e3, vMax: 42 }); // kg, W, m/s (151 km/h)
  // #endregion howto:van-spec
  return van;
}

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
export function clusteredLights({ scene, camera, postfx, engine, lamps, streetLamps }) {
  // #region howto:clustered-lights
  installClusteredChunks();                                  // 1. once per page, before materials compile
  const cl = new ClusteredLights({ maxLights: 256 });        // 2. the light list: setLight(index, x, y, z, range, r, g, b, decay)
  lamps.forEach(([x, y, z], i) => cl.setLight(i, x, y, z, 14, 6, 4.2, 2.4, 1.5));      // garden lamp: 14 m, warm x 6, decay 1.5
  streetLamps.forEach(([x, y, z], i) => cl.setLight(lamps.length + i, x, y, z, 30, 150, 108, 63, 2)); // street lamp, 6-9 m up
  syncClustered(scene, true);                                // 3. lit materials use it (also ones added later)
  postfx.onInternalResize = (w, h) => cl.setSize(w, h);      // 4. the scene target's size in pixels...
  postfx.onInternalResize(postfx.internalWidth, postfx.internalHeight); // ...now and on every resize
  engine.addSystem({ lateUpdate() { cl.update(camera); } }, 'lights'); // 5. per frame, after the camera moved
  // #endregion howto:clustered-lights
  return cl;
}

/** The lamps of a level on either tier: clustered lights on desktop, a pool of real lights on the nearest lamps on mobile. */
export function lampsByTier({ S, scene, camera, postfx, engine, lamps }) {
  // #region howto:lamps-tier
  let cl = null;
  if (S.lights.clustered) {                                  // desktop tier: every lamp lights (the five calls above)
    installClusteredChunks();
    cl = new ClusteredLights({ maxLights: 256 });
    lamps.forEach(([x, y, z], i) => cl.setLight(i, x, y, z, 30, 150, 108, 63, 2));
    syncClustered(scene, true);
    postfx.onInternalResize = (w, h) => cl.setSize(w, h);
    postfx.onInternalResize(postfx.internalWidth, postfx.internalHeight);
    engine.addSystem({ lateUpdate() { cl.update(camera); } }, 'lights');
  } else {                                                   // mobile tier: real lights on the 4 lamps nearest the camera
    const pool = new NearestLights({ count: 4, color: 0xffb06b, distance: 30, decay: 2, parent: scene });
    pool.setPositions(lamps);
    engine.addSystem({ lateUpdate(dt) { pool.update(dt, { position: camera.position }, 150); } }, 'lights');
  }
  // #endregion howto:lamps-tier
  return cl;
}

/**
 * Headlights on a VehicleController's drawn body (front = -Z): two clustered spots when the page has ClusteredLights
 * (`cl`, light indices `slot` and `slot + 1`), else one real SpotLight. Add it after the system that poses `body`.
 */
export function headlights({ engine, body, SPEC, cl, slot }) {
  let spot = null, system = null;
  // #region howto:headlights
  const front = -SPEC.length / 2 - 0.05;                     // just ahead of the bumper (the body faces -Z)
  if (cl) {                                                  // desktop tier: two clustered spots, re-aimed every frame
    const lamp = new THREE.Vector3(), aim = new THREE.Vector3();
    system = engine.addSystem({
      update() {                                             // runs after the system that poses `body`
        body.updateMatrixWorld();
        for (const side of [-1, 1]) {
          lamp.set(side * (SPEC.width / 2 - 0.3), 0.65, front).applyMatrix4(body.matrixWorld);
          aim.set(side * 0.05, -0.06, -1).transformDirection(body.matrixWorld); // ahead, a touch outwards and down
          // setSpot(index, x, y, z, range, r, g, b, decay, direction x, y, z, cos inner, cos outer)
          cl.setSpot(slot + (side > 0 ? 1 : 0), lamp.x, lamp.y, lamp.z, 60, 90, 85, 77, 2, aim.x, aim.y, aim.z, Math.cos(0.32), Math.cos(0.5));
        }
      },
    }, 'headlights');
  } else {                                                   // mobile tier: one real SpotLight between the lamps
    spot = new THREE.SpotLight(0xfff0dc, 520, 70, 0.5, 0.45, 1.6); // colour, intensity, distance m, angle rad, penumbra, decay
    spot.position.set(0, 0.62, front);
    spot.target.position.set(0, -0.6, front - 20);           // 20 m ahead, aimed a little down
    body.add(spot, spot.target);                             // the target too, or the beam points at the world origin
  }
  // #endregion howto:headlights
  return { spot, system };
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

/**
 * Get in and out of a vehicle: one car (`car`, drawn as `carBody`) and one walker (`cc`, drawn as `player`), two inputs and
 * two camera rigs, one of each active at a time. Returns live state through functions (Object.assign copies values).
 */
export function getInOut({ engine, camera, renderer, physics, car, carBody, cc, player }) {
  // #region howto:get-in-out
  // one key both ways: CharacterInput's `interact` (E / F, pad X, the USE touch button), made alwaysOn so it still fires
  // while the walking controls are off; the car's touch layout gets an OUT button bound to a `getOut` action
  const walkInput = new CharacterInput({ element: renderer.domElement, actions: { ...CHARACTER_ACTIONS, interact: { ...CHARACTER_ACTIONS.interact, alwaysOn: true } } });
  const carInput = new VehicleInput(renderer.domElement, {
    actions: { ...VEHICLE_ACTIONS, getOut: { type: 'button', bindings: [{ virtual: 'out' }] } },
    touchLayout: [...VEHICLE_TOUCH_LAYOUT, { type: 'button', id: 'out', label: 'OUT', side: 'right', x: 36, y: 238, size: 46, top: true, fontSize: 10 }],
  });
  const touch = !!carInput.touch;                            // touch: 'auto' built the car's overlay: a touch-first device
  const carState = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0 }, walkState = { facing: 0 };
  const chase = new ChaseRig(camera, renderer.domElement, { physics, canopyFromCollider: null, flightFraming: false });
  const orbit = new ThirdPersonRig(camera, renderer.domElement, { physics, distance: 4.2, height: 1.6, active: false });
  chase.setTarget(carBody, () => carState); orbit.setTarget(player, () => walkState);
  const carSmooth = new PoseInterpolator(car), walkSmooth = new PoseInterpolator(cc);
  let driving = true;
  const setDriving = (on) => {
    driving = on;
    carInput.enabled = on; walkInput.enabled = !on;          // the idle one reads 0 (interact stays alive: alwaysOn)
    player.visible = !on;
    if (touch) { carInput.enableTouch(on); walkInput.enableTouch(!on); } // one on-screen set at a time
    if (!on) {                                               // out on the car's left side, facing where it faces
      const h = car.heading, x = car.position.x - 2.2 * Math.cos(h), z = car.position.z + 2.2 * Math.sin(h);
      cc.teleport(x, physics.getGroundHeight(x, z), z); walkSmooth.snap(); walkSmooth.apply(player, 1);
      walkState.facing = h; orbit.yaw = h;
    }
    if (on) { orbit.deactivate(); chase.activate(); } else { chase.deactivate(); orbit.activate(); } // activate() snaps
  };
  setDriving(true);
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false }, move = { x: 0, z: 0 };
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  engine.addSystem({
    earlyUpdate(dt) {
      carInput.update(dt); walkInput.update(dt);
      const use = walkInput.controls.interact || carInput.map.justPressed('getOut');
      if (use && driving && car.speed < 1.5) setDriving(false);                            // stop first
      else if (use && !driving && cc.position.distanceTo(car.position) < 4) setDriving(true); // next to the car
      controls.throttle = carInput.throttle; controls.steer = carInput.steer;
      controls.brake = carInput.brake; controls.handbrake = !driving || carInput.handbrake; // parked: handbrake only
                                                                // (brake at a standstill is reverse)
      const c = walkInput.controls;
      orbit.turn(-c.lookX, -c.lookY); orbit.getForward(fwd); orbit.getRight(right);
      move.x = right.x * c.moveX + fwd.x * c.moveY; move.z = right.z * c.moveX + fwd.z * c.moveY;
    },
    fixedUpdate(dt) {
      carSmooth.save(); car.step(dt, controls, physics);
      if (!driving) { walkSmooth.save(); cc.step(dt, move.x, move.z, walkInput.controls.jumpHeld, walkInput.controls.sprint, physics); }
    },
    update(dt, alpha) {
      carSmooth.apply(carBody, alpha);
      carState.speedKmh = car.speed * 3.6; carState.grounded = car.grounded; carState.wheelSlip = car.wheelSlip;
      if (!driving) {
        walkSmooth.apply(player, alpha);
        if (move.x * move.x + move.z * move.z > 0.01) walkState.facing = Math.atan2(-move.x, -move.z);
        player.rotation.y = walkState.facing;
      }
      chase.update(dt); orbit.update(dt);                    // an inactive rig does nothing
    },
  }, 'get-in-out');
  // #endregion howto:get-in-out
  return { walkInput, carInput, isDriving: () => driving };
}
