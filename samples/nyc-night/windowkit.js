// Windows as built things on the buildings near the walker, placed from the REAL window layout: the engine's builder
// is deterministic (per-building seeded RNG, Buildings.js buildingStyle), so this file reproduces each street wall's
// bays, floors and window rectangles exactly where the engine cut the openings / drew the texture windows.
//   frames    sash frames standing in the reveal in front of the pane: stiles, head, a meeting rail on the sash
//             windows (pairs, singles, Victorian), a transom bar on the office windows; the occasional window open
//             (lower sash raised over the upper, a dark gap) or boarded up (plywood) on the old blocks;
//   AC units  window air conditioners that sit IN an opening: on the sill, half in the reveal, the lower sash resting on
//             the unit, accordion side panels, a front grille, a bracket under it; on the old residential and masonry
//             blocks, a few per wall, never on piers, never above the top floor (they replace rooftops.js's guessed grid).
// Geometry into groundfloors.js's merged Kit (o.kit; else its own mesh on o.material). Blinds and curtains are in the glass shader
// (Buildings.js + walls.js). Mobile: a smaller radius, AC units only.
import * as THREE from 'three';
import { buildingStyle, WIN_RECTS, FACADE, RBIT, hashStr } from '@vibe/engine/world';
import { mulberry32 } from '@vibe/engine/render';
import { Kit, box, bar, lin, MAT } from './groundfloors.js';

const SASH = new Set([FACADE.PAIR, FACADE.SMALL, FACADE.VICTORIAN]);
const AC_OK = new Set([FACADE.PUNCHED, FACADE.PAIR, FACADE.SMALL, FACADE.CLASSIC, FACADE.VICTORIAN]);
const FRAME_OK = new Set([FACADE.PUNCHED, FACADE.PAIR, FACADE.SMALL, FACADE.CLASSIC, FACADE.VICTORIAN]);

/**
 * o: { world, scene, material, center {x,z}, frameRadius = 200, acRadius = 260, frames = true, detailFloors = 4, seed }.
 * Returns { group, counts }.
 */
