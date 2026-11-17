// The night look: atmosphere keyframes for a wet city night (heavier haze and low mist, an overcast deck lit orange
// from below by the city), the post grade (exposure, bloom tuned for small bright sources, cool shadows / warm
// highlights, vignette, grain) and a 3D LUT generated in code (no file), each in two looks: 'low' (default, the
// low-key dusk reference) and 'open' (brighter, two temperatures); see nightGrade.
import { DEFAULT_LOOKS, DEFAULT_GRADE, lutFromFunction } from '@vibe/engine/render';

/** Atmosphere `looks`: the two night keyframes replaced (sun more than 12 deg below the horizon). */
export function nightLooks({ haze = 0.0011, mist = 0.0009 } = {}) {
  const night = {
    turb: 2.4, ray: 1.4, mie: 0.003, g: 0.78, tw: 1, night: 1, glowA: 0, sun: 1,
    env: 0.55, hemi: 0.22, haze, mist, cover: 0.62, cirrus: 0.1, cop: 0.92,
    cs: [0.012, 0.011, 0.012], ca: [0.05, 0.034, 0.024], aur: 0,
  };
  return DEFAULT_LOOKS.map((k) => (k.el <= -12 ? { ...k, ...night, el: k.el } : k));
}

// Two looks (main.js: ?look=open picks the second):
//   'low'  (default) the owner's low-key dusk reference (test/browser/smoke.mjs look gate: mean luminance 22..48 / 255,
//          at least half the frame under 40, nothing clipped, one warm hue family): darks lifted just enough that the
//          darkest wall keeps its brick and mullions, a cool tint only in the deepest shade (too dark to count as a hue),
//          AO only on the ambient, a little halation around the lamps;
//   'open' the brighter two-temperature grade the critique and the render-gap study argue for: exposure up, eye
//          adaptation on, no toe, a cool blue-violet sky and shade against warm lamps and windows.

/**
 * PostFX `grade`: night keyframes (sun below -3 deg) for the city after dark. `look` 'low' (default) or 'open' (see
 * above); exposure overrides the look's own.
 */
export function nightGrade({ look = 'low', exposure, bloomThreshold, bloomStrength, bloomRadius, grain = 0.025 } = {}) {
  const n = look === 'open' ? {
    wb: [0.97, 0.995, 1.04], aeK: 0.06, aeS: 0.3, aeMax: 1.35, exp: exposure ?? 1.8, bT: bloomThreshold ?? 1.8, bS: bloomStrength ?? 0.34, bR: bloomRadius ?? 0.42,
    sat: 1.0, con: 0.24, split: 1.0, sh: [-0.002, 0.001, 0.008], hi: [0.016, 0.006, -0.008], vig: 0.36, grain, ao: 0.7,
  } : {
    // the low-key grade: fixed exposure (no adaptation), a lower bloom threshold with a wider, weak radius (halation
    // around lamps and windows, not glare), warm near-neutral, saturation and contrast as the reference
    wb: [1.0, 1.0, 0.985], aeK: 0.05, aeS: 0, aeMax: 1.0, exp: exposure ?? 1.75, bT: bloomThreshold ?? 1.8, bS: bloomStrength ?? 0.36, bR: bloomRadius ?? 0.42,
    sat: 0.92, con: 0.22, split: 1.0, sh: [0.0, 0.0, 0.0], hi: [0.012, 0.005, -0.006], vig: 0.42, grain, ao: 0.75,
  };
  return DEFAULT_GRADE.map((k) => (k.el <= -3 ? { ...k, ...n, el: k.el } : k)); // dusk and night: one grade
}

/**
 * PostFX `look` (finishing): AO only on the ambient (a lamp-lit pavement keeps its light), a faint cool tint in the
 * occluded corners, and a lifted floor so the darkest wall still shows its brick: 'low' a dark blue-black (below the
 * gate's hue threshold), 'open' a dark blue-grey (Saltline's teal lift, a little bluer).
 */
export function nightLook(look = 'low') {
  return look === 'open'
    ? { aoLit: 0.8, aoTint: [0.0, 0.03, 0.07], lift: [0.006, 0.0085, 0.014] }
    : { aoLit: 0.8, aoTint: [0.0, 0.02, 0.05], lift: [0.0022, 0.0028, 0.0045] };
}

/**
 * The night LUT (display-referred, 0..1 in and out). 'low': a short, gentle toe (the old long toe sank everything
 * under 0.25 toward black and crushed the shop and shutter views), warm family kept, cool / green hues quieter, warm
 * near-neutral shadows. 'open': near identity in value, cool hues kept (never grey), dark tones calmer.
 */
