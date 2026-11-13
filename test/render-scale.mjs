// Headless checks for PostFX renderScale (temporal upscaling) on a stub renderer (no WebGL: sizes, defines, shader
// texts, state sequences, allocation): validation; the effective scale (1 without TAA, the request kept); the
// internal size of the G-buffer and every pass before TAA, the output size of TAA and every pass after it, the camera
// jitter in internal pixels; the defines TAA_UPSCALE / FINAL_UPSCALE / MB_UPSCALE / DOF_UPSCALE only below 1, and at
// 1 every shader text byte for byte the one before renderScale existed (sha1 recorded from 3bba697); resize / TAA
// toggle / live renderScale / G-buffer rebuild sequences; render() allocation-free with upscaling on.
// Run: node test/render-scale.mjs
import crypto from 'node:crypto';
import * as THREE from 'three';
import { gate, bytesPerCall } from './helpers/alloc.mjs';
import { PostFX, FINAL_SHADER, FINAL_UPSCALE_FRAGMENT } from '../src/render/PostFX.js';
import { TAA_SHADER, TAA_UPSCALE_FRAGMENT, taaUpscaleMeanWeight } from '../src/render/passes/TAAPass.js';

let failures = 0;
const results = [];
function check(name, value, lo = 1, hi = lo) {
  if (typeof value === 'boolean') value = value ? 1 : 0;
  const ok = Number.isFinite(value) && value >= lo && value <= hi;
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(78)} ${value}`);
  return ok;
}
const note = (s) => results.push(`NOTE  ${s}`);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };
const sha1 = (t) => crypto.createHash('sha1').update(t).digest('hex');
let _sink = null;

// the texts every material carried before renderScale (3bba697), at scale 1 they must still be these
const SHA1_AT_3BBA697 = {
  taa: '9b4632858bf93e4d0a5748efb62be9d1433ab5a8', final: '57fc9b98110dd121711e2c7771e94701505b9a12',
  mbVelocity: 'f236145710ba70d9737ae1be7333626848b7b4eb', dofPrefilter: 'abf4c8c6845b3d0c9c59ba99564278f99e3d2fff',
  dofComposite: '519448d9919af8b78dcca0ca12df7513eb9e5b12',
};
const UPSCALE_DEFINES = ['TAA_UPSCALE', 'FINAL_UPSCALE', 'MB_UPSCALE', 'DOF_UPSCALE'];

const stub = () => {
  let bound = null;
  return {
    getSize: (v) => v.set(800, 450), getPixelRatio: () => 1, capabilities: { maxSamples: 4 },
    extensions: { has: () => true },
    toneMappingExposure: 1, autoClear: true, info: { autoReset: true, reset() {} },
    clear() {}, render() {}, getRenderTarget: () => bound, setRenderTarget(t) { bound = t; },
    getClearColor: (c) => c.setRGB(0, 0, 0), getClearAlpha: () => 1, setClearColor() {},
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
  };
};
const casMap = new THREE.Texture(), casMat = new THREE.Matrix4(), casLight = { shadow: { bias: -0.0005 } };
const atmoStub = () => ({
  darkness: 0, sunEl: 0.5, version: 0, skyCube: null,
  sunDir: new THREE.Vector3(0.3, 0.8, 0.2).normalize(), sunColor: new THREE.Color(1, 0.9, 0.8), sun: { intensity: 3 },
  fogParams: { haze: 0.0002, hazeK: 1 / 700, hazeBase: 0, mist: 0.0001, mistK: 1 / 40, sunScatter: 0.05 },
  setFogMode() {}, setFlareScale() {}, renderFlare() {},
  shadowCascadeInfo(out) {
    out.count = 1; out.packed = true; out.maps[0] = casMap; out.matrices[0] = casMat; out.lights[0] = casLight;
    return out;
  },
});
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
cam.position.set(0, 2, 10); cam.updateMatrixWorld();
const ALL = { gbuffer: true, ssr: { interval: 2 }, volumetric: true, motionBlur: 0.5, dof: true };
const make = (o) => new PostFX(stub(), scene, cam, { atmosphere: atmoStub(), ...o });
const size = (rt) => [rt.width, rt.height];
const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
const defs = (fx) => [fx.taaPass && fx.taaPass.material.defines, fx.finalPass.material.defines,
  fx.motionBlurPass && fx.motionBlurPass._velocityMat.defines, fx.dofPass && fx.dofPass._prefilterMat.defines,
  fx.dofPass && fx.dofPass._compositeMat.defines].filter(Boolean);
const anyUpscaleDefine = (fx) => defs(fx).some((d) => UPSCALE_DEFINES.some((k) => k in d));
// every target / pass at the size it should have: internal [w, h] before TAA, output [W, H] from TAA on
function sizesOk(fx, w, h, W, H) {
  const bad = [];
  const want = (what, got, exp) => { if (!eq(got, exp)) bad.push(`${what} ${got} != ${exp}`); };
  want('internal', [fx.internalWidth, fx.internalHeight], [w, h]);
  if (fx.gbuffer) want('gbuffer', size(fx.gbuffer.target), [w, h]);
  want('ao input', [fx.aoPass._size.x, fx.aoPass._size.y], [w, h]);
  if (fx.ssrPass) want('ssr input', [fx.ssrPass._w, fx.ssrPass._h], [w, h]);
  if (fx.volumetricPass) want('volumetric input', [fx.volumetricPass._W, fx.volumetricPass._H], [w, h]);
  if (fx.taaPass) {
    want('taa history', size(fx.taaPass._rt[0]), [W, H]);
    want('taa uRes', [fx.taaPass.material.uniforms.uRes.value.x, fx.taaPass.material.uniforms.uRes.value.y], [W, H]);
    want('taa input', [fx.taaPass.inputWidth, fx.taaPass.inputHeight], [w, h]);
  }
  if (fx.motionBlurPass) {
    want('motion blur out', size(fx.motionBlurPass._out), [W, H]);
    if (w !== W || h !== H) want('motion blur uInRes', [fx.motionBlurPass._inW, fx.motionBlurPass._inH], [w, h]);
  }
  if (fx.dofPass) want('dof out', size(fx.dofPass._out), [W, H]);
  want('final uRes', [fx.uniforms.uRes.value.x, fx.uniforms.uRes.value.y], [W, H]);
  if (bad.length) note(bad.join('; '));
  return bad.length === 0;
}
// render once, spying on the size history.begin() is given (the jitter's pixel size)
function beginSize(fx) {
  const h = fx.history, b = h.begin, seen = [];
  h.begin = function (w, hh) { seen.push(w, hh); return b.call(this, w, hh); };
  fx.render(0);
  h.begin = b;
  return seen;
}

// ================================================================================================= validation
{
  check('constructor: renderScale 0.4 / 1.2 / NaN / "0.8" throw',
      throws(() => make({ renderScale: 0.4 }), /renderScale/) && throws(() => make({ renderScale: 1.2 }), /renderScale/)
    && throws(() => make({ renderScale: NaN }), /renderScale/)
    && throws(() => make({ renderScale: '0.8' }), /renderScale/));
  const fx = make({ gbuffer: true, renderScale: 0.75 });
  check("get('renderScale') = the request", fx.get('renderScale') === 0.75);
  check("set('renderScale', 0.3 / 2 / null) throws, request kept",
      throws(() => fx.set('renderScale', 0.3), /\[0\.5, 1\]/) && throws(() => fx.set('renderScale', 2))
    && throws(() => fx.set('renderScale', null)) && fx.get('renderScale') === 0.75 && fx.renderScaleInEffect === 0.75);
  check('bounds 0.5 and 1 accepted',
      !throws(() => fx.set('renderScale', 0.5)) && !throws(() => fx.set('renderScale', 1)));
  fx.dispose();
}

// ================================================================================================= scale 1: as before
{
  for (const [name, o] of [['forward', {}], ['G-buffer, every pass', ALL]]) {
    const fx = make(o);
    fx.render(0); fx.render(0);
    check(`${name}: default renderScale 1, internal = drawing buffer`,
        fx.get('renderScale') === 1 && fx.renderScaleInEffect === 1 && fx.internalWidth === 800
        && fx.internalHeight === 450);
    check(`${name}: no upscale define`, !anyUpscaleDefine(fx));
    check(`${name}: sizes all 800x450`, sizesOk(fx, 800, 450, 800, 450));
    const m = { final: fx.finalPass.material.fragmentShader };
    if (fx.taaPass) {
      m.taa = fx.taaPass.material.fragmentShader;
      m.mbVelocity = fx.motionBlurPass._velocityMat.fragmentShader;
      m.dofPrefilter = fx.dofPass._prefilterMat.fragmentShader;
      m.dofComposite = fx.dofPass._compositeMat.fragmentShader;
    }
    check(`${name}: every shader text = 3bba697's (sha1)`,
        Object.entries(m).every(([k, t]) => sha1(t) === SHA1_AT_3BBA697[k]));
    if (fx.history) check(`${name}: jitter in drawing-buffer px`, beginSize(fx).join() === '800,450');
    fx.dispose();
  }
  check('exported texts: TAA / final = 3bba697, upscale variants differ',
      sha1(TAA_SHADER.fragmentShader) === SHA1_AT_3BBA697.taa
      && sha1(FINAL_SHADER.fragmentShader) === SHA1_AT_3BBA697.final
    && TAA_UPSCALE_FRAGMENT !== TAA_SHADER.fragmentShader && FINAL_UPSCALE_FRAGMENT !== FINAL_SHADER.fragmentShader);
}

