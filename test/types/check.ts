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
import { AudioBus, SoundBank, Footsteps, SOUND_PRESETS, audioSelfTest, encodeWav, analyseMix, dsp } from '@vibe/engine/audio';
import type { SoundVoice, LoopHandle, SelfTestReport, SoundPreset } from '@vibe/engine/audio';
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
const lighter: boolean = q.lighter, losses: number = q.contextLosses; void lighter; void losses;
const harnessQ = createBenchHarness(engine2, { name: 'q', quality: q }); const tierQ: string | undefined = harnessQ.quality?.tier; void tierQ;

// start-up: warmUp() before start(); the lost-context and frame-error hooks; notices
async function startUp() {
  const w = await engine.warmUp({ frames: 4, systems: true });
  const fence: 'signaled' | 'timeout' | 'none' | 'lost' = w.fence, wasLost: boolean = w.lost;
  void fence; void wasLost;
  if (!engine.contextLost) engine.start();
  engine.onContextLost = (event: Event | null) => { void event; engine.showContextLost(); };
  engine.onFrameError = (error: unknown) => { engine.showFrameError(error); };
  const el: HTMLElement | null = engine.showNotice('Paused', { button: 'Resume', onButton: () => engine.start() });
  void el;
}
void startUp;

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

// world helpers outside MapWorld: trees on a height function, lamp / vehicle glow uniforms
import { buildTreeMeshes, createFurnitureMaterial, createVehicleMaterial } from '@vibe/engine/world';
const trees = buildTreeMeshes([{ x: 0, z: 0, s: 1, hue: 0.5, kind: 'park', ctx: { park: 'park' } }], { groundAt: (x: number, z: number) => 0.1 * x + 0.1 * z, mix: { park: [['oak', 1]] } });
if (trees.group) engine.scene.add(trees.group);
trees.update(1 / 60, engine.camera.position, 0, 2.5);
const treeCount: number = trees.count; void treeCount;
createFurnitureMaterial().userData.u.uNight.value = 1;
createVehicleMaterial({ hd: true }).userData.u.uDark.value = 1;

// sound kit: safe master, bank, footsteps, self-test
const kitBus = new AudioBus({ master: 'safe', volume: 0.7 });
kitBus.setPaused(true, 0.2); kitBus.setMuffle(0.5); kitBus.duck('ambience', 0.5, 3.5);
const sfx = new SoundBank(kitBus, { listener: new THREE.PerspectiveCamera(), seed: 1 });
const hit: SoundVoice = sfx.play('impact.metal', { at: new THREE.Vector3(1, 0, 2), gain: 0.8, rate: 1 });
hit.stop(0.1);
const bed: LoopHandle = sfx.loop('amb.dusk', { gain: 0.14 });
bed.setGain(0.2).setRate(1).stop(0.5);
sfx.update(1 / 60);
const kitSamples: Float32Array = sfx.render('step.wood', 2);
const roarPreset: SoundPreset = SOUND_PRESETS['road.roar'];
const steps = new Footsteps(sfx, { surface: 'grass', at: new THREE.Object3D() });
const stepPlayed: string = steps.update(1 / 120, { speed: 2, grounded: true, landed: false, landingSpeed: 0 });
const kitWav: Uint8Array = encodeWav([kitSamples, kitSamples], 44100);
const kitMix = analyseMix([kitSamples], 44100, { peak: 0.9 });
const kitCentroid: number = dsp.spectralCentroid(kitSamples, 44100) + roarPreset.peak + kitMix.peak + kitWav.length + stepPlayed.length;
const kitReport: Promise<SelfTestReport> = audioSelfTest({ seconds: 2, build: (b) => { const s = new SoundBank(b); return (t: number) => { if (t > 1) s.play('ui.click'); }; } });
void kitReport; void kitCentroid;
new VehicleAudio({ volume: 0.6, ambience: false, wind: false, tyres: false });

// ui: the game shell
import { GameShell, createSettings, LoadingScreen } from '@vibe/engine/ui';
const shell = new GameShell({ title: 'T', controls: [['W', 'Go']], storageKey: 't', defaults: { volume: 0.5, assist: true }, pauseCorner: 'tl' });
shell.setProgress(0.5, 'Loading').use({ engine, audio: kitBus, inputs: [{ enabled: true }] });
const shellState: 'loading' | 'title' | 'playing' | 'paused' = shell.state; void shellState;
void shell.ready().then(() => shell.pause());
// ready() runs engine.warmUp() and engine.start(); a boot error on the loading screen; stepped aside after a lost context
const shellLost: boolean = shell.lost, shellWarmFence: string | undefined = shell.warm?.fence; void shellLost; void shellWarmFence;
shell.error('Failed to start').setProgress(1);
shell.onStart(() => {}).onPause((paused: boolean) => { void paused; }).addToggle('assist', 'Assist').addSlider('fov', 'Field of view', { min: 50, max: 90, step: 1 });
const offAssist: () => void = shell.settings.on('assist', (v) => { void v; }); offAssist();
const store = createSettings('k.settings', { a: 1 }, { version: 2 }); store.set('a', 2);
new LoadingScreen({ title: 'T', compositor: true }).setProgress(0.5);

