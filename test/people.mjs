// Headless checks for the people helpers (src/world/People.js), the people baker's image code (tools/bake-people.mjs)
// and the baked files (samples/public/people/*.glb): smooth normals keep hard edges, flat-coloured parts merge into
// one skinned mesh, finishPerson fits / lights / bounds a model and gives a person its own cloth colours, the light
// patch finds its anchors in this three.js, contact shadows follow the feet, and every baked person stays inside the
// budget (triangles, joints, draw calls, bytes) with its clips, speeds and licence notice. No browser.
// Run: node test/people.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { finishPerson, personLight, personVariety, clothMatrix, smoothNormals, mergePersonParts, ContactShadows, DEFAULT_PERSON_LIGHT } from '../src/world/People.js';
import { PEOPLE, CLIPS, decodeTga, resizeImage, encodePng } from '../tools/bake-people.mjs';

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? '  ' + detail : ''}`);
}
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** A two-bone skinned figure: a box `h` tall on a root bone with a left and a right foot bone, in `parts` flat-coloured meshes. */
function figure({ h = 2, parts = 1, masked = false, textured = false, scale = 1 } = {}) {
  const root = new THREE.Group(), hips = new THREE.Bone(), footL = new THREE.Bone(), footR = new THREE.Bone();
  hips.name = 'Hips'; footL.name = 'Bip01_L_Foot'; footR.name = 'Bip01_R_Foot';
  hips.position.set(0, h / 2, 0); footL.position.set(-0.1, -h / 2 + 0.08, 0); footR.position.set(0.1, -h / 2 + 0.08, 0);
  hips.add(footL, footR); root.add(hips);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([hips, footL, footR]);
  const meshes = [];
  for (let i = 0; i < parts; i++) {
    const g = new THREE.BoxGeometry(0.5, h / parts, 0.3).translate(0, h / parts * (i + 0.5), 0).toNonIndexed();
    const n = g.attributes.position.count;
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Float32Array.from({ length: n * 4 }, (_, k) => (k % 4 === 0 ? 1 : 0)), 4));
    if (masked) g.setAttribute('_people', new THREE.Uint8BufferAttribute(Uint8Array.from({ length: n * 4 }, (_, k) => [255, 0, 255, 255][k % 4]), 4, true));
    const m = new THREE.MeshStandardMaterial({ color: [0x224466, 0x664422, 0x888888][i % 3], metalness: 0.4, roughness: 0.4, name: ['Shirt', 'Pants', 'Skin'][i % 3] });
    if (textured) m.map = new THREE.Texture();
    const mesh = new THREE.SkinnedMesh(g, m);
    mesh.bind(skeleton, new THREE.Matrix4());
    root.add(mesh); meshes.push(mesh);
  }
  root.scale.setScalar(scale);
  return { root, hips, footL, footR, meshes };
}

// ---- smooth normals
{
  const flat = new THREE.IcosahedronGeometry(1, 2); flat.computeVertexNormals(); // non-indexed: one normal per face
  const change = smoothNormals(flat);
  const N = flat.attributes.normal, P = flat.attributes.position, v = new THREE.Vector3(), p = new THREE.Vector3();
  let worst = 1;
  for (let i = 0; i < N.count; i++) worst = Math.min(worst, v.fromBufferAttribute(N, i).dot(p.fromBufferAttribute(P, i).normalize()));
  check('smoothNormals: a faceted sphere shades round', worst > 0.995 && change > 0.05, `worst n.r ${worst.toFixed(4)}, mean change ${change.toFixed(3)} rad`);
  check('smoothNormals: a second pass changes nothing', smoothNormals(flat, 1.15, false) < 1e-3);
  const box = new THREE.BoxGeometry(1, 1, 1), before = box.attributes.normal.array.slice();
  const boxChange = smoothNormals(box);
  check('smoothNormals: a box keeps its hard edges (90 degrees is past the crease)', boxChange < 1e-6 && box.attributes.normal.array.every((x, i) => near(x, before[i])));
  const soft = new THREE.BoxGeometry(1, 1, 1); smoothNormals(soft, 2);
  const c = new THREE.Vector3().fromBufferAttribute(soft.attributes.normal, 0);
  check('smoothNormals: with a wider crease the corners round', near(Math.abs(c.x), Math.abs(c.y), 1e-3) && near(Math.abs(c.y), Math.abs(c.z), 1e-3), c.toArray().map((x) => x.toFixed(2)).join(' '));
  const sphere = new THREE.SphereGeometry(1, 16, 12), posBefore = sphere.attributes.position.array.slice(), idx = sphere.index.array.slice();
  check('smoothNormals: a smooth mesh measures as smooth', smoothNormals(sphere, 1.15, false) < 0.05);
  smoothNormals(sphere);
  check('smoothNormals: positions and indices untouched', sphere.attributes.position.array.every((x, i) => x === posBefore[i]) && sphere.index.array.every((x, i) => x === idx[i]));
}

// ---- one draw call
{
  const f = figure({ parts: 3 });
  const total = f.meshes.reduce((s, m) => s + m.geometry.attributes.position.count, 0);
  const merged = mergePersonParts(f.root, { Shirt: 0xff0000 });
  const meshes = []; f.root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const g = meshes[0].geometry;
  check('merge: three flat parts on one skeleton become one skinned mesh', merged.length === 1 && meshes.length === 1 && meshes[0].isSkinnedMesh && meshes[0].skeleton.bones.length === 3);
  check('merge: every vertex kept, with skin weights and colours', g.attributes.position.count === total && !!g.attributes.skinIndex && !!g.attributes.skinWeight && !!g.attributes.color && meshes[0].material.vertexColors === true);
  const col = g.attributes.color;
  check('merge: recolour by material name', near(col.getX(0), 1) && near(col.getY(0), 0) && near(col.getZ(0), 0));
  check('merge: other parts keep their colour', near(col.getX(total - 1), new THREE.Color(0x888888).r, 1e-3));
  const t = figure({ parts: 2, textured: true });
  check('merge: textured parts are left alone', mergePersonParts(t.root).length === 0 && t.root.children.filter((o) => o.isMesh).length === 2);
}

// ---- finishPerson
{
  const f = figure({ h: 2, scale: 0.01 }); // a model in centimetre-like units
  f.root.position.set(0.3, 0, 0);
  const r = finishPerson(f.root, { height: 1.75, build: 1.1 });
  const holder = new THREE.Group().add(f.root); holder.updateMatrixWorld(true);
  for (const m of r.meshes) m.boundingBox = null;
  const box = new THREE.Box3().setFromObject(f.root);
  check('finish: fitted to the height with the feet at 0', near(box.max.y - box.min.y, 1.75, 1e-3) && near(box.min.y, 0, 1e-3), `${box.min.y.toFixed(4)} .. ${box.max.y.toFixed(4)}`);
  check('finish: centred on x / z, build widens only x and z', near((box.min.x + box.max.x) / 2, 0, 1e-3) && near((box.min.z + box.max.z) / 2, 0, 1e-3) && near((box.max.x - box.min.x) / (box.max.y - box.min.y), 0.5 / 2 * 1.1, 1e-3));
  const mesh = r.meshes[0], mat = r.materials[0];
  check('finish: shadows, culling bounds round the pose', mesh.castShadow && mesh.receiveShadow && mesh.frustumCulled && mesh.boundingSphere && mesh.boundingSphere.radius > 0);
  const s = mesh.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
  check('finish: the bounding sphere holds the whole figure', s.containsPoint(new THREE.Vector3(0, 0, 0)) && s.containsPoint(new THREE.Vector3(0, 1.75, 0)), `r ${s.radius.toFixed(2)} at y ${s.center.y.toFixed(2)}`);
  check('finish: cloth is not metal, people light on', mat.metalness === 0 && mat.roughness >= 0.6 && mat.defines.PEOPLE_LIGHT === '' && !('PEOPLE_MASK' in mat.defines) && !!mat.userData.personLight);
  check('finish: returns the height', r.height === 1.75);
  const again = finishPerson(figure().root, { cull: false, light: false, castShadow: false });
  check('finish: options off', again.meshes[0].frustumCulled === false && !again.materials[0].userData.personLight && again.meshes[0].castShadow === false && near(again.height, 2, 1e-3));

  // a faceted, flat-coloured character: one mesh, smooth normals
  const low = figure({ parts: 3 });
  for (const m of low.meshes) m.geometry = new THREE.IcosahedronGeometry(0.4, 1).translate(0, 1, 0), m.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(m.geometry.attributes.position.count * 4), 4)), m.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Float32Array.from({ length: m.geometry.attributes.position.count * 4 }, (_, k) => (k % 4 === 0 ? 1 : 0)), 4));
  const lr = finishPerson(low.root, { recolour: { Shirt: 0x112233 } });
  const ln = lr.meshes[0].geometry.attributes.normal, lp = lr.meshes[0].geometry.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3();
  let radial = 1; for (let i = 0; i < ln.count; i++) radial = Math.min(radial, a.fromBufferAttribute(ln, i).dot(b.fromBufferAttribute(lp, i).sub(new THREE.Vector3(0, 1, 0)).normalize()));
  check('finish: a low-poly character is merged and smoothed', lr.meshes.length === 1 && radial > 0.98, `worst n.r ${radial.toFixed(3)}`);

  // a baked person: cloth colours are this person's own
  const m1 = figure({ masked: true, textured: true }), shared = m1.meshes[0].material;
  const plain = finishPerson(m1.root, {});
  check('finish: without clothes the file\'s material is patched in place (masked)', plain.materials[0] === shared && shared.defines.PEOPLE_MASK === '');
  const m2 = figure({ masked: true, textured: true }); m2.meshes[0].material = shared;
  const dressed = finishPerson(m2.root, { clothes: { top: { tint: 0x808080 }, legs: { hue: 1 } } });
  const U = dressed.materials[0].userData.personLight;
  check('finish: clothes clone the material', dressed.materials[0] !== shared && dressed.materials[0].defines.PEOPLE_MASK === '' && dressed.materials[0].map === shared.map);
  check('finish: and set this person\'s cloth matrices only', !!U && U !== shared.userData.personLight && near(U.uPeopleTop.value.elements[0], new THREE.Color(0x808080).r, 1e-4) && shared.userData.personLight.uPeopleTop.value.elements[0] === 1);
  const hairy = figure({ parts: 2, textured: true }); hairy.meshes[1].material.alphaTest = 0.4;
  const hr = finishPerson(hairy.root, {});
  check('finish: alpha-tested hair cards do not cast shadows, the body does', hr.meshes[0].castShadow === true && hr.meshes[1].castShadow === false && hr.meshes[1].receiveShadow === true);
  const tinted = figure({ textured: true }), tsrc = tinted.meshes[0].material, tr = finishPerson(tinted.root, { tint: 0x808080 });
  check('finish: tint clones a textured material', tr.materials[0] !== tsrc && near(tr.materials[0].color.r, tsrc.color.r * new THREE.Color(0x808080).r, 1e-4));
}

// ---- the light patch: its anchors exist in this three.js
{
  const mat = new THREE.MeshStandardMaterial(), U = personLight(mat, { rim: 2 }, { mask: true });
  check('light: uniforms (wrap, rim, ambient, ao), options over the defaults', U.uPeople.value.x === DEFAULT_PERSON_LIGHT.wrap && U.uPeople.value.y === 2 && U.uPeople.value.w === DEFAULT_PERSON_LIGHT.ao);
  check('light: idempotent', personLight(mat) === U);
  check('light: only standard / physical materials', personLight(new THREE.MeshBasicMaterial()) === null && personLight(mat.clone(), false) === null);
  const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  const warn = console.warn; let warned = ''; console.warn = (m) => { warned = String(m); };
  mat.onBeforeCompile(sh, null);
  console.warn = warn;
  check('light: no missing anchor', warned === '', warned);
  check('light: vertex shader reads the mask', sh.vertexShader.includes('attribute vec4 _people;') && sh.vertexShader.includes('vPeople = _people.rgb;'));
  const fsrc = sh.fragmentShader;
  check('light: fragment shader has the wrap / rim block, the cloth colours and the ambient edge', fsrc.includes('uPeople.x') && fsrc.includes('pRim') && fsrc.includes('uPeopleTop * diffuseColor.rgb') && fsrc.includes('pEdgeA') && !fsrc.includes('#include <lights_physical_pars_fragment>'));
  check('light: shares the uniform objects with the program', sh.uniforms.uPeople === U.uPeople && sh.uniforms.uPeopleLegs === U.uPeopleLegs);
  check('light: its own program cache key', mat.customProgramCacheKey().includes('people-light') && mat.customProgramCacheKey() !== new THREE.MeshStandardMaterial().customProgramCacheKey());
  let chained = 0; const m2 = new THREE.MeshStandardMaterial(); m2.onBeforeCompile = () => { chained++; };
  personLight(m2); m2.onBeforeCompile({ uniforms: {}, vertexShader: sh.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader }, null);
  check('light: an earlier onBeforeCompile still runs', chained === 1);
}

// ---- cloth colours and variety
{
  const I = clothMatrix({}).elements;
  check('cloth: identity by default', [1, 0, 0, 0, 1, 0, 0, 0, 1].every((x, i) => near(I[i], x, 1e-6)));
  const grey = new THREE.Vector3(0.5, 0.5, 0.5).applyMatrix3(clothMatrix({ hue: 1.3, sat: 0.4 }));
  check('cloth: a hue turn keeps grey grey', near(grey.x, 0.5, 1e-5) && near(grey.y, 0.5, 1e-5) && near(grey.z, 0.5, 1e-5));
  const red = new THREE.Vector3(1, 0, 0).applyMatrix3(clothMatrix({ sat: 0 }));
  check('cloth: saturation 0 leaves the luma', near(red.x, 0.2126, 1e-4) && near(red.y, 0.2126, 1e-4) && near(red.z, 0.2126, 1e-4));
  const turned = new THREE.Vector3(1, 0, 0).applyMatrix3(clothMatrix({ hue: Math.PI * 2 / 3 }));
  check('cloth: a third of a turn takes red to another primary', near(turned.x + turned.y + turned.z, 1, 1e-5) && Math.max(turned.y, turned.z) > 0.99, turned.toArray().map((x) => x.toFixed(2)).join(' '));
  const t = new THREE.Vector3(1, 1, 1).applyMatrix3(clothMatrix({ tint: 0x804020 })), tc = new THREE.Color(0x804020);
  check('cloth: tint multiplies', near(t.x, tc.r, 1e-5) && near(t.y, tc.g, 1e-5) && near(t.z, tc.b, 1e-5));
  const a = personVariety(rng(7)), b = personVariety(rng(7)); let ok = true; const R = rng(99);
  for (let i = 0; i < 200; i++) { const v = personVariety(R); if (!(v.height >= 0.95 && v.height <= 1.05 && v.build >= 0.94 && v.build <= 1.07 && v.clothes.top && v.clothes.legs)) ok = false; }
  check('variety: seeded, within its ranges', JSON.stringify(a) === JSON.stringify(b) && ok);
}

// ---- contact shadows
{
  const sh = new ContactShadows({ max: 4, radius: 0.5, lift: 0.01 });
  const f = figure({ h: 2 }), holder = new THREE.Group().add(f.root);
  holder.position.set(10, 3, -4); holder.rotation.y = Math.PI / 2;
  const i = sh.add(holder, f.root);
  check('shadows: a person takes a slot, feet found by name', i === 0 && sh.mesh.count === 1 && sh.people[0].feet[0] === f.footL && sh.people[0].feet[1] === f.footR);
  sh.update(3);
  const m = new THREE.Matrix4().fromArray(sh.mesh.instanceMatrix.array, 0), p = new THREE.Vector3().setFromMatrixPosition(m);
  check('shadows: the quad lies on the ground between the feet', near(p.x, 10, 1e-4) && near(p.y, 3.01, 1e-5) && near(p.z, -4, 1e-4), p.toArray().map((x) => x.toFixed(3)).join(' '));
  const ft = sh.mesh.geometry.attributes.aFeet.array, fd = sh.mesh.geometry.attributes.aFade.array;
  check('shadows: feet in the quad\'s frame (left at -x, right at +x, whatever the heading)', near(ft[0], -0.2, 1e-3) && near(ft[1], 0, 1e-3) && near(ft[2], 0.2, 1e-3) && near(ft[3], 0, 1e-3), Array.from(ft.slice(0, 4)).map((x) => x.toFixed(3)).join(' '));
  check('shadows: both feet down, the whole shadow on', fd[0] === 1 && fd[1] === 1 && fd[2] === 1);
  f.footL.position.y += 0.11; f.footL.position.z += 0.3; sh.update(3);
  check('shadows: a lifted foot fades and its blob follows it', near(fd[0], 0.5, 1e-3) && fd[1] === 1 && ft[1] !== 0);
  holder.position.y = 3.6; sh.update(3);
  check('shadows: off the ground the whole shadow fades', near(fd[2], 0.5, 1e-3));
  holder.position.y = 3; sh.update((x, z) => (x > 5 ? 2.5 : 0));
  check('shadows: ground from a function', near(new THREE.Vector3().setFromMatrixPosition(m.fromArray(sh.mesh.instanceMatrix.array, 0)).y, 2.51, 1e-5));
  const g2 = new THREE.Group(); const j = sh.add(g2);
  sh.update(0);
  check('shadows: a holder without feet still gets a blob', j === 1 && sh.mesh.count === 2 && sh.mesh.geometry.attributes.aFade.array[5] === 1);
  sh.add(new THREE.Group()); sh.add(new THREE.Group());
  check('shadows: the pool is bounded', sh.add(new THREE.Group()) === -1 && sh.mesh.count === 4);
  sh.remove(0);
  check('shadows: remove frees a slot', sh.mesh.count === 3 && sh.people.length === 3);
  sh.opacity = 0.4;
  check('shadows: opacity, one transparent draw without depth writes', sh.material.uniforms.uOpacity.value === 0.4 && sh.material.transparent && !sh.material.depthWrite && sh.mesh.isInstancedMesh);
}

// ---- the baker's image code
{
  // 2 x 2, 24 bits, bottom-up, BGR: bottom row red, green; top row blue, white
  const tga = Buffer.concat([Buffer.from([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 24, 0]), Buffer.from([0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255])]);
  const im = decodeTga(tga);
  check('tga: decoded top-down as RGBA', im.width === 2 && im.height === 2 && Array.from(im.data).join() === [0, 0, 255, 255, 255, 255, 255, 255, 255, 0, 0, 255, 0, 255, 0, 255].join());
  const rle = Buffer.concat([Buffer.from([0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 32, 0x28]), Buffer.from([0x83, 10, 20, 30, 40])]);
  check('tga: run-length, 32 bits, top-down', Array.from(decodeTga(rle).data).join() === new Array(4).fill([30, 20, 10, 40]).flat().join());
  const big = { width: 4, height: 4, data: Uint8Array.from({ length: 64 }, (_, k) => (k % 4 === 3 ? 255 : (k >> 2) % 4 < 2 ? 100 : 200)) };
  const half = resizeImage(big, 2, 2);
  check('resize: area mean', half.data[0] === 100 && half.data[4] === 200 && half.data[3] === 255);
  const edge = resizeImage({ width: 2, height: 1, data: Uint8Array.from([200, 100, 50, 255, 0, 0, 0, 0]) }, 1, 1, true);
  check('resize: alpha-weighted colour (no dark fringe at a cut-out)', edge.data[0] >= 199 && edge.data[3] === 128, Array.from(edge.data).join(' '));
  const png = encodePng(big), ihdr = png.readUInt32BE(8) === 13 && png.toString('latin1', 12, 16) === 'IHDR';
  const idatLen = png.readUInt32BE(33), raw = zlib.inflateSync(png.subarray(41, 41 + idatLen));
  check('png: signature, header, the rows inflate', png.readUInt32BE(0) === 0x89504e47 && ihdr && png.readUInt32BE(16) === 4 && png.readUInt32BE(20) === 4 && raw.length === 4 * (4 * 4 + 1));
}

// ---- the baked people
{
  const dir = here('../samples/public/people/');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.glb')).sort();
  check('baked: one file per person of the baker\'s list', files.join() === PEOPLE.map((p) => `${p.id}.glb`).sort().join(), files.join(' '));
  const credits = fs.readFileSync(dir + 'CREDITS.md', 'utf8'), licence = fs.readFileSync(dir + 'LICENSE-Rocketbox.md', 'utf8');
  check('baked: the licence text ships next to the files', licence.includes('MIT License') && licence.includes('Copyright (c) 2020 Microsoft') && licence.includes('Permission is hereby granted'));
  const game = fs.readFileSync(here('../samples/nyc-night/pedestrians.js'), 'utf8'), list = /export const PEOPLE = \[([^\]]+)\]/.exec(game);
  const ids = list ? list[1].split(',').map((s) => s.trim().replace(/'/g, '')) : [];
  check('baked: the demo\'s list names files that exist', ids.length > 0 && ids.every((id) => files.includes(`${id}.glb`)), ids.join(' '));
  let total = 0;
  for (const f of files) {
    const b = fs.readFileSync(dir + f), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
    total += b.length;
    const prims = j.meshes.flatMap((m) => m.primitives), tris = prims.reduce((s, p) => s + j.accessors[p.indices].count / 3, 0);
    const person = (j.scenes[0].extras || {}).person || {}, clips = j.animations.map((a) => a.name);
    const pos = j.accessors[prims[0].attributes.POSITION];
    const problems = [];
    if (b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(8) !== b.length) problems.push('not a whole GLB');
    if (b.length > 1.2e6) problems.push(`${b.length} bytes`);
    if (prims.length > 2) problems.push(`${prims.length} primitives`);
    if (tris > 15000 || tris < 3000) problems.push(`${tris} triangles`);
    if (j.skins.length !== 1 || j.skins[0].joints.length > 64) problems.push(`${j.skins[0].joints.length} joints`);
    if (Object.keys(CLIPS).some((c) => !clips.includes(c))) problems.push(`clips ${clips}`);
    if (!(person.speed && person.speed.Walk > 1 && person.speed.Walk < 1.8 && person.speed.Run > 4 && person.speed.Idle === 0)) problems.push(`speeds ${JSON.stringify(person.speed)}`);
    if (!(person.height > 1.5 && person.height < 2 && near(pos.max[1] - pos.min[1], person.height, 0.02) && Math.abs(pos.min[1]) < 0.01)) problems.push(`height ${person.height}, y ${pos.min[1]} .. ${pos.max[1]}`);
    if (prims[0].attributes._PEOPLE === undefined || prims[0].attributes.COLOR_0 !== undefined) problems.push('mask attribute');
    if (!/MIT License/.test(j.asset.copyright) || !/Microsoft/.test(j.asset.copyright)) problems.push('copyright');
    if (j.materials.length !== prims.length || j.images.length !== prims.length) problems.push('one material and one image per primitive');
    if (!credits.includes(`\`${f}\``)) problems.push('not in CREDITS.md');
    check(`baked: ${f}`, problems.length === 0, problems.length ? problems.join('; ') : `${b.length} bytes, ${tris} triangles, ${prims.length} draw(s), ${j.skins[0].joints.length} joints, walk ${person.speed.Walk} m/s`);
  }
  check('baked: the set stays small', total < 7e6, `${(total / 1e6).toFixed(2)} MB in ${files.length} files`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall people checks passed');
process.exit(failures ? 1 : 0);
