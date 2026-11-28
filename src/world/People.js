// People: make rigged character models read as people, one hero or a sidewalk crowd.
//
//   const model = gltf.instantiate();                       // a GLB with a skinned mesh and clips (core/Assets)
//   finishPerson(model, { height: 1.8 });                   // 1.8 m tall, feet at y = 0, people lighting, culling bounds
//   model.rotation.y = Math.PI;                             // the GLBs face +Z, the engine's forward is -Z
//   scene.add(new THREE.Group().add(model));
//
//   // a crowd: one look per person, one draw call of contact shadows for all of them
//   const look = personVariety(rand);                       // { height, build, clothes: { top, legs } }
//   finishPerson(model, { height: 1.72 * look.height, build: look.build, clothes: look.clothes });
//   const shadows = new ContactShadows({ parent: scene, max: 16 });
//   shadows.add(holder, model);                             // holder: the object the game moves; model: has the feet
//   // per frame, after the mixers: shadows.update((x, z) => world.getGroundHeight(x, z));
//
// finishPerson(model, opts) does, in this order:
//   merge     flat-coloured, untextured parts that share one skeleton (a low-poly character exported with one
//             material per colour) become ONE vertex-coloured SkinnedMesh: one draw call. `recolour` maps a material
//             name to a colour first ({ Shirt: 0x334455 }). Off for textured models (nothing to merge)
//   smooth    faceted meshes get smooth normals: faces round a point are averaged unless they meet at more than
//             `crease` radians, so a low-poly body shades as a body while a shoe sole keeps its edge. Skin weights and
//             topology are not touched. 'auto' (default) leaves a mesh alone when its normals are smooth already
//   light     personLight on every material (below)
//   clothes   { top, legs }: each { hue (radians), sat, tint (colour) } recolours the cloth of a baked person (the
//             `_people` vertex attribute of tools/bake-people.mjs: r = cloth on the upper body, g = on the legs,
//             b = ambient occlusion). Clones the materials, so every person can differ; skin, hair and shoes stay
//   height    scales the model so its current pose is `height` metres tall, feet at y = 0, centred on x / z;
//             `build` (default 1) widens or narrows it (x and z) without changing the height
//   bounds    a bounding sphere round the skinned pose (radius * 1.3) so three can frustum-cull the person: skinned
//             meshes are otherwise drawn (and skinned) off screen too. `cull: false` keeps frustumCulled off
// It returns { model, height, materials, meshes }. Call it before the model goes into the scene (materials are
// replaced: the engine's clustered-light and G-buffer hooks classify a material when its object is added).
//
// personLight(material, { wrap, rim, ambient, ao }): what makes a figure read at dusk. A cloth-and-skin figure lit by
// plain Lambert goes black a few degrees past the terminator and melts into a dark street. The patch adds, per direct
// light (the sun, lamps, clustered lights: everything that goes through RE_Direct, shadowed like the light itself):
// `wrap` (light reaches past the terminator, a little warmer on skin) and `rim` (a soft bright edge where the surface
// turns away from the eye, strongest against the light: the figure separates from what is behind it); `ambient` lifts
// the sky light the figure receives (and gives it the same soft edge), `ao` scales the baked occlusion. MeshStandard /
// Physical materials only; idempotent; returns the uniforms ({ uPeople: Vector4 (wrap, rim, ambient, ao) }).
//
// ContactShadows: one InstancedMesh of ground quads, a soft blob under each person and a tighter one under each foot
// that fades as the foot lifts; they follow the feet bones. add(holder, model, { radius, feet: [left, right] }) ->
// index (the feet default to the bones named ...Foot with L / R); remove(index); update(ground) per frame with a
// height (number) or (x, z) => y; opacity (0..1); dispose(). One draw call, no texture, no allocation per update.
//
// personVariety(rand) -> { height (0.95..1.05), build (0.94..1.07), clothes } from a () => 0..1 generator: muted
// street colours for the top and the legs. smoothNormals(geometry, crease) and mergePersonParts(root, recolour) are
// exported for other uses. Imports three only (and BufferGeometryUtils); nothing here touches WebGL.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Default look of personLight: see the file header. */
export const DEFAULT_PERSON_LIGHT = { wrap: 0.45, rim: 0.9, ambient: 0.25, ao: 1 };

