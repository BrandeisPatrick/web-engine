// Dev-only turntable for the hero car (not part of the build): ?lod=low, ?az=deg, ?el=deg, ?d=m, ?lights=1
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCarModel } from './car-model.js';
const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x30343a);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xfff0dd, 2.5); sun.position.set(-4, 6, -3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.6 }));
ground.receiveShadow = true; scene.add(ground);
const model = buildCarModel({ lod: q.get('lod') || 'high' });
scene.add(model.root); for (const w of model.wheels) { model.root.add(w.root); w.root.rotation.y = w === model.wheels[0] || w === model.wheels[1] ? +(q.get('steer') || 0) : 0; }
if (q.get('lights')) { model.lamps.uHead.value = 1; model.lamps.uTail.value = 1; model.lamps.uBrake.value = +(q.get('brake') || 0); }
console.log('car stats', JSON.stringify(model.stats));
const cam = new THREE.PerspectiveCamera(+(q.get('fov') || 35), innerWidth / innerHeight, 0.1, 100);
const az = (+(q.get('az') ?? 35)) * Math.PI / 180, el = (+(q.get('el') ?? 12)) * Math.PI / 180, d = +(q.get('d') || 8);
cam.position.set(Math.sin(az) * Math.cos(el) * d, 0.6 + Math.sin(el) * d, -Math.cos(az) * Math.cos(el) * d);
cam.lookAt(0, 0.6, 0);
renderer.setAnimationLoop(() => renderer.render(scene, cam));
window.__viewer = { model, scene, cam, renderer };