// ================================================================================================= effective scale
{
  const fwd = make({ renderScale: 0.75 });
  fwd.render(0);
  check('forward (no TAA): effective 1, request kept, no define, full size',
      fwd.renderScaleInEffect === 1 && fwd.get('renderScale') === 0.75 && !anyUpscaleDefine(fwd)
      && sizesOk(fwd, 800, 450, 800, 450));
  fwd.dispose();
  const fx = make({ ...ALL, renderScale: 0.75 });
  fx.render(0);
  check('G-buffer + TAA, 0.75: in effect, internal 600x338',
      fx.renderScaleInEffect === 0.75 && fx.internalWidth === 600 && fx.internalHeight === 338);
  check('0.75: internal before TAA, output from TAA on', sizesOk(fx, 600, 338, 800, 450));
  check('0.75: every upscale define (TAA, final, motion blur, DoF x 2)',
      defs(fx).every((d) => UPSCALE_DEFINES.some((k) => k in d)) && defs(fx).length === 5);
  check('0.75: the TAA / final materials carry the upscale texts',
      fx.taaPass.material.fragmentShader === TAA_UPSCALE_FRAGMENT
      && fx.finalPass.material.fragmentShader === FINAL_UPSCALE_FRAGMENT);
  check('0.75: jitter in internal px (history.begin(600, 338))', beginSize(fx).join() === '600,338');
  check('0.75: AO at half the internal size', eq(size(fx.aoPass.rtA), [300, 169]));
  check('0.75: bloom from the output size', eq(size(fx.bloomPass.renderTargetBright), [200, 113]));
  const u = fx.taaPass.material.uniforms;
  check('0.75: TAA uInRes 600x338, uUp.y = 1 / mean weight',
      u.uInRes.value.x === 600 && u.uInRes.value.y === 338
      && Math.abs(u.uUp.value.y - 1 / taaUpscaleMeanWeight(800 / 600, 450 / 338)) < 1e-12);
  // TAA off: effective 1, the request kept; back on: 0.75 again
  fx.set('aa', 'fxaa'); fx.render(0);
  check("aa 'fxaa': effective 1, no define, full size, request kept",
      fx.renderScaleInEffect === 1 && !anyUpscaleDefine(fx) && sizesOk(fx, 800, 450, 800, 450)
      && fx.get('renderScale') === 0.75);
  check("aa 'fxaa': the texts back to 3bba697's",
      sha1(fx.taaPass.material.fragmentShader) === SHA1_AT_3BBA697.taa
      && sha1(fx.finalPass.material.fragmentShader) === SHA1_AT_3BBA697.final
    && sha1(fx.motionBlurPass._velocityMat.fragmentShader) === SHA1_AT_3BBA697.mbVelocity
    && sha1(fx.dofPass._compositeMat.fragmentShader) === SHA1_AT_3BBA697.dofComposite);
  fx.set('aa', 'taa');
  check("aa 'taa' again: 0.75, history restarted",
      fx.renderScaleInEffect === 0.75 && sizesOk(fx, 600, 338, 800, 450) && fx.history._reset === true
      && fx.taaPass.resetPending);
  fx.render(0);
  fx.dispose();
}