// ------------------------------------------------------------------------------------------------ normals
/**
 * Smooth normals for a faceted geometry: every vertex takes the angle-weighted mean of the faces that meet at its
 * position (whatever vertex they use) and lie within `crease` radians of its own faces. Positions, indices and skin
 * attributes are unchanged. Returns the mean change of a normal in radians (0 for a mesh that was smooth already).
 * @param {THREE.BufferGeometry} geometry
 * @param {number} [crease=1.15]  faces meeting at a sharper angle keep a hard edge (radians; about 66 degrees)
 * @param {boolean} [write=true]  false: only measure
 */
export function smoothNormals(geometry, crease = 1.15, write = true) {
  const P = geometry.attributes.position, I = geometry.index, n = P.count;
  const tris = (I ? I.count : n) / 3, at = (k) => (I ? I.getX(k) : k);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3()), q = 4096 / Math.max(size.x, size.y, size.z, 1e-9);
  // vertices at one position form a group
  const groupOf = new Uint32Array(n), keys = new Map();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(P.getX(i) * q)},${Math.round(P.getY(i) * q)},${Math.round(P.getZ(i) * q)}`;
    let g = keys.get(key); if (g === undefined) { g = keys.size; keys.set(key, g); }
    groupOf[i] = g;
  }
  // unit face normals; per position group the faces that meet there, each weighted by its corner angle (so the split
  // of a quad into triangles does not tilt the result)
  const fn = new Float32Array(tris * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const groupFaces = Array.from({ length: keys.size }, () => []), groupAngles = Array.from({ length: keys.size }, () => []), own = new Float32Array(n * 3);
  const corner = [0, 0, 0];
  for (let t = 0; t < tris; t++) {
    corner[0] = at(t * 3); corner[1] = at(t * 3 + 1); corner[2] = at(t * 3 + 2);
    a.fromBufferAttribute(P, corner[0]); b.fromBufferAttribute(P, corner[1]).sub(a); c.fromBufferAttribute(P, corner[2]).sub(a); b.cross(c);
    if (b.lengthSq() === 0) continue; // a degenerate face has no normal
    b.normalize(); fn[t * 3] = b.x; fn[t * 3 + 1] = b.y; fn[t * 3 + 2] = b.z;
    for (let k = 0; k < 3; k++) {
      const i = corner[k];
      a.fromBufferAttribute(P, i); _v.fromBufferAttribute(P, corner[(k + 1) % 3]).sub(a); c.fromBufferAttribute(P, corner[(k + 2) % 3]).sub(a);
      const angle = _v.angleTo(c);
      own[i * 3] += b.x * angle; own[i * 3 + 1] += b.y * angle; own[i * 3 + 2] += b.z * angle;
      groupFaces[groupOf[i]].push(t); groupAngles[groupOf[i]].push(angle);
    }
  }
  const N = geometry.attributes.normal, out = new Float32Array(n * 3), cos = Math.cos(crease);
  let change = 0, counted = 0;
  for (let i = 0; i < n; i++) {
    a.set(own[i * 3], own[i * 3 + 1], own[i * 3 + 2]);
    if (a.lengthSq() === 0) { if (N) { out[i * 3] = N.getX(i); out[i * 3 + 1] = N.getY(i); out[i * 3 + 2] = N.getZ(i); } continue; }
    a.normalize(); b.set(0, 0, 0);
    const faces = groupFaces[groupOf[i]], angles = groupAngles[groupOf[i]];
    for (let k = 0; k < faces.length; k++) {
      const t = faces[k];
      c.set(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]);
      if (c.dot(a) >= cos) b.addScaledVector(c, angles[k]);
    }
    if (b.lengthSq() === 0) b.copy(a); else b.normalize();
    out[i * 3] = b.x; out[i * 3 + 1] = b.y; out[i * 3 + 2] = b.z;
    if (N) { c.fromBufferAttribute(N, i); const l = c.length(); if (l > 0) { change += Math.acos(Math.min(1, Math.max(-1, c.dot(b) / l))); counted++; } }
  }
  if (write) geometry.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return counted ? change / counted : Math.PI;
}

// ------------------------------------------------------------------------------------------------ one draw call
/**
 * GLTFLoader splits a multi-material skinned mesh into sibling SkinnedMeshes (one per material) on one skeleton:
 * merge the untextured ones into ONE SkinnedMesh with vertex colours, so a flat-coloured person is one draw call.
 * `recolour` maps a material name to a colour (hex / THREE.Color); the others keep theirs. Returns the merged meshes.
 * @param {THREE.Object3D} root
 * @param {Record<string, THREE.ColorRepresentation>} [recolour]
 */
export function mergePersonParts(root, recolour = {}) {
  const byParent = new Map(), merged = [];
  root.traverse((o) => {
    if (!o.isSkinnedMesh || Array.isArray(o.material) || o.material.map) return;
    if (!byParent.has(o.parent)) byParent.set(o.parent, []);
    byParent.get(o.parent).push(o);
  });
  const c = new THREE.Color();
  for (const [parent, parts] of byParent) {
    // (a skinning-safe clone gives each part its own Skeleton object over the same bones: compare the bones)
    const first = parts[0], sameBones = (p) => p.skeleton.bones.length === first.skeleton.bones.length && p.skeleton.bones.every((b, i) => b === first.skeleton.bones[i]);
    if (parts.length < 2 || !parts.every(sameBones)) continue;
    const geos = parts.map((p) => {
      const g = p.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      if (recolour[p.material.name] !== undefined) c.set(recolour[p.material.name]); else c.copy(p.material.color);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const geometry = mergeGeometries(geos, false);
    if (!geometry) continue;
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, name: 'person' }));
    mesh.name = first.name; mesh.position.copy(first.position); mesh.quaternion.copy(first.quaternion); mesh.scale.copy(first.scale);
    mesh.bind(first.skeleton, first.bindMatrix);
    for (const p of parts) parent.remove(p);
    parent.add(mesh);
    merged.push(mesh);
  }
  return merged;
}

// ------------------------------------------------------------------------------------------------ light
const LIGHT_FROM = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}';
const LIGHT_TO = /* glsl */`reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	#ifdef PEOPLE_LIGHT
	{ // world/People.js personLight: uPeople = (wrap, rim, ambient, ao)
		float pNL = dot( geometryNormal, directLight.direction );
		float pWrap = saturate( ( pNL + uPeople.x ) / ( 1.0 + uPeople.x ) ) - saturate( pNL );
		float pEdge = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 3.0 );
		float pToward = saturate( dot( - geometryViewDir, directLight.direction ) );
		float pRim = pEdge * saturate( pNL + 0.6 ) * ( 0.35 + 0.65 * pToward ) * uPeople.y;
		reflectedLight.directDiffuse += directLight.color * ( BRDF_Lambert( material.diffuseColor ) * pWrap * mix( vec3( 1.0 ), vec3( 1.0, 0.5, 0.36 ), pSkin * 0.7 )
			+ pRim * ( material.diffuseColor * 0.5 + 0.02 ) );
	}
	#endif
}`;
const FRAG_PARS = /* glsl */`
uniform vec4 uPeople;
float pSkin = 0.0;
#ifdef PEOPLE_MASK
	uniform mat3 uPeopleTop;
	uniform mat3 uPeopleLegs;
	varying vec3 vPeople;