export function buildWindowKit(o) {
  const { world } = o, C = o.center;
  const FR2 = (o.frameRadius ?? 200) ** 2, AR2 = (o.acRadius ?? 260) ** 2, maxR2 = Math.max(FR2, AR2);
  const list = world.data.buildings, fps = world._footprints, style = world._bopts && world._bopts.style;
  const raster = world.raster, STREET = RBIT.ROAD | RBIT.SIDEWALK, detailFloors = o.detailFloors ?? 4;
  const K = o.kit || new Kit(), counts = { buildings: 0, windows: 0, frames: 0, open: 0, boarded: 0, ac: 0 };
  const R = mulberry32(o.seed ?? 5150), samples = []; // samples: a few framed windows (debug views)
  if (!fps) return { group: new THREE.Group(), counts };
  for (let i = 0; i < list.length; i++) {
    const bd = list[i], fp = fps[i];
    if (!fp || bd.lod || bd.water || (bd.r && bd.r !== 'flat') || fp.mh > 0.5) continue;
    if ((fp.c[0] - C.x) ** 2 + (fp.c[1] - C.z) ** 2 > maxR2) continue;
    const rnd = mulberry32(((hashStr(String(bd.n || '')) * 1e9) ^ (i * 2654435761)) >>> 0);
    const st = buildingStyle(bd, fp.h, fp.area, rnd, { xb: fp.c[0] + world.offset.x, zb: fp.c[1] + world.offset.z }, style);
    if (st.curtain || st.win < 0 || !(FRAME_OK.has(st.win) || AC_OK.has(st.win))) continue;
    const h = fp.h, floors = Math.max(1, Math.round(h / st.floorH)), fh = h / floors, base = fp.base;
    const rects = WIN_RECTS[st.win];
    const old = st.prewar || st.cat === 'res';
    const acDens = AC_OK.has(st.win) && old && h >= 9 && h <= 90 ? 0.05 + 0.2 * R() : 0;
    const frameCol = lin(st.win === FACADE.PAIR || st.win === FACADE.SMALL || st.win === FACADE.VICTORIAN ? (R() < 0.7 ? '#d8d4ca' : '#2a2a28') : '#3a342c');
    const depth = st.depth;
    const r = fp.outer;
    let any = false;
    for (let k = 0; k < r.length; k++) {
      const a = r[k], e = r[(k + 1) % r.length], dx = e[0] - a[0], dz = e[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 2.5) continue;
      const ox = dz / L, oz = -dx / L, mx = (a[0] + e[0]) / 2, mz = (a[1] + e[1]) / 2;
      if (!raster.any(mx + ox * 4.5, mz + oz * 4.5, 1.6, STREET)) continue;
      const near2 = (mx - C.x) ** 2 + (mz - C.z) ** 2;
      const doFrames = o.frames !== false && near2 < FR2 && FRAME_OK.has(st.win), doAC = acDens > 0 && near2 < AR2;
      if (!doFrames && !doAC) continue;
      const nb = L >= 0.6 * st.bayW ? Math.max(1, Math.round(L / st.bayW)) : L / st.bayW, bw = L / nb;
      const F = {
        T: [dx / L, 0, dz / L], N: [ox, 0, oz], U: [0, 1, 0], mT: [-dx / L, 0, -dz / L], mN: [-ox, 0, -oz], mU: [0, -1, 0],
        P: (s, y, oo) => [a[0] + (dx / L) * s + ox * oo, y, a[1] + (dz / L) * s + oz * oo],
      };
      const groundAt = (s) => world.getGroundHeight(a[0] + (dx / L) * s, a[1] + (dz / L) * s);
      any = true;
      for (let row = 1; row < floors; row++) {
        const nearRow = row < detailFloors; // real openings (reveal) below, texture windows above
        for (let bi = 0; bi < Math.round(nb); bi++) {
          for (const Rr of rects) {
            const s0 = bi * bw + Rr[0] * bw, s1 = bi * bw + Rr[1] * bw, y0 = base + row * fh + Rr[2] * fh, y1 = base + row * fh + Rr[3] * fh;
            if (s1 - s0 < 0.3 || y1 > base + h - 0.3) continue;
            if (Math.max(groundAt(s0), groundAt(s1)) + 0.25 > y0) continue; // the engine keeps these solid
            counts.windows++;
            const w = s1 - s0, hh = y1 - y0, oP = nearRow ? -depth + 0.015 : 0.005; // pane line (just in front)
            // ---- AC unit (sits on the sill, in the lower sash)
            if (doAC && R() < acDens && w > 0.7) {
              const uw = Math.min(0.66, w - 0.12), uh = 0.4, sc = (s0 + s1) / 2 + (w > 1.3 ? (R() - 0.5) * (w - uw - 0.2) : 0);
              const ua = sc - uw / 2, ub = sc + uw / 2, yb = y0 + 0.01, oo = 0.36, oi = nearRow ? -depth + 0.03 : 0;
              const shade = 0.75 + R() * 0.35, body = lin(R() < 0.6 ? '#b8b2a4' : R() < 0.5 ? '#8c8a84' : '#d2d0c8').map((v) => v * shade);
              box(K, F, ua, ub, yb, yb + uh, oi, oo, body, MAT.paint, 'ftblr');
              K.quad(F.P(ua + 0.04, yb + 0.05, oo + 0.004), F.P(ub - 0.04, yb + 0.05, oo + 0.004), F.P(ub - 0.04, yb + uh - 0.08, oo + 0.004), F.P(ua + 0.04, yb + uh - 0.08, oo + 0.004), F.N, body.map((v) => v * 0.55), MAT.louvre);
              // accordion panels to the jambs, the lower sash resting on the unit
              if (nearRow) {
                if (ua - s0 > 0.04) box(K, F, s0, ua, yb + 0.02, yb + uh - 0.02, oi, oi + 0.03, lin('#c8c2b0').map((v) => v * shade), MAT.paint, 'f');
                if (s1 - ub > 0.04) box(K, F, ub, s1, yb + 0.02, yb + uh - 0.02, oi, oi + 0.03, lin('#c8c2b0').map((v) => v * shade), MAT.paint, 'f');
                box(K, F, s0, s1, yb + uh, yb + uh + 0.05, oi, oi + 0.05, frameCol, MAT.paint, 'ftb');
              }
              // a bracket under the outer half (two struts to the wall)
              for (const s of [ua + 0.08, ub - 0.08]) bar(K, F.P(s, yb - 0.32, 0.01), F.P(s, yb - 0.01, oo - 0.06), 0.025, lin('#2a2a2a'), MAT.metal);
              counts.ac++;
              continue;
            }
            if (!doFrames || !nearRow) continue;
            // ---- the sash frame in the reveal
            const fw = Math.min(0.07, w * 0.08), fd = 0.05, fc = frameCol;
            const r2 = R();
            const boarded = old && row <= 2 && r2 < 0.012, open = !boarded && SASH.has(st.win) && r2 > 0.955;
            if (boarded) {
              box(K, F, s0 + 0.02, s1 - 0.02, y0 + 0.02, y1 - 0.02, oP, oP + 0.025, lin('#7a6248').map((v) => v * (0.7 + 0.4 * R())), [0.85, 0, 0, 4], 'f');
              counts.boarded++;
              continue;
            }
            box(K, F, s0, s0 + fw, y0, y1, oP, oP + fd, fc, MAT.paint, 'fr');
            box(K, F, s1 - fw, s1, y0, y1, oP, oP + fd, fc, MAT.paint, 'fl');
            box(K, F, s0 + fw, s1 - fw, y1 - fw, y1, oP, oP + fd, fc, MAT.paint, 'fb');
            box(K, F, s0 + fw, s1 - fw, y0, y0 + fw * 0.8, oP, oP + fd, fc, MAT.paint, 'ft');
            if (SASH.has(st.win)) {
              // meeting rail: lower sash in front of the upper; raised (open) on a few, a dark gap under it
              const ym = open ? y0 + hh * (0.72 + 0.15 * R()) : y0 + hh * 0.5;
              box(K, F, s0 + fw, s1 - fw, ym - 0.035, ym + 0.035, oP + 0.02, oP + fd + 0.025, fc, MAT.paint, 'ftb');
              if (open) {
                K.quad(F.P(s0 + fw, y0 + fw, oP + 0.004), F.P(s1 - fw, y0 + fw, oP + 0.004), F.P(s1 - fw, y0 + hh * 0.5 - 0.03, oP + 0.004), F.P(s0 + fw, y0 + hh * 0.5 - 0.03, oP + 0.004), F.N, lin('#050505'), MAT.rough);
                box(K, F, s0 + fw, s1 - fw, y0 + hh * 0.5 - 0.03, y0 + hh * 0.5 + 0.03, oP + 0.02, oP + fd, fc, MAT.paint, 'ft'); // the raised sash's bottom rail
                counts.open++;
              }
            } else if (st.win === FACADE.PUNCHED) {
              const yt = y0 + hh * 0.78;
              box(K, F, s0 + fw, s1 - fw, yt - 0.03, yt + 0.03, oP, oP + fd, fc, MAT.paint, 'ftb');
              box(K, F, (s0 + s1) / 2 - 0.025, (s0 + s1) / 2 + 0.025, y0 + fw, yt - 0.03, oP, oP + fd, fc, MAT.paint, 'flr');
            } else if (st.win === FACADE.CLASSIC) {
              const yt = y0 + hh * 0.3;
              box(K, F, s0 + fw, s1 - fw, yt - 0.03, yt + 0.03, oP, oP + fd, fc, MAT.paint, 'ftb');
              box(K, F, (s0 + s1) / 2 - 0.025, (s0 + s1) / 2 + 0.025, y0 + fw, y1 - fw, oP, oP + fd, fc, MAT.paint, 'flr');
            }
            counts.frames++;
            if (samples.length < 40 && row === 1) samples.push({ p: F.P((s0 + s1) / 2, (y0 + y1) / 2, 0), n: F.N, win: st.win, h: fp.h });
          }
        }
      }
    }
    if (any) counts.buildings++;
  }
  const group = new THREE.Group(); group.name = 'window-kit';
  if (K.tris && !o.kit) {
    const mesh = new THREE.Mesh(K.geometry(), o.material);
    mesh.name = 'window-kit'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  counts.tris = K.tris;
  o.scene.add(group);
  return { group, counts, samples };
}
