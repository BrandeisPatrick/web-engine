// CarVisual: a drivable HD car body in one call, matched to its physics.
//
//   const visual = createCarVisual('hatchback', { color: 0x9e1416 });
//   scene.add(visual.root);
//   const car = new VehicleController(visual.spec);          // ROAD_CAR_SPEC resized to this body: wheels line up
//   car.reset(start, 0, physics);
//   // per frame, after placing the root on the car's pose (PoseInterpolator.apply(visual.root, alpha), or copy
//   // car.position / car.quaternion):
//   visual.update(dt, car, { darkness: atmosphere.darkness });
//
// What it is: makeVehicleParts(type, { lod: 'hd' }) (Vehicles.js) assembled into a Group: the body and the glass /
// lenses as one-instance InstancedMeshes (that is how the vehicle material gets the paint colour and the per-car brake
// value, `aBrake`), the interior, and four wheels, each a hub node (steers about Y, rides the suspension) holding its
// caliper and a spinner (rolls about X) holding the wheel. Plus reverse lamps (emissive quads over the HD tail lamp's
// clear inner quarter, found in the body mesh; the pickup has none) and a soft contact shadow under the body.
//
// Frame: the engine's: forward -Z, up +Y, right +X, origin on the ground at the middle of the body's length, which is
// also VehicleController's reference point (the spec's CG at z = 0 and the axles at the body's real wheelbase), so the
// root takes the controller's position / quaternion as they are, with no flip or offset.
//
// update(dt, car, opts): car is a VehicleController (read only: wheels[i].y / contact, wheelGaps, steerAngle,
// wheelSpin, braking, reversing; all optional, null leaves the car parked).
//   wheels   hub y = wheelRadius + wheels[i].y (the contact point's suspension travel), front hubs steer by steerAngle,
//            spinners roll by -wheelSpin (forward)
//   lamps    brake lamps from car.braking (or opts.brake 0..1), eased in ~50 ms; reverse lamps from car.reversing (or
//            opts.reverse); head and tail lamps from opts.darkness (an Atmosphere's 0..1 darkness: off until 0.12,
//            full from 0.57, as samples/dev/vehicles.js), or opts.lights: true / false to force them
//   shadow   fitted to the four wheel supports in the car's frame (so it stays on the ground under dive and roll),
//            fading out and spreading as the car leaves the ground (mean wheel gap 0 .. 1.5 m)
// No allocation per update.
//
// The spec: ROAD_CAR_SPEC with length / width / height, axleFront / axleRear, halfTrack and wheelRadius from the body
// (VEHICLE_SPECS), mass scaled by the body's volume against ROAD_CAR_SPEC's 4.3 x 1.8 x 1.45 m, yaw inertia by mass
// and plan size, cgHeight by height. Everything else (power, grip, suspension) is ROAD_CAR_SPEC's: spread to tune,
// `new VehicleController({ ...visual.spec, motorPower: 200e3 })`, keeping the geometry fields.
import * as THREE from 'three';
import { makeVehicleParts, createVehicleMaterial, VEHICLE_SPECS, VEHICLE_HD_TYPES } from './Vehicles.js';
import { ROAD_CAR_SPEC } from '../physics/VehicleController.js';

const ORDER = ['FL', 'FR', 'RL', 'RR'];   // VehicleController's wheel order
const REF = ROAD_CAR_SPEC;

/**
 * @typedef {object} CarVisualOptions
 * @property {THREE.ColorRepresentation} [color=0xb81e1e]  body paint (sRGB hex / CSS string / THREE.Color)
 * @property {boolean} [castShadow=true]       body, glass and wheels cast sun shadows
 * @property {boolean} [contactShadow=true]    the soft shadow quad under the body
 * @property {number} [shadowOpacity=0.75]     contact shadow strength
 */
/**
 * @typedef {object} CarVisualUpdateOptions
 * @property {number} [darkness=0]   Atmosphere.darkness (0 day .. 1 night): head / tail lamps
 * @property {boolean|null} [lights] true / false force the head and tail lamps on / off (default from darkness)
 * @property {number|null} [brake]   0..1 brake-lamp level (default: car.braking)
 * @property {boolean|null} [reverse] reverse lamps (default: car.reversing)
 */