#endif
`;
const FRAG_COLOUR = /* glsl */`
#ifdef PEOPLE_MASK
	diffuseColor.rgb = mix( diffuseColor.rgb, max( uPeopleTop * diffuseColor.rgb, vec3( 0.0 ) ), vPeople.r );
	diffuseColor.rgb = mix( diffuseColor.rgb, max( uPeopleLegs * diffuseColor.rgb, vec3( 0.0 ) ), vPeople.g );
	pSkin = 1.0 - saturate( vPeople.r + vPeople.g );
#endif
`;
const FRAG_END = /* glsl */`
{
	float pEdgeA = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 3.0 );
	float pAO = 1.0;
	#ifdef PEOPLE_MASK
		pAO = mix( 1.0, vPeople.b, uPeople.w );
	#endif
	reflectedLight.indirectDiffuse *= ( 1.0 + uPeople.z + pEdgeA * uPeople.y ) * pAO;
	reflectedLight.directDiffuse *= mix( 1.0, pAO, 0.5 );
}
`;

/**
 * Light a material as a clothed figure (wrap, rim, lifted sky light; see the file header). Patches a
 * MeshStandardMaterial / MeshPhysicalMaterial in place, chaining its own onBeforeCompile and cache key; idempotent.
 * @param {THREE.Material} material
 * @param {boolean|Partial<typeof DEFAULT_PERSON_LIGHT>} [opts=true]  false: nothing
 * @param {{ mask?: boolean }} [o]  mask: the mesh has the `_people` attribute (cloth tints and baked occlusion)
 * @returns {{ uPeople: { value: THREE.Vector4 }, uPeopleTop: { value: THREE.Matrix3 }, uPeopleLegs: { value: THREE.Matrix3 } }|null}
 */
export function personLight(material, opts = true, { mask = false } = {}) {
  if (!opts || !material || !material.isMeshStandardMaterial) return null;
  if (material.userData.personLight) return material.userData.personLight;
  const f = { ...DEFAULT_PERSON_LIGHT, ...(opts === true ? {} : opts) };
  const U = {
    uPeople: { value: new THREE.Vector4(f.wrap, f.rim, f.ambient, f.ao) },
    uPeopleTop: { value: new THREE.Matrix3() }, uPeopleLegs: { value: new THREE.Matrix3() },
  };
  material.userData.personLight = U;
  material.defines = { ...(material.defines || {}), PEOPLE_LIGHT: '' };
  if (mask) material.defines.PEOPLE_MASK = '';
  const prev = material.onBeforeCompile;
  const ownKey = material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? material.customProgramCacheKey : null;
  const prevSrc = prev ? prev.toString() : '';
  material.onBeforeCompile = function (sh, renderer) {
    if (prev) prev.call(this, sh, renderer);
    Object.assign(sh.uniforms, U);
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    if (!chunk.includes(LIGHT_FROM)) { console.warn('[People] the lighting anchor is missing in this three.js: people are lit as plain materials'); return; }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n#ifdef PEOPLE_MASK\n\tattribute vec4 _people;\n\tvarying vec3 vPeople;\n#endif')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef PEOPLE_MASK\n\tvPeople = _people.rgb;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <lights_physical_pars_fragment>', chunk.replace(LIGHT_FROM, LIGHT_TO))
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOUR}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${FRAG_END}`);
  };
  material.customProgramCacheKey = function () { return (ownKey ? ownKey.call(this) : prevSrc) + '|people-light-v1'; };
  material.needsUpdate = true;
  return U;
}

