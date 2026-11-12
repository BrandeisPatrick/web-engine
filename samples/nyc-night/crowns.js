// Tower tops: the avenue's roofline was a set of straight cuts. Every tall block within `radius` of the square gets a top
// in the manner of its type, built on its real footprint (rectangular tiers in the frame of its longest edge, kept
// inside the footprint) with the ENGINE'S facade material and the building's own style (Buildings.js buildingStyle:
// same wall scan, tint, window layer, glass variant), so the tiers carry the same walls and lit windows as the shaft:
//   pre-war masonry  wedding-cake setbacks (two or three tiers, a ledge at each), then a copper pyramid, a lantern with a
//                    mast, or corner turrets with pyramid caps;
//   post-war / office  a setback floor and a mechanical screen (corrugated metal) with a mast now and then;
//   glass towers     a glass top floor set back and a tall mechanical screen behind the parapet line.
// One merged GeoBuf mesh on the facade material (one draw call, no shadow casting). The crowned buildings are returned
// so rooftops.js / structures.js leave their roofs alone (no penthouse box through a tier). Red beacons on the masts.
import * as THREE from 'three';
import { GeoBuf, MODE, enc, PBR, buildingStyle, hashStr, tintOf, pointInPoly } from '@vibe/engine/world';
import { mulberry32 } from '@vibe/engine/render';

/**
 * o: { world, scene, center {x,z}, radius = 900, minHeight = 55, max = 400, seed }.
 * Returns { group, mesh, crowned: Set<building>, beacons: [[x,y,z]], counts }.
 */