export function nightLut(size = 24, look = 'low') {
  const open = look === 'open';
  return lutFromFunction(size, (r, g, b, out) => {
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hue = 0;
    if (d > 1e-5) { hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; if (hue < 0) hue += 6; }
    // warm family 330..60 deg (hue 5.5..6 and 0..1)
    const warm = hue < 1.0 || hue > 5.5 ? 1 : hue < 1.6 ? 1 - (hue - 1.0) / 0.6 : hue > 4.9 ? (hue - 4.9) / 0.6 : 0;
    const green = hue > 1.6 && hue < 3.4 ? 1 : 0;
    const s = open
      ? (0.92 + 0.12 * warm - 0.2 * green) * (0.8 + 0.2 * Math.min(1, l / 0.3))
      : (0.55 + 0.42 * warm - 0.1 * green) * (0.7 + 0.3 * Math.min(1, l / 0.3)); // cool hues quieter: one warm family
    let R = l + (r - l) * s, G = l + (g - l) * s, B = l + (b - l) * s;
    const hi = l * l;
    R *= 1 + 0.025 * hi; G *= 1 + 0.008 * hi; B *= 1 - 0.035 * hi;
    // 'low': a gentle toe below 0.12 (a 15 % dip at most, the floor itself set by PostFX look.lift)
    const toe = (v) => (open || v >= 0.12 ? v : v * (0.85 + 0.15 * v / 0.12));
    out[0] = Math.min(1, Math.max(0, toe(R))); out[1] = Math.min(1, Math.max(0, toe(G))); out[2] = Math.min(1, Math.max(0, toe(B)));
  }, open ? 'nyc-night-open' : 'nyc-night-low');
}

/**
 * A real city night sky on the Atmosphere's own uniforms (no engine change): a near-black zenith, a dull sodium / LED
 * glow along the horizon (the light pollution term), stars almost gone. The sky and the environment-map sky both get
 * it; the environment, fog colour and hemisphere light are then rebuilt for it (atmo.setTime). Call after load.
 */
export function cityNightSky(atmo, { zenith = [0.0011, 0.0012, 0.0016], horizon = [0.006, 0.0052, 0.0048], glow = [0.034, 0.022, 0.013], stars = 0.08 } = {}) {
  for (const s of [atmo.sky, atmo.envSky]) {
    const u = s && s.material && s.material.uniforms; if (!u) continue;
    u.uNightZen.value.setRGB(...zenith); u.uNightHor.value.setRGB(...horizon); u.uPollution.value.setRGB(...glow);
  }
  atmo.setTime(atmo.hours);
  atmo.sky.material.uniforms.uStars.value = stars;
}

// ------------------------------------------------------------------ late dusk (the default)
/** Sun model for Manhattan in autumn: the sun sets toward the west-north-west, down the cross streets (the grid is
 *  turned 29 deg; at 19:15 the azimuth is ~299 deg, i.e. straight down a crosstown street to the west). */
export const NYC_SUN = { rise: 7.15, set: 18.6, maxElevation: 40, nightDepth: 35, nightRate: 13, azimuthStart: 135, azimuthSpan: 156 };
export const DUSK_HOURS = 19.25; // sun ~8.5 deg below the horizon: afterglow on, lamps and windows on

/** Atmosphere `looks` for late dusk: night keyframes below -12 deg (as nightLooks) and a dusk keyframe at -6 deg with
 *  urban haze thickening toward the glow and scattered dark cumulus lit warm from below. */
export function duskLooks(look = 'low') {
  const base = nightLooks({ haze: 0.0016, mist: 0.0011 });
  // clouds (both looks): lit warm from below by the afterglow (they were darker than the glow behind them, a hard dark
  // smudge down the avenue), fewer of them
  const dusk = {
    turb: 2.6, ray: 1.6, mie: 0.003, g: 0.8, tw: 1, night: 0.05, glowA: 1.0, sun: 1, env: 0.5, hemi: look === 'open' ? 0.34 : 0.2,
    haze: 0.0026, mist: 0.0014, cover: 0.24, cirrus: 0.18, cop: 0.92, cs: [0.42, 0.19, 0.09], ca: [0.05, 0.055, 0.085], aur: 0,
  };
  return base.map((k) => (k.el > -12 && k.el <= -3 ? { ...k, ...dusk, el: k.el } : k));
}

/** Dusk sky colours of the 'open' look: a deep blue-violet overhead, a cool slate horizon, the salmon-orange afterglow
 *  only low toward the set sun (the haze down the cross streets stays warm, the rest of the fog takes the cool sky). */
export const OPEN_DUSK_SKY = { zenith: [0.022, 0.026, 0.062], horizon: [0.075, 0.082, 0.125], glow: [0.85, 0.32, 0.1] };

/** The dusk sky colours on the Atmosphere's twilight uniforms (default, the 'low' look): mauve-grey overhead, dull rose
 *  low down, a salmon-orange afterglow on the horizon toward the set sun (the reference's 46/39/43 top, 90/70/70 mid,
 *  115/70/52 horizon after the grade); OPEN_DUSK_SKY for the 'open' look. Rebuilds the environment / fog for it. */
export function cityDuskSky(atmo, { zenith = [0.034, 0.028, 0.036], horizon = [0.2, 0.11, 0.1], glow = [0.9, 0.34, 0.11] } = {}) {
  for (const s of [atmo.sky, atmo.envSky]) {
    const u = s && s.material && s.material.uniforms; if (!u) continue;
    u.uTwZen.value.setRGB(...zenith); u.uTwHor.value.setRGB(...horizon); u.uTwGlow.value.setRGB(...glow);
    u.uNightZen.value.setRGB(0.0011, 0.0012, 0.0016); u.uNightHor.value.setRGB(0.006, 0.0052, 0.0048); u.uPollution.value.setRGB(0.034, 0.022, 0.013);
  }
  atmo.setTime(atmo.hours);
  atmo.sky.material.uniforms.uStars.value = 0;
}
