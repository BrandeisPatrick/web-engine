// PoseInterpolator: render interpolation between fixed simulation steps, the "keep the previous pose, blend by alpha"
// boilerplate every fixed-step body needs. The Engine runs fixedUpdate at fixedHz and update(dt, alpha) once per frame
// with alpha = how far the frame is between the last two steps (0..1); drawing the body at the blend of its previous
// and current pose removes the judder of drawing it at whole steps.
//
//   const smooth = new PoseInterpolator(car);         // anything with .position (Vector3) and optionally .quaternion
//   engine.addSystem({
//     fixedUpdate(dt) { smooth.save(); car.step(dt, controls, physics); },   // save() BEFORE the step
//     update(dt, alpha) { smooth.apply(carMesh, alpha); },                   // position lerp + quaternion slerp
//   });
//   car.reset(...); smooth.snap();                     // after a teleport: no blend from the old place
//
// The source is read live (VehicleController, CharacterController, a DynamicsWorld pose you copy into an object, ...).
// `rotation: false` (or a source without a quaternion) leaves the target's rotation alone, e.g. a character whose
// facing the game turns itself. Allocation-free.
import * as THREE from 'three';

export class PoseInterpolator {
  /**
   * @param {{ position: THREE.Vector3, quaternion?: THREE.Quaternion }} source  the simulated body
   * @param {{ rotation?: boolean }} [o]  rotation (default true when the source has a quaternion): also slerp it
   */
  constructor(source, { rotation = true } = {}) {
    if (!source || !source.position) throw new TypeError('PoseInterpolator: the source needs a .position (Vector3)');
    this.source = source;
    this.rotation = rotation !== false && !!source.quaternion;
    /** Pose at the start of the last fixed step. */
    this.prevPosition = new THREE.Vector3().copy(source.position);
    this.prevQuaternion = new THREE.Quaternion();
    if (this.rotation) this.prevQuaternion.copy(source.quaternion);
  }

  /** Call at the start of every fixed step, before the body moves: the current pose becomes the previous one. */
  save() {
    this.prevPosition.copy(this.source.position);
    if (this.rotation) this.prevQuaternion.copy(this.source.quaternion);
    return this;
  }

  /** Forget the previous pose (after a teleport / reset), so the next frames do not blend from the old place. */
  snap() { return this.save(); }

  /**
   * Write the blended pose into `target` (an Object3D, or anything with position / quaternion).
   * @template {{ position: THREE.Vector3, quaternion: THREE.Quaternion }} T
   * @param {T} target
   * @param {number} alpha  engine alpha (update(dt, alpha)): 0 = previous step, 1 = current
   * @returns {T}
   */
  apply(target, alpha) {
    const a = alpha >= 0 ? (alpha <= 1 ? alpha : 1) : 0;
    target.position.lerpVectors(this.prevPosition, this.source.position, a);
    if (this.rotation) target.quaternion.slerpQuaternions(this.prevQuaternion, this.source.quaternion, a);
    return target;
  }
}