// drive feel: steering assist, tyre marks and smoke, rumble
import { SteeringAssist, VehicleHaptics, VehicleInput as DriveInput, type SteeringAssistOptions } from '@vibe/engine/input';
import { TyreFx, type TyreFxOptions } from '@vibe/engine/render';
import { VehicleController as DriveCar, ROAD_CAR_SPEC as DRIVE_SPEC } from '@vibe/engine/physics';
{
  const car = new DriveCar(DRIVE_SPEC);
  const input = new DriveInput(undefined, { assist: { peak: 0.95 } });
  input.update(1 / 60, car);
  const steer: number = input.steer + input.rawSteer;
  input.assist.enabled = false;
  const ao: SteeringAssistOptions = { fadeSpeed: [6, 12], slideCatch: [0.85, 1.65] };
  const out: number = new SteeringAssist(ao).apply(1 / 60, 0.5, car, true, false);
  const tyre: number = car.steerLimit + car.slipFront + car.slipRear + car.slipPeakFront + car.slipPeakRear + car.wheels[0].slideHeat;
  const fo: TyreFxOptions = { budget: { marks: 800, smoke: 120, rate: 20 }, lift: 0.04 };
  const fx = new TyreFx(fo);
  fx.update(1 / 60, car, null); fx.clear();
  const level: number = fx.markLevel[0] + fx.smokeLevel[0] + fx.stats.puffs;
  const rumble = new VehicleHaptics({ gain: 0.8 }).update(1 / 60, car, null);
  const weak: number = rumble.weak + rumble.strong;
  void steer; void out; void tyre; void level; void weak;
}

// car and camera: an HD car body on its physics, a chase camera with road feel, trauma, a landing dip
import { createCarVisual, carSpecFor, type CarVisual } from '@vibe/engine/world';
import { ROAD_FEEL, type ChaseFeel } from '@vibe/engine/camera';
const visual: CarVisual = createCarVisual('hatchback', { color: 0x9e1416 });
const vcar = new VehicleController(visual.spec);
visual.update(1 / 60, vcar, { darkness: 0.4 });
visual.update(1 / 60, null, { brake: 1, reverse: false, lights: true });
const suvSpec = carSpecFor('suv'); void suvSpec;
const roadChase = new ChaseRig(engine.camera, null, { physics, feel: 'road' });
const tuned = new ChaseRig(engine.camera, null, { feel: { sway: 0.4, lagCap: 0.3 } as Partial<ChaseFeel> });
roadChase.addTrauma(0.5).addTrauma(0.2); void tuned; void ROAD_FEEL.surge;
const tpDip = new ThirdPersonRig(engine.camera, null, { landingDip: 1, sprintFov: 6 });
tpDip.land(4.4);

// the round's look options: weathering, a lit cloud deck and twilight key, lit foliage, facade detail, PostFX look,
// lamp spots (all off unless asked for)
import { weathering, applyPatches, bakeWeathering, WEATHERING_DEFAULTS, DEFAULT_TWILIGHT_KEY, DEFAULT_LOW_SUN_ENV } from '@vibe/engine/render';
import { applyFoliageLighting, applyFoliageLightingTo, enableFacadeDetail, createFacadeMaterials, DEFAULT_FOLIAGE_LIGHT } from '@vibe/engine/world';
const wallMat = new THREE.MeshStandardMaterial();
applyPatches(wallMat, [weathering({ grime: 0.4, streaks: 0.35, ground: 'origin', seed: 2 })]);
void bakeWeathering; void WEATHERING_DEFAULTS.grime; void DEFAULT_TWILIGHT_KEY.intensity; void DEFAULT_LOW_SUN_ENV.warm;
const lookAtmo = new Atmosphere({ scene: engine.scene, renderer: engine.renderer, camera: engine.camera, timeOfDay: 'dusk', cloudStyle: 'lit', lowSunEnv: true, twilightKey: { intensity: 0.9 } });
void lookAtmo;
const leafU = applyFoliageLighting(new THREE.MeshStandardMaterial(), { wrap: 0.5 });
const leafN: number = applyFoliageLightingTo(engine.scene, true, (m, o) => o.name.startsWith('veg-') && !!m);
void leafU; void leafN; void DEFAULT_FOLIAGE_LIGHT.rim;
void enableFacadeDetail; void createFacadeMaterials;
const lookFx = new PostFX(engine.renderer, engine.scene, engine.camera, { look: { aoLit: 0.8, aoTint: [0, 0.03, 0.07], lift: [0.002, 0.003, 0.004] }, taa: { sharpen: 0.25 } });
lookFx.set('look.aoLit', 0.6);
const spotPool = new NearestLights({ count: 4, mode: 'clustered', spot: { cosInner: 0.82, cosOuter: 0.12 } });
void spotPool;
// the fix pass: a spot's near shield (metres; the spot's decay must stay below 8), and the starters' scenery
const shieldPool = new NearestLights({ count: 4, mode: 'clustered', clustered: lights, spot: { cosInner: 0.82, cosOuter: 0.12, near: 5 } });
void shieldPool;
lights.setSpot(0, 0, 6, 0, 30, 1, 0.8, 0.6, 2, 0, -1, 0, 0.82, 0.12, 5);
import { countryRoad, parkCorner, groundCover, paintedLines, COVER_MAX_SEGMENTS, type SceneryResult, type CoverPath } from '@vibe/engine/world';
const road = countryRoad({ physics, width: 10, layby: { from: 10, to: -110, width: 7 }, trackName: 'Mill Lane', seed: 3 });
const roadSurfaces: number = road.surfaces.length; void roadSurfaces;
const park: SceneryResult = parkCorner({ physics, lamp: [3, -6] });
park.update(0.016, engine.camera.position, 0.5);
const parkPaths: CoverPath[] = park.paths;
applyPatches(wallMat, [groundCover({ paths: parkPaths, scale: 1, amount: 1 })]);
const paint: THREE.Mesh = paintedLines([{ x: 0, from: 0, to: -40, dash: [3, 9] }]); void paint;
const coverMax: number = COVER_MAX_SEGMENTS + park.counts.trees + road.counts.posts; void coverMax;