const LUMA = [0.2126, 0.7152, 0.0722];
/**
 * A colour matrix for cloth: rotate the hue by `hue` radians about the grey axis, scale the saturation by `sat`, then
 * multiply by `tint`. Identity for { hue: 0, sat: 1, tint: white }.
 * @param {{ hue?: number, sat?: number, tint?: THREE.ColorRepresentation }} [o]
 * @param {THREE.Matrix3} [target]
 */
export function clothMatrix(o = {}, target = new THREE.Matrix3()) {
  const hue = o.hue ?? 0, sat = o.sat ?? 1, t = new THREE.Color(o.tint ?? 0xffffff);
  const c = Math.cos(hue), s = Math.sin(hue), k = 1 / 3, q = Math.sqrt(k);
  // rotation about (1, 1, 1) / sqrt(3) (Rodrigues), rows r0..r2
  const R = [
    c + k * (1 - c), k * (1 - c) - q * s, k * (1 - c) + q * s,
    k * (1 - c) + q * s, c + k * (1 - c), k * (1 - c) - q * s,
    k * (1 - c) - q * s, k * (1 - c) + q * s, c + k * (1 - c),
  ];
  // saturation: S = luma + sat * (I - luma)
  const m = new Array(9), tint = [t.r, t.g, t.b];
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
    let v = 0;
    for (let j = 0; j < 3; j++) v += (LUMA[j] * (1 - sat) + (r === j ? sat : 0)) * R[j * 3 + col];
    m[r * 3 + col] = v * tint[r];
  }
  return target.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
}

/** A person's variation from a () => 0..1 generator: height and build factors and muted street colours for the clothes. */
export function personVariety(rand = Math.random) {
  const pick = (a) => a[Math.min(a.length - 1, (rand() * a.length) | 0)];
  const height = 0.95 + rand() * 0.1, build = 0.94 + rand() * 0.13;
  // tops: mostly as photographed or a shade of it, some turned to another hue; legs: darker or lighter, hue kept
  const top = pick([
    {}, {}, { tint: 0xb9bcc4 }, { tint: 0x8d8f96 }, { hue: 0.5, sat: 0.8 }, { hue: -0.6, sat: 0.85 }, { hue: 2.1, sat: 0.55, tint: 0xd8d8d8 },
    { hue: -2.0, sat: 0.6, tint: 0xcfcfcf }, { sat: 0.25, tint: 0xa0a0a6 }, { hue: 1.1, sat: 0.7 }, { hue: 3.1, sat: 0.5, tint: 0xc8c4c0 },
  ]);
  const legs = pick([{}, {}, { tint: 0xa9acb4 }, { tint: 0x80838a }, { sat: 0.3, tint: 0x9a9a9a }, { hue: 0.25, sat: 0.7, tint: 0xc4c0b8 }, { sat: 0.5, tint: 0xd6d2cc }]);
  return { height, build, clothes: { top, legs } };
}