/**
 * @typedef {object} CarVisual
 * @property {THREE.Group} root       add to the scene and place on the car's pose (forward -Z, origin = the controller's
 *                                    reference point)
 * @property {THREE.InstancedMesh} body   paint, trim, lamps (one instance; instanceColor = paint)
 * @property {THREE.InstancedMesh} glass  windows and lamp lenses
 * @property {THREE.Mesh} interior
 * @property {THREE.Group[]} wheels   hub nodes [FL, FR, RL, RR]: position = hub, rotation.y = steer; each holds its
 *                                    caliper and spinners[i]
 * @property {THREE.Group[]} spinners per wheel, rotation.x = roll (holds the wheel mesh)
 * @property {THREE.Mesh|null} shadow the contact shadow (child of root)
 * @property {THREE.Mesh[]} reverseLamps  emissive quads, visible while reversing
 * @property {import('../physics/VehicleController.js').VehicleSpec} spec  ROAD_CAR_SPEC resized to this body
 * @property {string} type
 * @property {{ body: THREE.MeshPhysicalMaterial, plain: THREE.MeshPhysicalMaterial, glass: THREE.MeshPhysicalMaterial }} materials
 *   per-car vehicle materials (uDark in userData.u: set by update)
 * @property {{ brake: number, reverse: number, uDark: number }} lamps  current lamp levels (read-only)
 * @property {(dt: number, car?: any, opts?: CarVisualUpdateOptions) => void} update
 * @property {(color: THREE.ColorRepresentation) => void} setColor
 * @property {() => void} dispose  geometries, materials and the shadow texture
 */

/**
 * ROAD_CAR_SPEC resized to an HD body type (see the file header).
 * @param {string} type  one of VEHICLE_HD_TYPES
 * @returns {import('../physics/VehicleController.js').VehicleSpec}
 */
export function carSpecFor(type) {
  const V = VEHICLE_SPECS[type];
  if (!V) throw new Error(`carSpecFor: unknown vehicle type '${type}' (VEHICLE_HD_TYPES: ${VEHICLE_HD_TYPES.join(', ')})`);
  const zF = -V.L / 2 + V.ohF, zR = zF + V.WB;
  const vol = (V.L * V.W * V.H) / (REF.length * REF.width * REF.height);
  const mass = Math.round(REF.mass * vol / 5) * 5;
  const plan = (V.L * V.L + V.W * V.W) / (REF.length * REF.length + REF.width * REF.width);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return {
    ...REF,
    mass,
    length: V.L, width: V.W, height: V.H,
    axleFront: r3(zF), axleRear: r3(zR), halfTrack: r3(V.track / 2),
    wheelRadius: V.wheelR,
    cgHeight: r3(REF.cgHeight * V.H / REF.height),
    yawInertia: Math.round(REF.yawInertia * (mass / REF.mass) * plan),
  };
}

let _shadowTex = null;
/** Soft rounded-rectangle alpha (64 x 128, built once, no canvas so it also builds in Node). */
function contactTexture() {
  if (_shadowTex) return _shadowTex;
  const W = 64, H = 128, data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // distance outside a rounded rectangle in [-1, 1]^2 (aspect-corrected), soft edge over the outer 45 %
    const u = Math.abs((x + 0.5) / W * 2 - 1), v = Math.abs((y + 0.5) / H * 2 - 1);
    const qx = Math.max(u - 0.45, 0) / 0.55, qy = Math.max(v - 0.62, 0) / 0.38;
    const d = Math.min(1, Math.hypot(qx, qy));
    const a = Math.round(255 * Math.pow(1 - d * d * (3 - 2 * d), 1.3) * (0.82 + 0.18 * (1 - Math.max(u, v * 0.8))));
    const o = (y * W + x) * 4;
    data[o] = data[o + 1] = data[o + 2] = data[o + 3] = a;
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.needsUpdate = true;
  _shadowTex = t;
  return t;
}

