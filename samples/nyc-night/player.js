// The walker: the CC0 Quaternius 'Business Man' (samples/public/nyc/models/BusinessMan.glb: dark suit, long trousers) on a CharacterController, driven per fixed step from
// the camera-relative intent, drawn per frame at the interpolated pose; an AnimationController with an idle / walk /
// run 1D blend tree on the horizontal speed and a one-shot jump. The approach follows the old character sample
// (main branch, samples/character): Motor (fixed step + interpolation + step-up smoothing), Animator, Facing.
// The model gets a cool rim term in its materials (emissive fresnel), so it reads against the dark street without
// a real light (cheap on both tiers). Without the model a capsule figure stands in.
import * as THREE from 'three';
import { AnimationController } from '@vibe/engine/anim';
import { cloneCharacter } from './pedestrians.js';

const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const ROLES = [['Idle', 'idle'], ['Walking', 'walk'], ['Running', 'run'], ['Jump', 'jump']];
// Quaternius names end in _Walk / _Run / _Jump (and Man_RunningJump also contains 'run'): prefer the suffix match

function pickClip(src, name, key) {
  const lc = (c) => c.name.toLowerCase();
  const hit = src.find((c) => c.name === name) || src.find((c) => lc(c).endsWith(`_${key}`) || lc(c).endsWith(`|${key}`)) || src.find((c) => lc(c).includes(key));
  // no jump clip (Quaternius Business Man): the run cycle carries the jump
  return hit || (key === 'jump' ? pickClip(src, 'Running', 'run') : null);
}