export function buildCrowns(o) {
  const { world } = o, C = o.center, R2 = (o.radius ?? 900) ** 2, minH = o.minHeight ?? 55;
  const list = world.data.buildings, fps = world._footprints, style = world._bopts && world._bopts.style;
  const buf = new GeoBuf(4096), crowned = new Set(), beacons = [], counts = { towers: 0, deco: 0, mech: 0, glass: 0, turrets: 0, pyramids: 0, lanterns: 0 };
  const R = mulberry32(o.seed ?? 7331), samples = []; // samples: a few crowned towers (debug views)
  if (!fps) return { group: new THREE.Group(), mesh: null, crowned, beacons, counts };
  const copper = tintOf(0.36, 0.52, 0.44), darkMetal = tintOf(0.3, 0.31, 0.32), screenT = tintOf(0.42, 0.43, 0.44);
  const cand = [];
  for (let i = 0; i < list.length; i++) {
    const bd = list[i], fp = fps[i];
    if (!fp || bd.lod || bd.water || (bd.r && bd.r !== 'flat') || fp.mh > 0.5 || fp.h < minH || fp.area < 250) continue;
    const d2 = (fp.c[0] - C.x) ** 2 + (fp.c[1] - C.z) ** 2;
    if (d2 < R2) cand.push([d2, i]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, i] of cand) {
    if (counts.towers >= (o.max ?? 400)) break;
    const bd = list[i], fp = fps[i], r = fp.outer;
    const rnd = mulberry32(((hashStr(String(bd.n || '')) * 1e9) ^ (i * 2654435761)) >>> 0);
    const st = buildingStyle(bd, fp.h, fp.area, rnd, { xb: fp.c[0] + world.offset.x, zb: fp.c[1] + world.offset.z }, style);
    const seed = rnd(); // add() draws its per-building seed right after the style
    if (st.cat === 'shed' || st.cat === 'industrial' || st.cat === 'garage') continue;
    // frame of the longest edge, extents
    let L = 0, ux = 1, uz = 0;
    for (let k = 0; k < r.length; k++) { const a = r[k], b = r[(k + 1) % r.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > L) { L = l; ux = (b[0] - a[0]) / l; uz = (b[1] - a[1]) / l; } }
    const vx = -uz, vz = ux, cx = fp.c[0], cz = fp.c[1];
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of r) { const u = (q[0] - cx) * ux + (q[1] - cz) * uz, v = (q[0] - cx) * vx + (q[1] - cz) * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const W = u1 - u0, D = v1 - v0;
    if (Math.min(W, D) < 12) continue;
    const at = (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v];
    const inside = (a0, a1, b0, b1) => { for (const [u, v] of [[a0, b0], [a1, b0], [a1, b1], [a0, b1], [(a0 + a1) / 2, b0], [(a0 + a1) / 2, b1], [a0, (b0 + b1) / 2], [a1, (b0 + b1) / 2]]) { const [x, z] = at(u, v); if (!pointInPoly(x, z, r, [])) return false; } return true; };
    // the first tier: as large as fits inside the footprint, set back from the parapet
    let rect = null;
    for (let k = 0; k < 6 && !rect; k++) {
      const m = Math.max(1.6, Math.min(W, D) * (0.08 + 0.06 * k));
      const a0 = u0 + m, a1 = u1 - m, b0 = v0 + m, b1 = v1 - m;
      if (a1 - a0 > 6 && b1 - b0 > 6 && inside(a0, a1, b0, b1)) rect = [a0, a1, b0, b1];
    }
    if (!rect) continue;
    const floors = Math.max(1, Math.round(fp.h / st.floorH)), fh = fp.h / floors, base = fp.base, top = base + fp.h;
    const parapet = Math.min(1.6, Math.max(0.7, 0.6 + fp.h * 0.004));
    const u0w = Math.floor(seed * 4);
    // ---- emitters
    const wallInfo = (pbr) => (st.curtain ? [st.glassVariant, -1, seed, enc(PBR.PLAIN, MODE.CURTAIN)] : [st.win >= 0 ? st.win : -1, -1, seed, enc(pbr, st.win >= 0 ? MODE.WALL : MODE.PLAIN)]);
    const tier = (rc, y0, y1, info, tint, bayW = st.curtain ? 1.5 : st.bayW) => {
      const [a0, a1, b0, b1] = rc, P = [at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)];
      for (let k = 0; k < 4; k++) {
        const A = P[k], B = P[(k + 1) % 4], ex = B[0] - A[0], ez = B[1] - A[1], l = Math.hypot(ex, ez);
        let nx = ez / l, nz = -ex / l;
        const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, ccx = (P[0][0] + P[2][0]) / 2, ccz = (P[0][1] + P[2][1]) / 2;
        if ((mx - ccx) * nx + (mz - ccz) * nz < 0) { nx = -nx; nz = -nz; }
        const nb = Math.max(1, Math.round(l / bayW));
        buf.q([[A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]]], [nx, 0, nz], info, tint,
          [[u0w, (y0 - base) / fh], [u0w + nb, (y0 - base) / fh], [u0w + nb, (y1 - base) / fh], [u0w, (y1 - base) / fh]]);
      }
    };
    const cap = (rc, y, info, tint) => { const [a0, a1, b0, b1] = rc, P = [at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)]; buf.q(P.map((p) => [p[0], y, p[1]]), [0, 1, 0], info, tint); };
    const ledge = (rc, y, hgt, out, info, tint) => { const [a0, a1, b0, b1] = rc; const o2 = [a0 - out, a1 + out, b0 - out, b1 + out]; tier(o2, y, y + hgt, info, tint); cap(o2, y + hgt, info, tint); const P = [at(o2[0], o2[2]), at(o2[1], o2[2]), at(o2[1], o2[3]), at(o2[0], o2[3])]; buf.q(P.map((p) => [p[0], y, p[1]]), [0, -1, 0], info, tint); };
    const pyramid = (rc, y, hgt, info, tint) => {
      const [a0, a1, b0, b1] = rc, P = [at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)], c = at((a0 + a1) / 2, (b0 + b1) / 2), apex = [c[0], y + hgt, c[1]];
      for (let k = 0; k < 4; k++) {
        const A = [P[k][0], y, P[k][1]], B = [P[(k + 1) % 4][0], y, P[(k + 1) % 4][1]];
        const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [apex[0] - A[0], apex[1] - A[1], apex[2] - A[2]];
        let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const nl = Math.hypot(...n); n = n.map((v) => v / nl);
        if (n[1] < 0) n = n.map((v) => -v);
        buf.poly([A, B, apex], n, info, tint);
      }
    };
    const mast = (rc, y, hgt) => {
      const [a0, a1, b0, b1] = rc, cu = (a0 + a1) / 2 + (R() - 0.5) * (a1 - a0) * 0.3, cv = (b0 + b1) / 2 + (R() - 0.5) * (b1 - b0) * 0.3;
      tier([cu - 0.2, cu + 0.2, cv - 0.2, cv + 0.2], y, y + hgt, [-1, -1, seed, enc(PBR.METAL, MODE.PLAIN)], darkMetal);
      const [x, z] = at(cu, cv); beacons.push([x, y + hgt + 0.2, z]);
    };
    const roofInfo = [-1, -1, seed, enc(st.roofPbr, MODE.PLAIN)], trimInfo = [-1, -1, seed, enc(st.trimPbr, MODE.PLAIN)];
    const shrink = (rc, k) => { const [a0, a1, b0, b1] = rc, du = (a1 - a0) * k, dv = (b1 - b0) * k; return [a0 + du, a1 - du, b0 + dv, b1 - dv]; };
    let y = top; // walls rise from the roof slab, inside the parapet ring
    void parapet;
    if (st.curtain) {
      // a glass top floor set back, then a tall mechanical screen
      const t1 = 1 + Math.floor(R() * 2);
      tier(rect, y, y + t1 * fh, wallInfo(st.pbr), st.glassTint || st.tint);
      cap(rect, y + t1 * fh, roofInfo, st.roofTint);
      const sc = shrink(rect, 0.12 + R() * 0.1), sh = 4 + R() * 5;
      tier(sc, y + t1 * fh, y + t1 * fh + sh, [-1, -1, seed, enc(PBR.METAL, MODE.PLAIN)], screenT, 3);
      cap(sc, y + t1 * fh + sh, roofInfo, st.roofTint);
      if (fp.h > 120 && R() < 0.6) mast(sc, y + t1 * fh + sh, 8 + R() * 14);
      counts.glass++;
    } else if (st.prewar || st.cat === 'masonry') {
      // wedding cake: two or three tiers, a ledge at each, then a top
      const n = 2 + (R() < 0.4 ? 1 : 0);
      let rc = rect;
      for (let k = 0; k < n; k++) {
        const fl = 1 + Math.floor(R() * (k === 0 ? 3 : 2)), y1 = y + fl * fh;
        tier(rc, y, y1, wallInfo(st.pbr), st.tint);
        ledge(rc, y1 - 0.15, 0.35, 0.3, trimInfo, st.trimTint);
        cap(rc, y1 + 0.23, roofInfo, st.roofTint); // a few cm over the ledge top (no coplanar faces)
        y = y1 + 0.23;
        const next = shrink(rc, 0.1 + R() * 0.08);
        if (next[1] - next[0] < 5 || next[3] - next[2] < 5) break;
        rc = next;
      }
      const r3 = R();
      if (r3 < 0.45) { pyramid(rc, y, 0.45 * Math.min(rc[1] - rc[0], rc[3] - rc[2]), [-1, -1, seed, enc(PBR.METAL, MODE.PLAIN)], copper); counts.pyramids++; }
      else if (r3 < 0.7) {
        const lt = shrink(rc, 0.3), lh = 2 * fh;
        tier(lt, y, y + lh, wallInfo(st.pbr), st.tint); ledge(lt, y + lh - 0.1, 0.3, 0.25, trimInfo, st.trimTint);
        pyramid(lt, y + lh + 0.2, 0.6 * Math.min(lt[1] - lt[0], lt[3] - lt[2]), [-1, -1, seed, enc(PBR.METAL, MODE.PLAIN)], copper);
        mast(shrink(lt, 0.45), y + lh + 0.2, 6 + R() * 8);
        counts.lanterns++;
      } else {
        // corner turrets on the last tier, with pyramid caps
        const s = Math.min(3.2, (rc[1] - rc[0]) * 0.18, (rc[3] - rc[2]) * 0.18), th = fh * (1 + R());
        for (const [cu, cv] of [[rc[0], rc[2]], [rc[1], rc[2]], [rc[1], rc[3]], [rc[0], rc[3]]]) {
          const tr = [cu - s / 2, cu + s / 2, cv - s / 2, cv + s / 2];
          tier(tr, y, y + th, [-1, -1, seed, enc(st.pbr, MODE.PLAIN)], st.tint);
          ledge(tr, y + th - 0.1, 0.25, 0.15, trimInfo, st.trimTint);
          pyramid(tr, y + th + 0.15, s * 0.9, [-1, -1, seed, enc(PBR.METAL, MODE.PLAIN)], copper);
        }
        counts.turrets++;
      }
      counts.deco++;
    } else {
      // post-war / office: a setback floor and a mechanical screen
      const fl = 1 + Math.floor(R() * 2);
      tier(rect, y, y + fl * fh, wallInfo(st.pbr), st.tint);
      ledge(rect, y + fl * fh - 0.1, 0.25, 0.15, trimInfo, st.trimTint);
      const yc = y + fl * fh + 0.18; // a few cm over the ledge top (no coplanar faces)
      cap(rect, yc, roofInfo, st.roofTint);
      const sc = shrink(rect, 0.15 + R() * 0.12), sh = 3.5 + R() * 3;
      tier(sc, yc, yc + sh, [-1, -1, seed, enc(PBR.METAL, MODE.PLAIN)], screenT, 3);
      cap(sc, yc + sh, roofInfo, st.roofTint);
      if (fp.h > 100 && R() < 0.5) mast(sc, yc + sh, 6 + R() * 10);
      counts.mech++;
    }
    crowned.add(bd);
    if (samples.length < 60) samples.push({ c: [cx, top, cz], h: fp.h, kind: st.curtain ? 'glass' : st.prewar || st.cat === 'masonry' ? 'deco' : 'mech' });
    counts.towers++;
  }
  const group = new THREE.Group(); group.name = 'crowns';
  const mesh = buf.build(world.mat.facadeSet, 'crowns');
  if (mesh) { mesh.castShadow = false; group.add(mesh); }
  counts.tris = buf.tris;
  o.scene.add(group);
  return { group, mesh, crowned, beacons, counts, samples };
}