/** Bounds of the HD reverse-lamp reflector faces (HM.reverse: colour 0.32 / 0.33, roughness 0.3, metal 0.9) per side. */
function findReverseLamps(geo) {
  const P = geo.attributes.position.array, C = geo.attributes.color.array, N = geo.attributes.normal.array, S = geo.attributes.aSurf4.array;
  const c0 = Math.round(0.32 * 65535), c2 = Math.round(0.33 * 65535), r = Math.round(0.3 * 255), m = Math.round(0.9 * 255);
  const box = { [-1]: null, 1: null };
  for (let i = 0, n = P.length / 3; i < n; i++) {
    if (C[i * 3] !== c0 || C[i * 3 + 2] !== c2 || S[i * 4] !== r || S[i * 4 + 1] !== m || N[i * 3 + 2] < 100) continue;
    const sd = P[i * 3] < 0 ? -1 : 1;
    const b = box[sd] || (box[sd] = [Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    b[0] = Math.min(b[0], P[i * 3]); b[1] = Math.min(b[1], P[i * 3 + 1]);
    b[2] = Math.max(b[2], P[i * 3]); b[3] = Math.max(b[3], P[i * 3 + 1]); b[4] = Math.max(b[4], P[i * 3 + 2]);
  }
  return [box[-1], box[1]].filter(Boolean);
}

const _c = new THREE.Vector3(), _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _q = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0);

/**
 * A drivable HD car: body, glass, interior, steering / spinning / sprung wheels, brake, reverse and head lamps, a
 * contact shadow, and the VehicleController spec that matches it (see the file header).
 * @param {string} [type='hatchback']  one of VEHICLE_HD_TYPES (sedan, hatchback, suv, pickup, minivan, police, taxi,
 *   police_sedan)
 * @param {CarVisualOptions} [opts]
 * @returns {CarVisual}
 */
export function createCarVisual(type = 'hatchback', opts = {}) {
  if (!VEHICLE_HD_TYPES.includes(type)) {
    throw new Error(`createCarVisual: '${type}' has no HD build with separate wheels (use one of ${VEHICLE_HD_TYPES.join(', ')})`);
  }
  const { color = 0xb81e1e, castShadow = true, contactShadow = true, shadowOpacity = 0.75 } = opts;
  const parts = makeVehicleParts(type, { lod: 'hd' });
  const spec = carSpecFor(type);
  const V = VEHICLE_SPECS[type];

  const matBody = createVehicleMaterial({ brake: true, hd: true });
  const matPlain = createVehicleMaterial({ brake: false, hd: true });
  const matGlass = createVehicleMaterial({ brake: true, glass: true, hd: true });
  for (const m of [matBody, matPlain]) m.shadowSide = THREE.DoubleSide; // the HD shell is open: cast from both sides

  const root = new THREE.Group();
  root.name = `car-${type}`;
  const brakeAttr = new THREE.InstancedBufferAttribute(new Float32Array(1), 1);
  brakeAttr.setUsage(THREE.DynamicDrawUsage);
  const one = (geo, mat, name) => {
    geo.setAttribute('aBrake', brakeAttr);
    const m = new THREE.InstancedMesh(geo, mat, 1);
    m.setMatrixAt(0, new THREE.Matrix4());
    m.name = name; m.castShadow = castShadow; m.receiveShadow = true;
    m.computeBoundingSphere();
    return m;
  };
  const body = one(parts.body, matBody, 'body');
  body.setColorAt(0, new THREE.Color(color));
  const glass = one(parts.glass, matGlass, 'glass');
  glass.castShadow = false;
  const interior = new THREE.Mesh(parts.interior, matPlain);
  interior.name = 'interior';
  root.add(body, glass, interior);

  const wheels = [], spinners = [], pivots = [];
  for (const k of ORDER) {
    const p = parts.pivots[k];
    const hub = new THREE.Group(); hub.name = `hub${k}`;
    hub.position.copy(p);
    const spin = new THREE.Group(); spin.name = `spin${k}`;
    const w = new THREE.Mesh(parts.wheels[k], matPlain); w.castShadow = castShadow; w.receiveShadow = true; w.name = `wheel${k}`;
    const cal = new THREE.Mesh(parts.calipers[k], matPlain); cal.name = `caliper${k}`;
    spin.add(w); hub.add(spin, cal);
    root.add(hub);
    wheels.push(hub); spinners.push(spin); pivots.push(p.clone());
  }

  // reverse lamps: warm-white quads just proud of the reflectors, behind the clear lens
  const revMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const revColor = new THREE.Color(1, 0.96, 0.88);
  const reverseLamps = findReverseLamps(parts.body).map((b) => {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(b[2] - b[0], b[3] - b[1]), revMat);
    q.position.set((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, b[4] + 0.002); // the plane faces +Z (backward): no turn
    q.name = 'reverseLamp'; q.visible = false;
    root.add(q);
    return q;
  });

  let shadow = null;
  if (contactShadow) {
    const sm = new THREE.MeshBasicMaterial({
      color: 0x000000, alphaMap: contactTexture(), transparent: true, opacity: shadowOpacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    shadow = new THREE.Mesh(new THREE.PlaneGeometry(V.W * 1.12, V.L * 1.06).rotateX(-Math.PI / 2), sm);
    shadow.name = 'contactShadow'; shadow.renderOrder = 1; shadow.matrixAutoUpdate = false;
    shadow.position.y = 0.012; shadow.updateMatrix();
    root.add(shadow);
  }

  const lamps = { brake: 0, reverse: 0, uDark: 0 };
  const wr = spec.wheelRadius;
  const setDark = (u) => { matBody.userData.u.uDark.value = u; matPlain.userData.u.uDark.value = u; matGlass.userData.u.uDark.value = u; };

  /** @type {CarVisual} */
  const visual = {
    root, body, glass, interior, wheels, spinners, shadow, reverseLamps, spec, type,
    materials: { body: matBody, plain: matPlain, glass: matGlass },
    lamps,
    update(dt, car = null, o = {}) {
      dt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
      const W = car && car.wheels;
      // wheels: suspension travel, steer, roll
      for (let i = 0; i < 4; i++) {
        const hub = wheels[i];
        hub.position.y = wr + (W ? W[i].y || 0 : 0);
        if (i < 2) hub.rotation.y = car ? car.steerAngle || 0 : 0;
        spinners[i].rotation.x = car ? -(car.wheelSpin || 0) : 0;
      }
      // lamps
      const kb = dt > 0 ? 1 - Math.exp(-dt / 0.05) : 1;
      const bT = o.brake != null ? Math.min(1, Math.max(0, o.brake)) : car && car.braking ? 1 : 0;
      lamps.brake += (bT - lamps.brake) * kb;
      if (Math.abs(lamps.brake - bT) < 1e-3) lamps.brake = bT;
      if (brakeAttr.array[0] !== lamps.brake) { brakeAttr.array[0] = lamps.brake; brakeAttr.needsUpdate = true; }
      const rT = (o.reverse != null ? o.reverse : car && car.reversing) ? 1 : 0;
      lamps.reverse += (rT - lamps.reverse) * kb;
      if (Math.abs(lamps.reverse - rT) < 1e-3) lamps.reverse = rT;
      for (const q of reverseLamps) q.visible = lamps.reverse > 0.01;
      revMat.color.copy(revColor).multiplyScalar(0.3 + 2.7 * lamps.reverse);
      const d = Number.isFinite(o.darkness) ? o.darkness : 0;
      const auto = Math.min(1, Math.max(0, (d - 0.12) / 0.45));
      const u = o.lights === true ? Math.max(auto, 0.35) : o.lights === false ? 0 : auto;
      if (u !== lamps.uDark) { lamps.uDark = u; setDark(u); }
      // contact shadow: plane through the four wheel supports (car frame), faded by the mean gap
      if (shadow) {
        let gap = 0;
        _c.set(0, 0, 0);
        for (let i = 0; i < 4; i++) {
          const g = car && car.wheelGaps ? Math.max(0, car.wheelGaps[i] || 0) : 0;
          gap += g / 4;
          _c.x += pivots[i].x / 4; _c.z += pivots[i].z / 4;
          _c.y += ((W ? W[i].y || 0 : 0) - g) / 4;
        }
        // normal from the diagonals FL-RR and FR-RL
        const sy = (i) => (W ? W[i].y || 0 : 0) - (car && car.wheelGaps ? Math.max(0, car.wheelGaps[i] || 0) : 0);
        _a.set(pivots[3].x - pivots[0].x, sy(3) - sy(0), pivots[3].z - pivots[0].z);
        _b.set(pivots[2].x - pivots[1].x, sy(2) - sy(1), pivots[2].z - pivots[1].z);
        _n.crossVectors(_a, _b);
        if (_n.y < 0) _n.negate();
        if (_n.lengthSq() < 1e-10) _n.set(0, 1, 0); else _n.normalize();
        _q.setFromUnitVectors(_UP, _n);
        const fade = Math.max(0, 1 - gap / 1.5), spread = 1 + gap * 0.35;
        shadow.material.opacity = shadowOpacity * fade * fade;
        shadow.visible = fade > 0.01;
        _c.addScaledVector(_n, 0.012);
        shadow.matrix.compose(_c, _q, _a.set(spread, 1, spread));
        shadow.matrixWorldNeedsUpdate = true;
      }
    },
    setColor(c) { body.setColorAt(0, new THREE.Color(c)); body.instanceColor.needsUpdate = true; },
    dispose() {
      for (const g of [parts.body, parts.glass, parts.interior, ...Object.values(parts.wheels), ...Object.values(parts.calipers)]) g.dispose();
      for (const q of reverseLamps) q.geometry.dispose();
      if (shadow) { shadow.geometry.dispose(); shadow.material.dispose(); }
      for (const m of [matBody, matPlain, matGlass, revMat]) m.dispose();
    },
  };
  visual.update(0, null);
  return visual;
}
