// The post-processing comparison (?post=1). Indicative only: the two stacks are different code and their pictures differ.
//   WebGLRenderer: the engine's production PostFX at nyc-night's desktop settings (G-buffer, TAA, GTAO at the same pixel
//     budget, SSR at 0.4 scale, bloom, exposure, the final grade pass). Left out: the volumetric pass (it needs the
//     Atmosphere, which the plain scene does not have; TSL has no equivalent), fog, the LUT.
//   WebGPURenderer: three's TSL nodes as a library: one scene pass with MRT (colour, view normal, metalness /
//     roughness, velocity), GTAO, SSR, TRAA, bloom, then the PostProcessing output transform (ACES + sRGB).
// Internal scales: AO 0.35 (PostFX's maxPixels 0.25e6 at 1920x1080), SSR 0.4, bloom at its own mip chain in both.
import * as THREE from 'three';

export async function makePost({ renderer, scene, camera, W, H, webgpu }) {
  if (!webgpu) {
    const { PostFX } = await import('@vibe/engine/render');
    renderer.toneMapping = THREE.NoToneMapping; // PostFX's final pass tone-maps
    const p = new PostFX(renderer, scene, camera, {
      width: W, height: H, pixelRatio: 1, gbuffer: true, aa: 'taa', volumetric: false, motionBlur: 0,
      ssr: { scale: 0.4, steps: 22, refine: 4, maxDistance: 120, thickness: 0.6, maxRoughness: 0.45, edgeFade: 0.2, jitter: false, denoise: 5, interval: 2 },
      ao: { radius: 1.2, thickness: 1.2, samples: 6, maxPixels: 0.25e6 },
    });
    p.aoPass.enabled = true;
    p.set('bloom.enabled', true);
    return { render: () => p.render(1 / 60), describe: 'PostFX (production): G-buffer, exposure, GTAO, SSR, TAA, bloom, final grade' };
  }
  const { PostProcessing } = await import('three/webgpu');
  const { pass, mrt, output, normalView, metalness, roughness, velocity, vec2, blendColor } = await import('three/tsl');
  const { ao } = await import('three/addons/tsl/display/GTAONode.js');
  const { ssr } = await import('three/addons/tsl/display/SSRNode.js');
  const { traa } = await import('three/addons/tsl/display/TRAANode.js');
  const { bloom } = await import('three/addons/tsl/display/BloomNode.js');
  const sp = pass(scene, camera);
  sp.setMRT(mrt({ output, normal: normalView, metalrough: vec2(metalness, roughness), velocity }));
  const col = sp.getTextureNode('output'), depth = sp.getTextureNode('depth'), nrm = sp.getTextureNode('normal');
  const mr = sp.getTextureNode('metalrough'), vel = sp.getTextureNode('velocity');
  const aoN = ao(depth, nrm, camera);
  aoN.resolutionScale = 0.35; aoN.samples.value = 6; aoN.radius.value = 1.2; aoN.thickness.value = 1.2;
  // r187 takes the material inputs as options (r180: positional metalness, roughness, camera)
  const ssrN = +THREE.REVISION >= 187 ? ssr(col, depth, nrm, { metalnessNode: mr.r, roughnessNode: mr.g, camera }) : ssr(col, depth, nrm, mr.r, mr.g, camera);
  ssrN.resolutionScale = 0.4; ssrN.maxDistance.value = 120; ssrN.thickness.value = 0.6;
  const lit = blendColor(col.mul(aoN.getTextureNode().r), ssrN);
  const aa = traa(lit, depth, vel, camera);
  const post = new PostProcessing(renderer);
  post.outputNode = aa.add(bloom(aa, 0.4, 0.3, 0.85));
  return { render: () => post.render(), describe: 'TSL: scene pass (MRT), GTAO, SSR, TRAA, bloom, ACES + sRGB output' };
}
