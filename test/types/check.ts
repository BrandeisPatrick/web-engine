// Consumer check of the emitted declarations (npm run types:check): every subpath resolves through `paths` the way
// the package `exports` map it, the public constructors accept their documented options, and the .d.ts files
// themselves pass a strict compile (skipLibCheck off). Type-level only: nothing here runs.
import { Engine, PostFX, DynamicsWorld, Cloth, CharacterController, Atmosphere } from '@vibe/engine';
import { PhysicsWorld, FracturedBody, boxShape, Buoyancy, Rope, SoftBody, ParticleCollider } from '@vibe/engine/physics';
import { Events, Clock, createBenchHarness, Assets } from '@vibe/engine/core';
import { ClusteredLights, GBuffer, GpuParticleSystem } from '@vibe/engine/render';
import { AnimationController, Ragdoll, TwoBoneIK } from '@vibe/engine/anim';
import { InputMap } from '@vibe/engine/input';
import { ThirdPersonRig } from '@vibe/engine/camera';
import { AudioBus } from '@vibe/engine/audio';
import { Minimap } from '@vibe/engine/ui';
import { MapWorld } from '@vibe/engine/world';

const engine = new Engine({ container: document.body });
const physics = new PhysicsWorld({});
const dyn = new DynamicsWorld({ physics, maxParticles: 1024, substeps: 4 });
const id: number = dyn.addBody({ shape: boxShape(0.5, 0.5, 0.5), position: [0, 2, 0], mass: 10 });
dyn.setVelocity(id, 0, 0, 0, 0, 0, 0);
dyn.step(1 / 120);
Cloth.grid(dyn, { nx: 8, ny: 8, spacing: 0.1, position: [0, 1, 0], pins: ['top-left'] });
Rope.chain(dyn, { from: [0, 2, 0], to: [0, 0, 0], segments: 10 });
SoftBody.lattice(dyn, { shape: 'box', size: [0.5, 0.5, 0.5], resolution: 3, position: [1, 1, 0], mass: 5 });
dyn.addParticleSolver(new ParticleCollider(dyn, {}));
dyn.addParticleSolver(new Buoyancy(dyn, { fluid: { heightAt: (x: number, z: number, t: number) => 1 + 0.1 * Math.sin(x + z + t), density: 1000 } }));
const fb = new FracturedBody(dyn, { shape: boxShape(1, 1, 0.2), position: [0, 1, 0], pieces: 10, seed: 1, density: 600 });
fb.update();
const cc = new CharacterController({ radius: 0.35, height: 1.8 });
cc.attachDynamics(dyn, { pushMass: 120 });
const ev = new Events(); ev.on('x', () => {}); ev.emit('x');
const clock = new Clock(); clock.timeScale = 1;
const assets = new Assets({ base: '/' }); void assets;
const atmo: Atmosphere | null = null;
const fx = new PostFX(engine.renderer, engine.scene, engine.camera, { atmosphere: atmo, gbuffer: true, aa: 'taa', ssr: true });
fx.set('ssr.steps', 16);
fx.set('renderScale', 0.75);
fx.onInternalResize = (w: number, h: number) => { void w; void h; };
const internal: number = fx.internalWidth * fx.internalHeight * fx.renderScaleInEffect; void internal;
const lights = new ClusteredLights({ maxLights: 256 });
lights.update(engine.camera);
const rig = new ThirdPersonRig(engine.camera, null, { distance: 4 });
rig.update(0.016);
const harness = createBenchHarness(engine, { name: 'x', poses: {}, settings: {}, converge: { begin: () => {} } });
const conv: string = harness.converged(48, 4).hash; void conv;
void harness; void GBuffer; void GpuParticleSystem; void AnimationController; void Ragdoll; void TwoBoneIK; void InputMap; void AudioBus; void Minimap; void MapWorld;

// ---- wiring contracts a game relies on (the starters' calls, typed) ------------------------------------------------
import * as THREE from 'three';
import {
  PoseInterpolator, resolveQuality, type TierSettings, type QualityChoice,
} from '@vibe/engine/core';
import {
  VehicleController, ROAD_CAR_SPEC, ROADSTER_SPEC, sphereShape, type VehicleControls, type VehicleSpec, type AddBodyOptions,
} from '@vibe/engine/physics';
import {
  loadTextureSet, loadTextureManifest, NearestLights, registerRenderLoaders, type GltfAsset, type TextureSetResult,
} from '@vibe/engine/render';
import { NearestLights as WorldNearestLights } from '@vibe/engine/world';
import { type AnimationStateSpec, type BlendTreeSpec } from '@vibe/engine/anim';
import { ChaseRig, type ChaseTargetState, type ThirdPersonTargetState } from '@vibe/engine/camera';
import { VehicleAudio, type VehicleAudioState } from '@vibe/engine/audio';

// Engine hooks: renderFn(scene, camera, dt), onResize(width, height, pixelRatio)
engine.renderFn = (scene: THREE.Scene, camera: THREE.PerspectiveCamera, dt: number) => { void scene; void camera; fx.render(dt); };
engine.onResize = (w: number, h: number, pr: number) => fx.setSize(w, h, pr);

// quality tiers: settings is the tier shape, with room for a game's own groups
const q: QualityChoice = resolveQuality({ overrides: { desktop: { walk: { lamps: 6 } } } });
const S: TierSettings = q.settings;
const engine2 = new Engine({ container: document.body, ...S.engine });
const cascades: number = S.shadows.cascades;
const ao: boolean = S.passes.ao, clustered: boolean = S.lights.clustered, aniso: number = S.textures.anisotropy;
const lamps: number = S.walk.lamps; // a game's own group (any)
void engine2; void cascades; void ao; void clustered; void aniso; void lamps;