// ================================================================================================= sequences
{
  const fx = make({ ...ALL, renderScale: 0.75 });
  fx.render(0); fx.render(0);
  const restarted = () => fx.history._reset === true && fx.taaPass.resetPending;
  fx.setSize(1000, 500, 1);
  check('setSize(1000, 500): internal 750x375, output 1000x500, history restarted',
      sizesOk(fx, 750, 375, 1000, 500) && restarted());
  check('setSize: readBuffer is the G-buffer target', fx.composer.readBuffer === fx.gbuffer.target);
  fx.render(0);
  fx.setSize(640, 360, 2);
  check('setSize(640, 360, 2): internal 960x540, output 1280x720', sizesOk(fx, 960, 540, 1280, 720) && restarted());
  fx.render(0);
  fx.set('renderScale', 0.6); check('live 0.75 -> 0.6: 768x432', sizesOk(fx, 768, 432, 1280, 720) && restarted());
  fx.render(0);
  fx.set('renderScale', 1); check('live -> 1: full size, history restarted',
      sizesOk(fx, 1280, 720, 1280, 720) && restarted());
  fx.render(0); // (the final pass syncs its defines as it renders)
  check('live -> 1: no define, the plain texts',
      !anyUpscaleDefine(fx) && fx.taaPass.material.fragmentShader === TAA_SHADER.fragmentShader
      && fx.finalPass.material.fragmentShader === FINAL_SHADER.fragmentShader);
  fx.set('renderScale', 0.75); check('live 1 -> 0.75', sizesOk(fx, 960, 540, 1280, 720) && anyUpscaleDefine(fx));
  fx.render(0);
  fx.history.reset(); fx.render(0);
  check('history.reset(): sizes kept, fresh frame', sizesOk(fx, 960, 540, 1280, 720) && fx.history.fresh === true);
  fx.taaPass.reset(); fx.render(0);
  check('taaPass.reset(): sizes kept', sizesOk(fx, 960, 540, 1280, 720));
  fx.set('gbuffer', false); fx.render(0);
  check('G-buffer off: effective 1, full size (no TAA), request kept',
      fx.renderScaleInEffect === 1 && fx.internalWidth === 1280
      && eq([fx.aoPass._size.x, fx.aoPass._size.y], [1280, 720]) && fx.get('renderScale') === 0.75);
  fx.set('gbuffer', true); fx.set('aa', 'taa'); fx.set('ssr', { interval: 2 }); fx.set('motionBlur', 0.5);
  fx.render(0);
  check('G-buffer rebuilt: 0.75 again on the new G-buffer / passes',
      fx.renderScaleInEffect === 0.75 && sizesOk(fx, 960, 540, 1280, 720) && anyUpscaleDefine(fx));
  // a pass created while upscaling starts at the internal size / mapping
  fx.set('dof', null); fx.set('volumetric', false); fx.set('dof', true); fx.set('volumetric', true);
  check('passes created while upscaling: internal size / upscale mapping',
      sizesOk(fx, 960, 540, 1280, 720) && fx.dofPass._up === true);
  fx.set('ssr.scale', 0.5);
  check('ssr.scale change while upscaling: of the internal size',
      fx.ssrPass._w === 960 && eq(size(fx.ssrPass._rt), [480, 270]));
  fx.setAOResolution({ scale: 0.5, maxPixels: null });
  check('setAOResolution while upscaling: of the internal size', eq(size(fx.aoPass.rtA), [480, 270]));
  fx.dispose();
}