/** Rim / fill on the model's materials: emissive += rimColor * fresnel^3 (+ a faint wrap fill). */
function addRim(mat, U) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimK;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float fr = 1.0 - clamp(dot(normalize(vViewPosition) * -1.0, normal), 0.0, 1.0);
  totalEmissiveRadiance += uRimColor * uRimK * (pow(fr, 3.0) + 0.06) * diffuseColor.rgb;
}`);
  };
  mat.customProgramCacheKey = () => 'nyc-rim-1';
  mat.needsUpdate = true;
}

/** Map the loaded glTF ({ scene, animations, instantiate }) to { root, clips, headBone }, `height` tall, feet at 0. */
export function makeCharacter(gltf, { height = 1.75, rim = { color: [0.55, 0.7, 1.0], k: 0.9 }, recolour = null } = {}) {
  const U = { uRimColor: { value: new THREE.Color(...rim.color) }, uRimK: { value: rim.k } };
  let model = null;
  if (gltf && recolour) model = cloneCharacter(gltf, height, recolour).model; // flat materials baked to vertex colours
  else if (gltf) {
    model = typeof gltf.instantiate === 'function' ? gltf.instantiate() : null;
    if (model && !model.isObject3D) model = model.scene || null;
    if (!model) model = gltf.scene || null;
  }
  const clips = [];
  if (model) {
    const src = gltf.animations || [];
    for (const [name, key] of ROLES) {
      const c = pickClip(src, name, key) || pickClip(src, 'Idle', 'idle') || src[0];
      if (!c) continue;
      const m = c.name === name ? c : c.clone(); m.name = name; clips.push(m);
    }
  } else {
    // fallback figure: a capsule body + head, no clips
    model = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0x8090a0, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 6, 12), m); body.position.y = 0.75;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), m); head.position.y = 1.5;
    model.add(body, head);
  }
  const mats = new Set();
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (o.isSkinnedMesh) o.frustumCulled = false;
    for (const mm of Array.isArray(o.material) ? o.material : [o.material]) mats.add(mm);
  });
  for (const mm of mats) addRim(mm, U);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.y - box.min.y, s = h > 1e-6 ? height / h : 1;
  const root = new THREE.Group(); root.name = 'character';
  const fit = new THREE.Group(); fit.scale.setScalar(s);
  fit.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
  fit.add(model); root.add(fit);
  let head = null;
  model.traverse((o) => { if (!head && o.isBone && /head/i.test(o.name) && !/_end$/i.test(o.name)) head = o; });
  return { root, clips, headBone: head, rim: U };
}

/**
 * Player: entity (Group) + controller + animation. update order per frame: input -> intent; fixedUpdate(dt) steps the
 * controller; update(dt, alpha) interpolates and animates.
 */
export class Player {
  constructor({ scene, cc, physics, character }) {
    this.cc = cc; this.physics = physics;
    this.intent = { moveX: 0, moveZ: 0, jump: false, sprint: false };
    this.state = { facing: 0, speed: 0, grounded: true, velocity: cc.velocity }; // read by the camera rigs
    this.entity = new THREE.Group(); this.entity.name = 'player';
    this.view = new THREE.Group(); this.view.rotation.y = Math.PI; // models face +Z, the entity's forward is -Z
    this.view.add(character.root); this.entity.add(this.view);
    scene.add(this.entity);
    this.char = character;
    this.prev = new THREE.Vector3().copy(cc.position); this.cur = new THREE.Vector3().copy(cc.position);
    this.yOff = 0; this.jumped = false; this.landed = false;
    this.firstPerson = false; this.fpRig = null; this._fp = false;
    this.headRest = character.headBone ? character.headBone.scale.clone() : null;
    this.label = 'IDLE'; this.frozen = () => false;
    this.ctl = null;
    if (character.clips.length) {
      this.ctl = new AnimationController(character.root, character.clips, {
        states: { idle: { clip: 'Idle' }, walk: { clip: 'Walking' }, run: { clip: 'Running' }, jump: { clip: 'Jump', loop: false, clamp: true } },
        trees: { locomotion: { type: '1d', param: 'speed', points: [{ at: 0, state: 'idle' }, { at: 1.8, state: 'walk' }, { at: 5.2, state: 'run' }] } },
        transitions: { default: 0.15 }, rootMotion: false,
      });
      this.ctl.play('locomotion');
      this.mode = 'locomotion';
      this.ctl.events.on('end', (s) => {
        const st = typeof s === 'string' ? s : s && (s.name || s.state);
        if (st === 'jump' && this.mode === 'jump' && this.cc.grounded) { this.mode = 'locomotion'; this.ctl.play('locomotion'); }
      });
    }
    this.entity.position.copy(cc.position);
  }

  teleport(x, y, z, facing = this.state.facing) {
    this.cc.teleport(x, y, z);
    this.prev.copy(this.cc.position); this.cur.copy(this.cc.position); this.yOff = 0;
    this.state.facing = facing; this.entity.rotation.y = facing;
    this.entity.position.copy(this.cc.position); this.entity.updateMatrixWorld(true);
  }

  fixedUpdate(dt) {
    const cc = this.cc, I = this.intent;
    this.prev.copy(this.cur);
    cc.step(dt, I.moveX, I.moveZ, I.jump, I.sprint, this.physics);
    I.jump = false;
    if (cc.landedThisStep) this.landed = true;
    if (cc.jumpedThisStep) this.jumped = true;
    if (cc.steppedUp) this.yOff -= cc.position.y - this.prev.y; // kerbs: ease the step-up pop
    this.cur.copy(cc.position);
  }

  update(dt, alpha) {
    if (this.frozen()) return;
    const cc = this.cc, st = this.state, I = this.intent;
    this.yOff *= Math.exp(-18 * dt);
    this.entity.position.lerpVectors(this.prev, this.cur, alpha);
    this.entity.position.y += this.yOff;
    // facing: toward the move intent (third person) or the view yaw (first person)
    let goal = st.facing, rate = 10;
    if (this.firstPerson && this.fpRig) { goal = this.fpRig.yaw; rate = 30; }
    else if (I.moveX * I.moveX + I.moveZ * I.moveZ > 0.01) goal = Math.atan2(-I.moveX, -I.moveZ);
    st.facing = wrapPi(st.facing + wrapPi(goal - st.facing) * (1 - Math.exp(-rate * dt)));
    this.entity.rotation.y = st.facing;
    st.speed = cc.speed; st.grounded = cc.grounded;
    if (this.firstPerson !== this._fp) {
      this._fp = this.firstPerson;
      if (this.char.headBone && this.headRest) this.char.headBone.scale.copy(this.headRest).multiplyScalar(this._fp ? 1e-3 : 1);
      else this.view.visible = !this._fp;
    }
    if (this.ctl) {
      if (this.landed) { this.landed = false; if (this.mode === 'jump') { this.mode = 'locomotion'; this.ctl.play('locomotion'); } }
      if (this.jumped) { this.jumped = false; this.mode = 'jump'; this.ctl.play('jump'); }
      this.ctl.setParam('speed', cc.speed);
      this.ctl.update(dt);
    } else { this.landed = false; this.jumped = false; }
    this.label = this.mode === 'jump' ? 'JUMP' : !cc.grounded ? 'FALL' : cc.speed < 0.3 ? 'IDLE' : cc.speed < 3.6 ? 'WALK' : 'RUN';
  }

  /** Bench: a fixed animation phase at a speed (cross-fades settled). */
  pose(speed) {
    if (!this.ctl) return;
    this.mode = 'locomotion'; this.ctl.play('locomotion'); this.ctl.setParam('speed', speed);
    for (let i = 0; i < 60; i++) this.ctl.update(1 / 60);
    this.ctl.mixer.setTime(0);
    this.entity.updateMatrixWorld(true);
  }
}