// Atmosphere: options form (legacy params optional); update(cameraPosition, dt)
const atmo2 = new Atmosphere({ scene: engine.scene, renderer: engine.renderer, camera: engine.camera, timeOfDay: 'dusk', shadows: S.shadows });
atmo2.update(engine.camera.position, 1 / 60);
atmo2.update(engine.camera.position);

// PostFX.track(object3d, opts?)
const n1: number = fx.track(new THREE.Group());
fx.track(new THREE.Mesh(), { clone: true });
void n1;

// loadTextureSet: options and result
async function textures() {
  const base = '/nyc/textures/';
  const manifest = await loadTextureManifest(base);
  const tex: TextureSetResult | null = await loadTextureSet('grass', { renderer: engine.renderer, base, manifest, basisPath: '/basis/', maps: ['map', 'normalMap'] });
  if (tex) {
    tex.map.repeat.set(80 / tex.size, 80 / tex.size);
    const mat = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap ?? null, roughnessMap: tex.roughnessMap ?? null, aoMap: tex.aoMap ?? null });
    void mat;
  }
}
void textures;

// glTF asset value from Assets: scene, animations, instantiate() -> Object3D; AnimationController descriptors
async function character() {
  registerRenderLoaders(assets, engine.renderer);
  assets.add('hero', { type: 'gltf', url: 'models/hero.glb' });
  await engine.load();
  const gltf = assets.get<GltfAsset>('hero');
  const model: THREE.Object3D = gltf.instantiate();
  const clips: THREE.AnimationClip[] = gltf.animations;
  const scene: THREE.Group = gltf.scene; void scene;
  const idle: AnimationStateSpec = { clip: 'Armature|Idle' };
  const tree: BlendTreeSpec = { type: '1d', param: 'speed', points: [{ at: 0, state: 'idle' }, { at: 2, state: 'walk' }] };
  const anim = new AnimationController(model, clips, {
    states: { idle, walk: { clip: 'Armature|Walk', markers: [{ at: 0.5, name: 'step' }] }, jump: { clip: clips[0], loop: false, onEnd: 'move' } },
    trees: { move: tree },
    transitions: { default: 0.15, 'move->jump': 0.05 },
  });
  anim.play('move');
}
void character;

// DynamicsWorld.addBody options
const crate: AddBodyOptions = { shape: boxShape(0.35, 0.35, 0.35), position: [0, 1, 0], density: 60, friction: 0.6, type: 'dynamic', kind: 'crate' };
const crateId: number = dyn.addBody(crate);
dyn.addBody({ shape: sphereShape(0.2), position: new THREE.Vector3(1, 2, 0), quaternion: new THREE.Quaternion(), type: 'kinematic' });
void crateId;

// PhysicsWorld.addStaticBox: positional and object forms
physics.addStaticBox(0, 0, 1, 2, 0, 1, 'wall');
physics.addStaticBox({ min: [0, 0, 0], max: [1, 2, 1], kind: 'wall' });
physics.addStaticBox({ center: new THREE.Vector3(0, 1, 0), size: [0.2, 2, 0.2] });

// VehicleController: spec fields, controls object, step(dt, controls, world), reset(position, heading, world)
const spec: VehicleSpec = { ...ROAD_CAR_SPEC, mass: 1200, motorPower: 150e3, vMax: 60, flight: false };
const car = new VehicleController(spec);
const roadster = new VehicleController(); void roadster;
const mass: number | undefined = ROADSTER_SPEC.mass; void mass;
car.reset(new THREE.Vector3(0, 0, 0), Math.PI / 2, physics);
const controls: VehicleControls = { throttle: 1, brake: 0, steer: -0.5, handbrake: false };
car.step(1 / 120, controls, physics);
car.step(1 / 120, { throttle: 0.5 });
const speedKmh: number = car.speed * 3.6; void speedKmh;

// render interpolation between fixed steps
const carMesh = new THREE.Group();
const smooth = new PoseInterpolator(car);
smooth.save(); smooth.apply(carMesh, 0.5).position.clone(); smooth.snap();

// camera rigs: setTarget(object3d, getState) and the state each rig reads
const chase = new ChaseRig(engine.camera, engine.renderer.domElement, { physics, canopyFromCollider: null, thinKinds: ['post'] });
const chaseState: ChaseTargetState = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0, mode: 'ground' };
chase.setTarget(carMesh, () => chaseState);
const walkerState: ThirdPersonTargetState = { facing: 0, speed: 0 };
rig.setTarget(new THREE.Group(), () => walkerState);

// VehicleAudio.update(dt, state)
const audio = new VehicleAudio({ volume: 0.6, ambience: false, topSpeed: 60 });
const aState: VehicleAudioState = { speedKmh: 0, rpmLike: 0.5, grounded: true, wheelSlip: 0 };
audio.update(1 / 60, aState);

// NearestLights: the render layer's class (the world layer re-exports it)
const lampPool = new NearestLights({ count: 1, color: 0xffb070, distance: 12, decay: 1.5, parent: engine.scene });
lampPool.setPositions([[0, 3, -5]]);
lampPool.update(1 / 60, { position: engine.camera.position }, 8);
const sameClass: typeof NearestLights = WorldNearestLights; void sameClass;