// ================================================================================================= mean weight
{
  check('taaUpscaleMeanWeight(1, 1) = mean of exp(-2.29 d^2) over |d| <= 0.5 px per axis',
      taaUpscaleMeanWeight(1, 1), 0.70, 0.71);
  check('taaUpscaleMeanWeight falls as the ratio grows',
      taaUpscaleMeanWeight(4 / 3, 4 / 3) < taaUpscaleMeanWeight(1.15, 1.15)
      && taaUpscaleMeanWeight(2, 2) < taaUpscaleMeanWeight(4 / 3, 4 / 3));
}

// ================================================================================================= allocation
{
  const fx = make({ ...ALL, renderScale: 0.75 });
  fx.render(0.016);
  const passRenders = [...new Set(fx.composer.passes.map((p) => p.render))];
  gate(check, note, 'render() every pass on, renderScale 0.75 (stub renderer)',
      bytesPerCall((n) => { for (let i = 0; i < n; i++) fx.render(0.016); }, 3000, { budget: 256, force: passRenders }),
      { budget: 256, unit: 'frame' });
  gate(check, note, "set('renderScale', same value)",
      bytesPerCall((n) => { for (let i = 0; i < n; i++) _sink = fx.set('renderScale', 0.75); }, 20000),
      { unit: 'call' });
  fx.dispose();
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll renderScale checks passed.');
process.exit(failures ? 1 : 0);
