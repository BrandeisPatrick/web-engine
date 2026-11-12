// The hero car: VehicleController (spec.js) + the code-built model (car-model.js), render interpolation between
// fixed steps, wheels on their own contact points (suspension travel, steer, spin; the body's pitch / roll comes from
// the controller's sprung body), lamps (head / tail / brake / reverse / indicators on handbrake), real light on the
// road (desktop: clustered spot + point lights through the world's ExtraLights; phones: one SpotLight and additive
// light pools on the asphalt), a contact shadow, skid marks and tyre smoke from slip, sparks and a camera kick on hard
// impacts, exhaust puffs and backfire pops on upshifts, and a six-speed gearbox for the HUD and the engine sound.
// Allocation-free per frame and per step.
//
//   const car = new HeroCar({ scene, physics, model, lights, lod, effects });
//   fixedUpdate: car.fixedUpdate(dt) · update: car.update(dt, alpha, darkness) · car.reset(x, z, heading)
import * as THREE from 'three';
import { VehicleController, DecalTrail, ParticleSystem, clusteredUniforms } from '@vibe/engine';
import { CAR_SPEC, GEARBOX } from './spec.js';
import { makeCarEnvironment } from './car-model.js';

const _p = new THREE.Vector3(), _v = new THREE.Vector3(), _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qs = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function radialTexture(stops) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [t, col] of stops) grd.addColorStop(t, col);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}