// per-building descriptors (a city's landmarks.json): matching, inference, the builder's opt-in, the vertex info packers
import { applyBuildingDescriptors, validateLandmarks, resolveDescriptor, inferDescriptor, signRuns, planRing, packGrid, packSurf, rgb555, tintFor, BuildingBuilder, ARCHETYPES, CROWN_TYPES } from '@vibe/engine/world';
const landmarks = { v: 1, city: 'atlanta', buildings: [{ match: { name: 'Westin Peachtree Plaza', at: [-84.3877, 33.7595] }, archetype: 'cylinder-tower', height: 220, night: { sign: { text: 'WESTIN', color: '#ffffff' } } }] };
const cityData = { center: { lat: 33.75, lon: -84.39 }, buildings: [{ p: [[0, 0], [30, 0], [30, 30], [0, 30]], h: 200, n: 'Westin Peachtree Plaza' }] };
validateLandmarks(landmarks);
const matchRes = applyBuildingDescriptors(cityData, landmarks, { offset: { x: 0, z: 0 } });
const matchedN: number = matchRes.matched + matchRes.suppressed + matchRes.unmatched.length; void matchedN;
const describing = new BuildingBuilder({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, { infer: true });
const fpDesc = describing.footprint(cityData.buildings[0]);
void inferDescriptor(cityData.buildings[0], fpDesc!); void resolveDescriptor({ archetype: 'stone-tower' });
const runW: number = signRuns('WESTIN').w + planRing(cityData.buildings[0].p, { plan: 'octagon' }, 900).length; void runW;
const packed: number = packGrid({ pier: 0.3, span: 0.4, emph: 2, kind: 0, lit: 0.3 }) + packSurf({ metal: 1, rough: 0.3, glow: 2, pat: 1 }) + rgb555([1, 0.7, 0.2]) + tintFor([0.6, 0.4, 0.3])[0]; void packed;
const archetypeNames: string[] = [...ARCHETYPES, ...CROWN_TYPES]; void archetypeNames;
const worldWithLandmarks = new MapWorld({ scene: engine.scene, renderer: engine.renderer, buildings: { landmarks, infer: true } }); void worldWithLandmarks;
// people: finish a rigged character, per-person variety, contact shadows under a crowd
import { finishPerson, personLight, personVariety, clothMatrix, smoothNormals, mergePersonParts, ContactShadows, DEFAULT_PERSON_LIGHT, type FinishPersonOptions } from '@vibe/engine/world';
const personModel = new THREE.Group();
const personLook = personVariety(Math.random);
const personOpts: FinishPersonOptions = { height: 1.76 * personLook.height, build: personLook.build, clothes: personLook.clothes, light: { rim: 1.2 }, smooth: 'auto', cull: true };
const person = finishPerson(personModel, personOpts);
const personHeight: number = person.height + person.materials.length + person.meshes.length; void personHeight;
const personU = personLight(new THREE.MeshStandardMaterial(), { wrap: DEFAULT_PERSON_LIGHT.wrap }, { mask: false });
if (personU) personU.uPeople.value.x = 0.5;
const clothM: THREE.Matrix3 = clothMatrix({ hue: 0.4, sat: 0.8, tint: 0xb9bcc4 }); void clothM;
const smoothed: number = smoothNormals(new THREE.BoxGeometry(1, 1, 1), 1.15, false); void smoothed;
const mergedParts: THREE.SkinnedMesh[] = mergePersonParts(personModel, { Shirt: 0x334455 }); void mergedParts;
const personShadows = new ContactShadows({ parent: engine.scene, max: 16, opacity: 0.8 });
const personSlot: number = personShadows.add(personModel, person.model, { radius: 0.6 });
personShadows.update((x, z) => x * 0 + z * 0);
personShadows.update(0);
personShadows.opacity = 0.5;
personShadows.remove(personSlot);
personShadows.dispose();