// ------------------------------------------------------------------------------------------------ finishPerson
const _box = new THREE.Box3(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();

/**
 * @typedef {object} FinishPersonOptions
 * @property {number} [height]  metres: scale the model to this height, feet at y = 0, centred on x / z
 * @property {number} [build=1]  x / z scale on top of the fit (0.94 slim .. 1.07 broad)
 * @property {boolean} [merge=true]  merge flat-coloured parts on one skeleton into one vertex-coloured mesh
 * @property {Record<string, THREE.ColorRepresentation>} [recolour]  material name -> colour, for the merged parts
 * @property {'auto'|boolean} [smooth='auto']  smooth normals on faceted meshes
 * @property {number} [crease=1.15]  radians: sharper edges stay hard
 * @property {boolean|Partial<typeof DEFAULT_PERSON_LIGHT>} [light=true]  personLight on the materials
 * @property {{ top?: object, legs?: object }} [clothes]  cloth colours of a baked person (clothMatrix options); clones the materials
 * @property {THREE.ColorRepresentation} [tint]  multiplies the base colour of textured materials without a cloth mask (clones them)
 * @property {boolean} [castShadow=true]
 * @property {boolean} [receiveShadow=true]
 * @property {boolean} [cull=true]  bounding spheres round the pose, frustum culling on
 */

/**
 * Finish a character model as a person (see the file header for each step). Call it on a clone that is not in the
 * scene yet.
 * @param {THREE.Object3D} model  holds the SkinnedMeshes (e.g. `gltf.instantiate()`)
 * @param {FinishPersonOptions} [o]
 * @returns {{ model: THREE.Object3D, height: number, materials: THREE.Material[], meshes: THREE.Mesh[] }}
 */
export function finishPerson(model, o = {}) {
  const { merge = true, smooth = 'auto', crease = 1.15, light = true, castShadow = true, receiveShadow = true, cull = true } = o;
  if (merge) mergePersonParts(model, o.recolour || {});
  const meshes = [], materials = [], owned = new Map();
  model.traverse((m) => { if (m.isMesh) meshes.push(m); });
  for (const mesh of meshes) {
    const g = mesh.geometry, masked = !!g.attributes._people;
    mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
    // normals: a geometry is smoothed once, whoever shares it (clones share geometries)
    if (smooth && !masked && !g.userData.personSmooth) {
      g.userData.personSmooth = true;
      if (smooth === true || smoothNormals(g, crease, false) > 0.1) smoothNormals(g, crease);
    }
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const out = list.map((src) => {
      // this person's own copy when its colours differ from the file's; otherwise the shared material, patched once
      const own = !!(o.clothes && masked) || (o.tint !== undefined && !masked && !!src.map);
      let mat = own ? owned.get(src) : src;
      if (!mat) {
        mat = src.clone(); owned.set(src, mat);
        delete mat.userData.personLight; // (clone() copies defines and userData but not the patch)
        if (mat.defines) { delete mat.defines.PEOPLE_LIGHT; delete mat.defines.PEOPLE_MASK; }
        if (!masked) mat.color.multiply(_c.set(o.tint));
      }
      if (mat.isMeshStandardMaterial) {
        // converted FBX characters come with metalness 0.4 on cloth, skin and hair: they mirror the sky as grey
        mat.metalness = 0; if (mat.roughness < 0.6) mat.roughness = 0.78;
        const U = personLight(mat, light, { mask: masked });
        if (U && own && masked) { clothMatrix(o.clothes.top, U.uPeopleTop.value); clothMatrix(o.clothes.legs, U.uPeopleLegs.value); }
      }
      if (!materials.includes(mat)) materials.push(mat);
      return mat;
    });
    mesh.material = Array.isArray(mesh.material) ? out : out[0];
  }
  // fit: the current pose's bounds (the bones' world matrices first, or skinned bounds are wrong)
  let height = 0;
  model.updateMatrixWorld(true);
  for (const mesh of meshes) if (mesh.isSkinnedMesh) mesh.boundingBox = null; // (recomputed from this pose below)
  _box.setFromObject(model);
  if (!_box.isEmpty()) {
    if (model.parent) _box.applyMatrix4(_m.copy(model.parent.matrixWorld).invert());
    height = _box.max.y - _box.min.y;
    if (o.height && height > 1e-6) {
      // scale about the model's origin, then put the box's centre over x = z = 0 and its floor on y = 0
      const k = o.height / height, b = (o.build ?? 1) * k, p = model.position;
      _box.getCenter(_v);
      const nx = -(_v.x - p.x) * b, ny = -(_box.min.y - p.y) * k, nz = -(_v.z - p.z) * b;
      model.scale.set(model.scale.x * b, model.scale.y * k, model.scale.z * b);
      p.set(nx, ny, nz);
      height = o.height;
      model.updateMatrixWorld(true);
    }
  }
  for (const mesh of meshes) {
    if (!cull) { mesh.frustumCulled = false; continue; }
    if (mesh.isSkinnedMesh) { mesh.computeBoundingSphere(); mesh.boundingSphere.radius *= 1.3; mesh.boundingBox = null; }
    mesh.frustumCulled = true;
  }
  return { model, height, materials, meshes };
}
const _c = new THREE.Color();

// ------------------------------------------------------------------------------------------------ contact shadows
const SHADOW_VS = /* glsl */`
attribute vec4 aFeet;
attribute vec3 aFade;
varying vec2 vP;
varying vec4 vFeet;
varying vec3 vFade;
void main() {
	vP = position.xz; vFeet = aFeet; vFade = aFade;
	vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4( position, 1.0 );
	gl_Position = projectionMatrix * mvPosition;
}`;
const SHADOW_FS = /* glsl */`
uniform float uOpacity;
varying vec2 vP;
varying vec4 vFeet;
varying vec3 vFade;
float pBlob( vec2 d, vec2 s ) { d /= s; return exp( - dot( d, d ) ); }
void main() {
	// the body: wide and soft; the feet: tight, long along the facing (the quad's z), fading as the foot lifts
	float body = 0.5 * pBlob( vP, vec2( 0.46 ) );
	float left = 0.85 * vFade.x * pBlob( vP - vFeet.xy, vec2( 0.2, 0.34 ) );
	float right = 0.85 * vFade.y * pBlob( vP - vFeet.zw, vec2( 0.2, 0.34 ) );
	float a = 1.0 - ( 1.0 - body ) * ( 1.0 - left ) * ( 1.0 - right );
	a *= smoothstep( 1.0, 0.7, length( vP ) ) * uOpacity * vFade.z;
	if ( a < 0.004 ) discard;
	gl_FragColor = vec4( 0.0, 0.0, 0.0, a );
}`;
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _im = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
const _f0 = new THREE.Vector3(), _f1 = new THREE.Vector3();

/** Soft ground shadows under a crowd, following each person's feet: one draw call (see the file header). */
export class ContactShadows {
  /**
   * @param {object} [o]
   * @param {THREE.Object3D} [o.parent]  where the mesh goes (the scene)
   * @param {number} [o.max=32]  people at most
   * @param {number} [o.opacity=0.7]
   * @param {number} [o.radius=0.6]  metres: half the size of a person's quad (the body blob is about half of it)
   * @param {number} [o.lift=0.015]  metres above the ground (no z-fighting)
   */
  constructor(o = {}) {
    this.max = o.max ?? 32; this.radius = o.radius ?? 0.6; this.lift = o.lift ?? 0.015;
    const g = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this._feet = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 4), 4);
    this._fade = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this._feet.setUsage(THREE.DynamicDrawUsage); this._fade.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aFeet', this._feet); g.setAttribute('aFade', this._fade);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: o.opacity ?? 0.7 } }, vertexShader: SHADOW_VS, fragmentShader: SHADOW_FS,
      transparent: true, depthWrite: false, toneMapped: false,
    });
    /** The InstancedMesh (one instance per person; count follows add / remove). */
    this.mesh = new THREE.InstancedMesh(g, this.material, this.max);
    this.mesh.name = 'contactShadows'; this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.people = [];
    if (o.parent) o.parent.add(this.mesh);
  }

  get opacity() { return this.material.uniforms.uOpacity.value; }
  set opacity(v) { this.material.uniforms.uOpacity.value = v; }

  /**
   * Shadow a person. holder: the object whose position and heading the game sets; model: where the feet are looked up.
   * @param {THREE.Object3D} holder
   * @param {THREE.Object3D} [model=holder]
   * @param {{ radius?: number, feet?: [THREE.Object3D, THREE.Object3D] }} [o]
   * @returns {number} the person's index (for remove), or -1 when the pool is full
   */
  add(holder, model = holder, o = {}) {
    if (this.people.length >= this.max) return -1;
    let feet = o.feet || null;
    if (!feet) {
      const found = [];
      model.traverse((b) => { if (b.isBone && /foot/i.test(b.name) && !/pole|target|ik/i.test(b.name)) found.push(b); });
      const side = (re) => found.find((b) => re.test(b.name));
      feet = [side(/(^|[^a-z])l([^a-z]|$)|left/i), side(/(^|[^a-z])r([^a-z]|$)|right/i)];
      if (!feet[0] || !feet[1]) feet = null;
    }
    // the feet's height above the holder in the standing pose (the ankle is not on the ground)
    let rest = 0;
    if (feet) { holder.updateWorldMatrix(true, true); const y0 = _p.setFromMatrixPosition(holder.matrixWorld).y; rest = Math.min(_p.setFromMatrixPosition(feet[0].matrixWorld).y, _p.setFromMatrixPosition(feet[1].matrixWorld).y) - y0; }
    this.people.push({ holder, feet, rest, radius: o.radius ?? this.radius, visible: true });
    this.mesh.count = this.people.length;
    return this.people.length - 1;
  }

  /** Stop shadowing person `index` (the last person takes its slot: indices above it shift by that swap). */
  remove(index) {
    if (index < 0 || index >= this.people.length) return;
    this.people[index] = this.people[this.people.length - 1]; this.people.pop();
    this.mesh.count = this.people.length;
  }

  /**
   * Follow the people. Call once per frame after the animation mixers and after the holders moved.
   * @param {number|((x: number, z: number) => number)} [ground=0]  ground height under a person
   */
  update(ground = 0) {
    const feet = this._feet.array, fade = this._fade.array, im = this.mesh.instanceMatrix.array;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i], h = p.holder;
      h.updateWorldMatrix(true, false);
      h.matrixWorld.decompose(_p, _q, _s);
      let x = _p.x, z = _p.z; const hy = _p.y, r = p.radius;
      const yaw = _e.setFromQuaternion(_q, 'YXZ').y, c = Math.cos(yaw), s = Math.sin(yaw);
      if (p.feet) { // the body's blob sits between the feet (a clip may carry the body off the holder)
        p.feet[0].updateWorldMatrix(true, false); p.feet[1].updateWorldMatrix(true, false);
        _f0.setFromMatrixPosition(p.feet[0].matrixWorld); _f1.setFromMatrixPosition(p.feet[1].matrixWorld);
        x = (_f0.x + _f1.x) / 2; z = (_f0.z + _f1.z) / 2;
      }
      const gy = typeof ground === 'function' ? ground(x, z) : ground;
      // off the ground (a jump): the whole shadow fades and the feet let go
      const air = Math.max(0, hy - gy), whole = h.visible && p.visible ? Math.max(0, 1 - air / 1.2) : 0;
      _im.compose(_p.set(x, gy + this.lift, z), _q.setFromAxisAngle(_up, yaw), _s.set(r, 1, r)).toArray(im, i * 16);
      for (let f = 0; f < 2; f++) {
        let fx = (f ? 0.09 : -0.09) / r, fz = 0, lift = 0;
        if (p.feet) {
          const ft = f ? _f1 : _f0, dx = ft.x - x, dz = ft.z - z;
          fx = (dx * c - dz * s) / r; fz = (dx * s + dz * c) / r; // into the quad's frame (rotated by yaw about y)
          lift = Math.max(0, ft.y - gy - p.rest);
        }
        feet[i * 4 + f * 2] = fx; feet[i * 4 + f * 2 + 1] = fz;
        fade[i * 3 + f] = Math.max(0, 1 - lift / 0.22);
      }
      fade[i * 3 + 2] = whole;
    }
    this._feet.needsUpdate = true; this._fade.needsUpdate = true; this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() { if (this.mesh.parent) this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); this.material.dispose(); }
}