export class HeroCar {
  /**
   * @param {object} o  scene, physics (the controller's world: PhysicsWorld or a filtered view), model (buildCarModel),
   *   lights (ExtraLights | null), lod 'high' | 'low', effects (0..1 particle / decal budget), postfx (velocity tracking)
   */
  constructor(o) {
    this.physics = o.physics;
    this.vc = new VehicleController(CAR_SPEC);
    this.spec = this.vc.spec;
    this.model = o.model;
    this.lights = o.lights || null;
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false, thrust: 0, pitch: 0, yaw: 0, boost: false };
    this.prevPos = new THREE.Vector3(); this.prevQuat = new THREE.Quaternion();
    const root = this.object3d = new THREE.Group(); root.name = 'heroCar';
    root.add(this.model.root);
    // where the lamps / exhaust / tail are on this model (the generated sedan's values unless the model says)
    const A = this.model.anchors || {};
    this.anchors = { rearZ: A.rearZ ?? 2.43, frontZ: A.frontZ ?? -2.43, lampX: A.tail ? Math.abs(A.tail[1][0]) : 0.63, lampY: A.tail ? A.tail[1][1] : 0.77, exhaust: A.exhaust || [[0.55, 0.215, 2.5]], halfWidth: A.halfWidth ?? 0.9, tailZ: A.tail ? A.tail[1][2] : (A.rearZ ?? 2.43), head: A.head || [[-0.58, 0.6, -2.5], [0.58, 0.6, -2.5]] };
    for (const w of this.model.wheels) root.add(w.root);
    o.scene.add(root);
    this.droop = new Float32Array(4);
    // contact shadow / ambient occlusion under the car: a soft dark blob (multiplied), plus a tighter one per wheel
    const blob = radialTexture([[0, 'rgba(0,0,0,0.97)'], [0.5, 'rgba(0,0,0,0.82)'], [0.8, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);
    const shMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0.9, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(this.anchors.halfWidth * 2.5, this.anchors.rearZ - this.anchors.frontZ + 0.6).rotateX(-Math.PI / 2), shMat);
    this.shadow.renderOrder = 3; this.shadow.name = 'car-contactShadow';
    o.scene.add(this.shadow);
    // light pools on the road (phones, and a faint reddish wash behind the car on desktop too)
    const pool = radialTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    const poolMat = (c) => new THREE.MeshBasicMaterial({ map: pool, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
    this.tailPool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3).rotateX(-Math.PI / 2), poolMat(new THREE.Color(0.6, 0.02, 0.01)));
    this.headPool = new THREE.Mesh(new THREE.PlaneGeometry(9, 18).rotateX(-Math.PI / 2), poolMat(new THREE.Color(0.5, 0.47, 0.4)));
    this.tailPool.renderOrder = this.headPool.renderOrder = 4;
    o.scene.add(this.tailPool, this.headPool);
    // a few dust motes caught in the low beams, low and to the front right (the reference's lit dust); car-local,
    // drifting slowly, faded out with speed
    {
      const n = 70, P = new Float32Array(n * 3), seed = this._dustSeed = new Float32Array(n * 4), fz = this.anchors.frontZ;
      // mostly over the right shoulder, where the beam's edge grazes the gravel (as in the reference)
      for (let i = 0; i < n; i++) { const sh = Math.random() < 0.7; seed[i * 4] = sh ? 1.1 + Math.random() * 2.2 : 0.2 + Math.random() * 1.2; seed[i * 4 + 1] = 0.03 + Math.pow(Math.random(), 1.8) * 0.6; seed[i * 4 + 2] = fz - 0.6 - Math.random() * 6.5; seed[i * 4 + 3] = Math.random() * 6.28; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      const dot = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
      this.dust = new THREE.Points(g, new THREE.PointsMaterial({ map: dot, color: new THREE.Color(1.0, 0.78, 0.55), size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.dust.name = 'car-dust';
      // a soft glow hugging each tail lamp, so the cluster reads wider than the model's thin strip (as the reference's)
      const glow = radialTexture([[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.75)'], [0.4, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]); // a hot centre and a lens-like falloff
      const A = this.anchors, gw = (this.model.anchors && this.model.anchors.tailWidth ? this.model.anchors.tailWidth : 1.2) * 0.42;
      this.tailGlow = [-1, 1].map((sx) => {
        // (a rear-facing additive quad: the camera is behind the car in every view that sees the lamps)
        const sp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(1.9, 0.33, 0.11), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true, fog: false }));
        const tz = this.model.anchors && this.model.anchors.tail ? this.model.anchors.tail[1][2] : A.rearZ;
        sp.position.set(sx * A.lampX, A.lampY + 0.05, tz + 0.16); sp.scale.set(gw * 1.35, 0.15, 1); sp.renderOrder = 6; sp.name = 'car-tailGlow';
        root.add(sp); return sp;
      }); this.dust.frustumCulled = false; this.dust.renderOrder = 5;
      root.add(this.dust);
    }
    this.lod = o.lod || 'high';
    // phones: one real spot light for the headlights (the pool's 8 lamps + this one)
    if (!this.lights) {
      const s = this.spot = new THREE.SpotLight(0xfff0dc, 0, 70, 0.5, 0.45, 1.6);
      s.position.set(0, 0.62, -2.0); s.target.position.set(0, -0.6, -22); s.castShadow = false;
      root.add(s, s.target);
    }
    // effects
    const fx = o.effects ?? 1;
    this.skids = new DecalTrail({ maxQuads: Math.round(2400 * fx), trails: 4, color: 0x050505, opacity: 0.7, minSegment: 0.25, fadeTail: 0.3, edge: 0.25, lift: 0.025, name: 'skidMarks' });
    o.scene.add(this.skids.mesh);
    this.smoke = new ParticleSystem({ max: Math.round(900 * fx), blending: 'normal', drag: 1.4, fadeIn: 0.1, spin: 0.6, name: 'tyreSmoke', lit: true, litAmbient: 0.5, sun: o.atmosphere || 1 });
    this.smoke.mesh.renderOrder = 9; o.scene.add(this.smoke.mesh);
    this.sparks = new ParticleSystem({ max: Math.round(400 * fx), blending: 'additive', gravity: 9.8, drag: 0.6, streak: 0.035, name: 'sparks' });
    o.scene.add(this.sparks.mesh);
    this.exhaust = new ParticleSystem({ max: Math.round(160 * fx), blending: 'normal', drag: 1.8, fadeIn: 0.05, spin: 0.8, name: 'exhaust', lit: true, litAmbient: 0.4, sun: o.atmosphere || 1 });
    o.scene.add(this.exhaust.mesh);
    this.flame = new ParticleSystem({ max: 48, blending: 'additive', drag: 6, name: 'backfire' });
    o.scene.add(this.flame.mesh);
    this._smokeAcc = new Float32Array(4); this._exAcc = 0;
    if (o.postfx) { root.traverse((m) => { if (m.isMesh) o.postfx.track(m); }); }
    // outputs for the HUD / audio / camera
    this.gear = 1; this.rpm = GEARBOX.idle; this._shiftT = 0; this.shifted = 0;
    this.impact = 0; this.landing = 0; this.events = { impact: 0, landing: 0, scrape: 0 };
    this.state = { velocity: this.vc.velocity, speedKmh: 0, mode: 'ground', thrust: 0, gForce: 1, grounded: true, wheelSlip: 0 };
    this.headingDeg = 0; this.lightsOn = 1; this.brakeLight = 0; this.reverse = 0; this.hazard = 0; this._t = 0;
    this.speedLoss = 0; // m/s taken from the car this step by prop hits (props.js)
    this.renderer = o.renderer || null; this._envDark = -1; this._env = null; this._makeEnv = makeCarEnvironment;
  }

  reset(x, y, z, heading) {
    const vc = this.vc;
    vc.reset(_p.set(x, y, z), heading, this.physics);
    this.prevPos.copy(vc.position); this.prevQuat.copy(vc.quaternion);
    this.object3d.position.copy(vc.position); this.object3d.quaternion.copy(vc.quaternion);
    for (let i = 0; i < 4; i++) { this.skids.end(i); this.droop[i] = 0; }
    this.object3d.updateMatrixWorld(true);
  }

  /** Copy the driver's input (VehicleInput) into the controls (once per frame). */
  setInput(inp, enabled) {
    const c = this.controls;
    if (!enabled) { c.throttle = 0; c.brake = 0; c.steer = 0; c.handbrake = false; c.yaw = 0; return; }
    c.throttle = inp.throttle; c.brake = inp.brake; c.steer = inp.steer; c.handbrake = inp.handbrake;
    c.yaw = inp.steer * 0.5; c.pitch = 0;
  }

  fixedUpdate(dt) {
    const vc = this.vc;
    this.prevPos.copy(vc.position); this.prevQuat.copy(vc.quaternion);
    vc.step(dt, this.controls, this.physics);
    if (vc.impact > 0) this.events.impact = Math.max(this.events.impact, vc.impact);
    if (vc.landedThisStep) this.events.landing = Math.max(this.events.landing, vc.landingImpact);
    if (vc.bottomed) this.events.scrape = Math.max(this.events.scrape, vc.speed);
  }

  update(dt, alpha, darkness = 0) {
    const vc = this.vc, root = this.object3d, S = this.spec;
    this._t += dt;
    root.position.lerpVectors(this.prevPos, vc.position, alpha);
    root.quaternion.slerpQuaternions(this.prevQuat, vc.quaternion, alpha);
    root.updateMatrixWorld(true);
    // wheels: each hangs at its contact point (W[i].y: + compressed, - extended), steers (front) and spins
    const W = vc.wheels, R = S.wheelRadius, k = 1 - Math.exp(-dt * 35);
    _qs.setFromAxisAngle(X, -vc.wheelSpin);
    for (let i = 0; i < 4; i++) {
      const w = this.model.wheels[i];
      this.droop[i] += (-W[i].y - this.droop[i]) * k;
      w.root.position.set(w.base.x, (w.radius ?? R) - this.droop[i], w.base.z);
      if (i < 2) w.root.quaternion.setFromAxisAngle(Y, vc.steerAngle); else w.root.quaternion.identity();
      w.spin.quaternion.copy(_qs);
    }
    // lamps: low beams at dusk, brake lights, reverse, hazards on the handbrake at a stop
    const L = this.model.lamps, c = this.controls;
    const lightsOn = darkness > 0.05 ? 1 : 0;
    this.lightsOn += (lightsOn - this.lightsOn) * (dt > 0 ? Math.min(1, dt * 4) : 1); // a dt-0 update (placement, poses) snaps
    const braking = vc.braking || (c.brake > 0.05 && !vc.reversing) ? 1 : 0;
    this.brakeLight += (braking - this.brakeLight) * Math.min(1, dt * 25);
    this.reverse += ((vc.reversing ? 1 : 0) - this.reverse) * Math.min(1, dt * 20);
    const hz = c.handbrake && vc.speed < 2 ? (Math.sin(this._t * 9) > 0 ? 1 : 0) : 0;
    L.uHead.value = this.lightsOn; L.uTail.value = 0.15 + this.lightsOn * 0.85; L.uBrake.value = this.brakeLight;
    L.uReverse.value = this.reverse; L.uIndL.value = hz; L.uIndR.value = hz; L.uDrl.value = 1;
    this.model.materials.brake3.emissiveIntensity = this.brakeLight * 2.5;
    this.model.materials.fog.emissiveIntensity = this.lightsOn * 1.5;
    if (!this._paintMats) { this._paintMats = []; this.object3d.traverse((o) => { if (o.isMesh && o.material && o.material.userData.paintEnv) this._paintMats.push(o.material); }); }
    for (const m of this._paintMats) { const [a, b] = m.userData.paintEnv; m.envMapIntensity = a + (b - a) * Math.min(1, darkness * 1.6); } // more sky in the clear coat at dusk, not a washed noon
    this._environment(darkness);
    this._lampLights(darkness);
    this._shadowAndPools(darkness);
    this._effects(dt);
    if (this.tailGlow) { const g = (0.6 * this.lightsOn + 1.1 * this.brakeLight) * Math.min(1, 0.2 + darkness * 1.4); for (const sp of this.tailGlow) { sp.material.opacity = g; sp.visible = g > 0.01; } }
    if (this.dust) {
      const P = this.dust.geometry.attributes.position, sd = this._dustSeed, t = this._t;
      for (let i = 0; i < P.count; i++) { const ph = sd[i * 4 + 3]; P.setXYZ(i, sd[i * 4] + 0.12 * Math.sin(t * 0.21 + ph), sd[i * 4 + 1] + 0.08 * Math.sin(t * 0.17 + ph * 1.7), sd[i * 4 + 2] + 0.15 * Math.sin(t * 0.13 + ph * 0.6)); }
      P.needsUpdate = true;
      this.dust.material.opacity = 0.9 * this.lightsOn * darkness / (1 + vc.speed / 10);
      this.dust.visible = this.dust.material.opacity > 0.01;
    }
    // state for camera / HUD / audio
    const st = this.state;
    st.speedKmh = vc.speed * 3.6; st.gForce = vc.gForce; st.grounded = vc.grounded; st.wheelSlip = vc.wheelSlip;
    _fwd.set(0, 0, -1).applyQuaternion(root.quaternion);
    this.headingDeg = Math.atan2(_fwd.x, -_fwd.z) * 57.29578;
    this._gearbox(dt);
  }

  /**
   * Desktop: a live reflection probe at the car (a 128 px cube render target, one face per frame round-robin, the
   * car and its effects hidden, clustered lights off for the pass since their tiles map the main view; three turns
   * the cube into a PMREM when a full cycle is done), so neon, lamps and the sky slide over the paint and glass as
   * the car moves. Phones keep the static dusk environment (makeCarEnvironment).
   */
  enableProbe(scene, size = 128) {
    if (!this.renderer) return;
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.probe = { rt, cam: new THREE.CubeCamera(0.3, 220, rt), scene, face: 0, hide: [this.object3d, this.shadow, this.tailPool, this.headPool, this.smoke.mesh, this.sparks.mesh, this.exhaust.mesh, this.flame.mesh, this.skids.mesh] };
    this.probe.cam.name = 'carProbe';
    this.object3d.traverse((o) => { const m = o.material; if (o.isMesh && m && (m.userData.carEnv || /^(carBody|mirrorGlass|chrome|rim)$/.test(m.name))) { m.envMap = rt.texture; m.needsUpdate = true; } });
    this._makeEnv = null; // the probe replaces the static environment
  }

  /** Render `faces` probe faces (round-robin; 6 = all, e.g. after a teleport or for a bench pose). */
  updateProbe(faces = 1) {
    const P = this.probe; if (!P || P.on === false) return;
    // shadow maps: the main pass already rendered this frame's (call this after it); the lights that update every
    // frame are held so the probe pass does not render them again
    const R = this.renderer, held = [];
    P.scene.traverse((o) => { if (o.isLight && o.castShadow && o.shadow.autoUpdate) { held.push(o.shadow); o.shadow.autoUpdate = false; } });
    const cl = clusteredUniforms().engineClParams2.value, lc = cl[3];
    const vis = P.hide.map((o) => o.visible);
    for (const o of P.hide) o.visible = false;
    cl[3] = 0;
    const p = this.object3d.position;
    P.cam.position.set(p.x, p.y + 0.9, p.z);
    P.cam.updateMatrixWorld();
    const prevRT = R.getRenderTarget(), prevXr = R.xr.enabled;
    R.xr.enabled = false;
    for (let k = 0; k < faces; k++) {
      R.setRenderTarget(P.rt, P.face);
      R.render(P.scene, P.cam.children[P.face]);
      P.face = (P.face + 1) % 6;
      if (P.face === 0) P.rt.texture.needsPMREMUpdate = true;
    }
    R.setRenderTarget(prevRT); R.xr.enabled = prevXr;
    for (const sh of held) sh.autoUpdate = true;
    cl[3] = lc;
    P.hide.forEach((o, i) => { o.visible = vis[i]; });
  }

  /** The paint / glass reflection environment (car-model.js makeCarEnvironment), rebuilt when the light changes a lot. */
  _environment(darkness) {
    if (!this.renderer || !this._makeEnv) return;
    // while the page's own sky environment is on (the dusk dome, sceneEnvWhen()), the paint uses scene.environment
    const useScene = !!(this.sceneEnvWhen && this.sceneEnvWhen());
    if (useScene !== !!this._usingScene) {
      this._usingScene = useScene; this._envDark = -1;
      if (useScene) this.object3d.traverse((o) => { const m = o.material; if (o.isMesh && m && (m.userData.carEnv || /^(carBody|mirrorGlass|chrome|rim)$/.test(m.name))) { m.envMap = null; m.needsUpdate = true; } });
    }
    if (useScene) return;
    const d = Math.round(darkness * 4) / 4;
    if (d === this._envDark) return;
    this._envDark = d;
    const env = this._makeEnv(this.renderer, d);
    // the meshes' own materials (postfx.track clones shared ones for per-object velocity)
    const first = true; // (the envMap may have been cleared for the scene environment: recompile)
    this.object3d.traverse((o) => { const m = o.material; if (o.isMesh && m && (m.userData.carEnv || /^(carBody|mirrorGlass|chrome|rim)$/.test(m.name))) { m.envMap = env; if (first) m.needsUpdate = true; } });
    if (this._env) this._env.dispose();
    this._env = env;
  }

  _lampLights(darkness) {
    const root = this.object3d, Lx = this.lights, on = this.lightsOn;
    _fwd.set(0, 0, -1).applyQuaternion(root.quaternion);
    if (!Lx) {
      if (this.spot) this.spot.intensity = 520 * on;
      return;
    }
    // slots 100..: two head spots, two tail points (brake brightens), one reverse point
    for (let s = 0; s < 2; s++) {
      _p.set(...this.anchors.head[s]).applyMatrix4(root.matrixWorld);
      _v.set(s ? 0.05 : -0.05, -0.06, -1).applyQuaternion(root.quaternion);
      const I = 90 * on;
      Lx.spot(100 + s, _p.x, _p.y, _p.z, 60, I, I * 0.95, I * 0.86, _v.x, _v.y, _v.z, Math.cos(0.32), Math.cos(0.5));
    }
    // the tail lamps' light on the road: placed well behind and below the lamps, so it washes the asphalt and not the
    // car's own tail (the shader draws the spill on the bumper)
    const red = 0.9 * on + 3.2 * this.brakeLight * Math.max(0.25, darkness); // off in daylight (no pools at noon)
    for (let s = 0; s < 2; s++) {
      // just behind and below each lamp: a red spill on the bumper and a faint hint on the road under it
      // close behind each lamp: the bodywork round it takes a red spill, the road right behind a touch
      _p.set((s ? 1 : -1) * this.anchors.lampX, this.anchors.lampY - 0.12, this.anchors.tailZ + 0.45).applyMatrix4(root.matrixWorld);
      Lx.set(102 + s, _p.x, _p.y, _p.z, 3.4, red * 0.8, red * 0.1, red * 0.035);
    }
    // a soft fill over the car at dusk (above and behind, wide): the body's form reads against the dark road, as the
    // reference car's sides and trunk do in the afterglow
    { const k = this.fill === false ? 0 : 4.2 * Math.max(0, darkness - 0.2); _p.set(0, 3.2, this.anchors.rearZ + 3.5).applyMatrix4(root.matrixWorld); if (k > 0.01) Lx.set(105, _p.x, _p.y, _p.z, 10, k * 0.62, k * 0.42, k * 0.5); else Lx.off(105);
      // and a warm rim from the afterglow side (ahead and above): the roof and shoulder edges catch it
      _p.set(0, 2.6, this.anchors.frontZ - 4.5).applyMatrix4(root.matrixWorld); if (k > 0.01) Lx.set(106, _p.x, _p.y, _p.z, 9, k * 0.9, k * 0.5, k * 0.3); else Lx.off(106); }
    if (this.reverse > 0.05) { _p.set(0, 0.5, this.anchors.rearZ + 0.6).applyMatrix4(root.matrixWorld); const w = 6 * this.reverse; Lx.set(104, _p.x, _p.y, _p.z, 9, w, w, w * 0.95); } else Lx.off(104);
    void darkness;
  }

  _shadowAndPools(darkness) {
    const root = this.object3d, vc = this.vc;
    const gy = this.physics.getGroundHeight(root.position.x, root.position.z, root.position.y + 0.5);
    const yaw = Math.atan2(-_fwd.x, -_fwd.z);
    const h = Math.max(0, root.position.y - gy);
    this.shadow.position.set(root.position.x, gy + 0.03, root.position.z);
    this.shadow.rotation.y = yaw;
    this.shadow.material.opacity = 0.97 * clamp(1 - h / 3, 0, 1);
    const s = 1 + h * 0.25; this.shadow.scale.set(s, 1, s);
    // tail pool: a red wash behind the car (brighter on the brakes), head pool: the beam's footprint (phones)
    _p.set(0, 0, this.anchors.rearZ + 0.55).applyQuaternion(root.quaternion).add(root.position);
    this.tailPool.position.set(_p.x, gy + 0.035, _p.z); this.tailPool.rotation.y = yaw;
    const tk = (this.lights ? 0.2 : 0.3) * (0.25 + 0.75 * this.lightsOn) * darkness + this.brakeLight * (this.lights ? 0.5 : 1.0) * Math.max(0.3, darkness);
    this.tailPool.material.opacity = clamp(tk, 0, 1.5);
    this.tailPool.visible = tk > 0.01 && vc.grounded;
    _p.set(0, 0, -12).applyQuaternion(root.quaternion).add(root.position);
    this.headPool.position.set(_p.x, gy + 0.04, _p.z); this.headPool.rotation.y = yaw;
    const hk = (this.lights ? 0.22 : 0.55) * this.lightsOn * darkness; // a soft pool ahead (desktop: under the real spots)
    this.headPool.material.opacity = hk; this.headPool.visible = hk > 0.01 && vc.grounded;
  }

  _effects(dt) {
    const vc = this.vc, root = this.object3d, W = vc.wheels;
    _right.set(1, 0, 0).applyQuaternion(root.quaternion);
    _up.set(0, 1, 0).applyQuaternion(root.quaternion);
    const speed = vc.speed, slip = vc.wheelSlip, hb = this.controls.handbrake;
    // longitudinal wheelspin (rear-drive launch) and lock-ups also mark the road
    const spinSlip = this.controls.throttle > 0.8 && speed < 12 && vc.grounded ? (1 - speed / 12) * 0.9 : 0;
    const lock = this.controls.brake > 0.9 && speed > 8 ? 0.35 : 0;
    for (let i = 0; i < 4; i++) {
      const w = this.model.wheels[i];
      _p.set(w.base.x, 0.0, w.base.z).applyMatrix4(root.matrixWorld);
      const gy = this.physics.getGroundHeight(_p.x, _p.z, _p.y + 0.4);
      _p.y = gy;
      const rear = i >= 2;
      const onGround = vc.grounded && vc.wheelGaps[i] < 0.06 && W[i].contact !== false;
      const s = Math.max(slip * (rear ? 1 : 0.6), hb && rear ? Math.min(1, speed / 10) : 0, rear ? spinSlip : 0, lock);
      const inten = onGround && speed > 1.5 ? clamp((s - 0.18) * 1.6, 0, 1) : 0;
      this.skids.feed(i, _p, _right, 0.11, inten);
      // smoke from sliding tyres
      if (inten > 0.3 && rear && speed > 4) {
        let acc = this._smokeAcc[i] + inten * 22 * dt * Math.min(1, speed / 15);
        while (acc >= 1) {
          acc -= 1;
          const life = 1.2 + Math.random() * 1.2, s0 = 0.4 + Math.random() * 0.3, s1 = 1.6 + inten * 1.8 + Math.random();
          const gr = 0.5 + Math.random() * 0.1;
          this.smoke.spawn(_p.x + (Math.random() - 0.5) * 0.3, _p.y + 0.2, _p.z + (Math.random() - 0.5) * 0.3,
            vc.velocity.x * 0.25 + (Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 0.8, vc.velocity.z * 0.25 + (Math.random() - 0.5) * 1.6,
            life, s0, s1, 0.06 + inten * 0.08, gr, gr, gr * 1.02, gr * 0.95, gr * 0.95, gr, 1.4, -0.12);
        }
        this._smokeAcc[i] = acc;
      }
    }
    // exhaust: idle puffs + a backfire pop on lift-off at high rpm / upshifts
    let ex = this._exAcc + dt * (6 + this.controls.throttle * 14) * (speed < 25 ? 1 : 0.3);
    while (ex >= 1) {
      ex -= 1;
      for (const [sx, sy, sz] of this.anchors.exhaust) {
        _p.set(sx, sy, sz).applyMatrix4(root.matrixWorld);
        _v.set(0, 0, 1).applyQuaternion(root.quaternion);
        this.exhaust.spawn(_p.x, _p.y, _p.z, _v.x * 1.5 + vc.velocity.x * 0.6, 0.25, _v.z * 1.5 + vc.velocity.z * 0.6, 0.9 + Math.random() * 0.6, 0.12, 0.7, 0.07, 0.6, 0.6, 0.62, 0.5, 0.5, 0.52, 2, -0.2);
      }
    }
    this._exAcc = ex;
    if (this.shifted > 0) {
      for (const [sx, sy, sz] of this.anchors.exhaust) for (let k = 0; k < 6; k++) {
        _p.set(sx, sy, sz).applyMatrix4(root.matrixWorld);
        _v.set(0, 0, 1).applyQuaternion(root.quaternion);
        const sp = 3 + Math.random() * 4;
        this.flame.spawn(_p.x, _p.y, _p.z, _v.x * sp + vc.velocity.x, (Math.random() - 0.3) * 0.6, _v.z * sp + vc.velocity.z, 0.07 + Math.random() * 0.06, 0.16, 0.05, 1.2, 1.0, 0.45, 0.1, 0.9, 0.1, 0.02, 6, 0);
      }
      this.shifted = 0;
    }
    this.smoke.update(dt); this.sparks.update(dt); this.exhaust.update(dt); this.flame.update(dt);
  }

  /** Sparks at a world point (hard impacts, scrapes): n streaks thrown along the car's velocity. */
  sparkBurst(x, y, z, n, strength = 1) {
    const v = this.vc.velocity;
    for (let i = 0; i < n; i++) {
      const sp = 3 + Math.random() * 7 * strength;
      this.sparks.spawn(x, y, z, v.x * 0.4 + (Math.random() - 0.5) * sp, 1 + Math.random() * 3 * strength, v.z * 0.4 + (Math.random() - 0.5) * sp,
        0.25 + Math.random() * 0.45, 0.05, 0.02, 1, 1.0, 0.7, 0.3, 1.0, 0.3, 0.05);
    }
  }

  _gearbox(dt) {
    const G = GEARBOX, v = Math.abs(this.vc.wheelSpeed), thr = this.controls.throttle;
    this._shiftT = Math.max(0, this._shiftT - dt);
    if (this.vc.reversing) this.gear = -1;
    else if (this.gear < 1) this.gear = 1;
    if (this.gear >= 1) {
      const raw = G.idle + v * G.ratios[this.gear];
      if (raw > G.upshift && this.gear < G.ratios.length - 1 && thr > 0.2) { this.gear++; this._shiftT = 0.16; this.shifted = 1; }
      else if (raw > G.redline && this.gear < G.ratios.length - 1) { this.gear++; this._shiftT = 0.16; }
      else if (raw < G.downshift && this.gear > 1) { this.gear--; this._shiftT = 0.1; }
    }
    const ratio = this.gear < 0 ? G.ratios[1] : G.ratios[this.gear];
    let rpm = G.idle + v * ratio;
    // clutch slip at launch / wheelspin, free revving in the air
    if (this.gear === 1 && thr > 0.1) rpm = Math.max(rpm, G.idle + thr * 3400);
    if (!this.vc.grounded) rpm += thr * 2000;
    rpm = Math.min(G.redline, Math.max(G.idle, rpm));
    if (this._shiftT > 0) rpm *= 0.84;
    this.rpm += (rpm - this.rpm) * Math.min(1, dt * 14);
  }
}

export function headingOf(q) { const e = new THREE.Euler().setFromQuaternion(q, 'YXZ'); return e.y; }
