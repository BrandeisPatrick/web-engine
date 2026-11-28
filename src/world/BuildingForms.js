// Described buildings: the geometry of a building that carries a descriptor (BuildingDescriptors.js). Everything goes
// into the builder's merged base buffer with the one facade material (no draw call of its own):
//   massing   a podium on the OSM outline, a shaft on the outline or a plan override (square, rect, cylinder, octagon),
//             setbacks (each a smaller ring from a floor line up), a taper, a raised part's underside;
//   facade    MODE.GRID walls (Buildings.js): bays x floors of glass set back between piers and spandrels, by system
//             (curtain-wall, piers, ribbon, punched) and material (the PBR set and tint, or metal / glass), the
//             building's glass colour, reflectance and lit share at night; a taller ground floor (lobby glazing with
//             an entrance canopy, shop fronts, an arcade of columns);
//   crown     flat (parapet, a louvred mechanical screen, plant), stepped, pyramid-spire, open-lattice, mansard,
//             cylinder, dome with a lantern, antenna masts with beacons; gold / copper / steel / stone / glass /
//             concrete (MODE.SURF), floodlit at night in the descriptor's colour;
//   night     a roof-edge light band, a sign in real letters (5 x 7 pixels, one quad per run) on the two widest faces;
//   forms     church (nave with a ridge roof, a tower with a spire), stadium (a raked bowl round a field), arena (a
//             shallow dome), parking deck (open trays, a stair core), warehouse (blank walls, a clerestory, dock doors).
// buildDescribed(builder, buf, b, D, F, rnd): b = the city.json building, D = resolved descriptor, F = the builder's
// footprint(b) (F.tower: the plan override over a podium), rnd = the building's seeded RNG. Heights are local (0 = the
// footprint's base); the builder lifts the vertices afterwards. Deterministic.
// planRing(outer, D, area) -> ring: a descriptor's plan override in the frame of the outline's longest edge.
// packGrid / packSurf / rgb555 / tintFor: the vertex info of the two shader modes (also for game code that adds its
// own described pieces to a GeoBuf).
import { FACADE, PBR, PBR_SETS } from './FacadeTextures.js';
import { signedArea, centroid, clamp, pointInRing } from './geom.js';
import { signRuns } from './BuildingDescriptors.js';
import { MODE, enc, insetRing, offsetRing, longAxis, isConvex, starShaped, minWidth, insertRidgePoints, splitByRidge } from './Buildings.js';

// ------------------------------------------------------------------ vertex info
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** aTint bytes that show an sRGB colour [r, g, b] (0..1) on a tintable PBR set (neutral albedo 0.58); k scales it. */
export function tintFor(rgb, k = 1) {
  let r = (lin(rgb[0]) / 0.58) * k, g = (lin(rgb[1]) / 0.58) * k, b = (lin(rgb[2]) / 0.58) * k;
  const m = Math.max(r, g, b);
  if (m > 1) { r /= m; g /= m; b /= m; }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
/** A colour [r, g, b] sRGB 0..1 in one info component (5 bits a channel). */
export const rgb555 = (c) => (Math.round(clamp(c[0], 0, 1) * 31) << 10) | (Math.round(clamp(c[1], 0, 1) * 31) << 5) | Math.round(clamp(c[2], 0, 1) * 31);
/**
 * MODE.GRID info.x: pier / span = the opaque share of a bay's width / a floor's height (0..0.75), emph 0 bands proud
 * (ribbon), 1 flush, 2 / 3 piers proud, kind 0 wall material, 1 curtain wall, 2 metal panels, 3 open decks,
 * lit = the share of lit windows at night (null: the scene's).
 */
export function packGrid({ pier = 0.3, span = 0.4, emph = 1, kind = 0, lit = null }) {
  return clamp(Math.round(pier / 0.05), 0, 15) + 16 * clamp(Math.round(span / 0.05), 0, 15) + 256 * (emph & 3) + 1024 * (kind & 3) + 4096 * (lit == null ? 0 : 1 + clamp(Math.round(lit * 6), 0, 6));
}
/** MODE.GRID info.z: the building's seed (0..1) with the glass reflectance (0..1) and panes per bay (1..4). */
export const packGridSeed = (seed, reflect = 0.4, panes = 1) => (Math.min(999, Math.floor(seed * 1000)) + 1024 * (clamp(Math.round(reflect * 7), 0, 7) + 8 * clamp(panes - 1, 0, 3))) / 1000;
/** MODE.SURF info.x: metal, rough 0..1, glow 0..4 (the night light's strength), pat 0 plain, 1 lattice, 2 louvres, 3 ribs. */
export function packSurf({ metal = 0, rough = 0.7, glow = 0, pat = 0 }) {
  return clamp(Math.round(metal * 15), 0, 15) + 16 * clamp(Math.round(rough * 15), 0, 15) + 256 * clamp(Math.round((glow / 4) * 15), 0, 15) + 4096 * (pat & 7);
}

// ------------------------------------------------------------------ materials
const WALL = {
  granite: { pbr: PBR.GRANITE, color: [0.71, 0.65, 0.58] }, limestone: { pbr: PBR.CONCRETE_PANEL, color: [0.82, 0.78, 0.69] },
  marble: { pbr: PBR.GRANITE, color: [0.89, 0.87, 0.85] }, precast: { pbr: PBR.CONCRETE_PANEL, color: [0.79, 0.76, 0.71] },
  concrete: { pbr: PBR.CONCRETE_ROUGH, color: [0.63, 0.6, 0.56] }, stucco: { pbr: PBR.STUCCO_B, color: [0.86, 0.83, 0.76] },
  brick: { pbr: PBR.BRICK_RED, color: [0.55, 0.3, 0.24] }, metal: { pbr: PBR.PLAIN, color: [0.66, 0.67, 0.65], kind: 2 },
  glass: { pbr: PBR.PLAIN, color: [0.5, 0.5, 0.5], kind: 1 },
};
/** The wall material of a resolved descriptor: { pbr, tint (aTint bytes), kind (MODE.GRID kind), color (sRGB) }. */
function wallMaterial(D) {
  const W = WALL[D.material] || WALL.precast, col = D.color || W.color;
  let pbr = W.pbr, tint;
  if (D.material === 'brick') {
    // the red brick scan keeps its own colour (not tintable): a reddish colour only shades it, any other colour is paint
    const red = col[0] > 1.1 * col[1] && col[0] > 1.25 * col[2];
    if (red) { const k = clamp((lin(col[0]) + lin(col[1]) + lin(col[2])) / 0.36, 0.55, 1.15); tint = [255, 255, 255].map((v) => Math.min(255, Math.round(v * k))); if (k < 0.7) pbr = PBR.BRICK_DARK; } else { pbr = PBR.BRICK_PAINTED; tint = tintFor(col); }
  } else tint = tintFor(col);
  return { pbr, tint, kind: W.kind || 0, color: col };
}
const CROWN = {
  gold: { color: [0.96, 0.76, 0.36], metal: 1, rough: 0.3 }, copper: { color: [0.4, 0.62, 0.52], metal: 0.3, rough: 0.6 },
  steel: { color: [0.7, 0.72, 0.74], metal: 0.9, rough: 0.35 }, stone: { color: null, metal: 0, rough: 0.85 },
  glass: { color: [0.2, 0.26, 0.32], metal: 0.7, rough: 0.1 }, concrete: { color: [0.66, 0.64, 0.6], metal: 0, rough: 0.9 },
};

// ------------------------------------------------------------------ rings
const scaleRing = (r, c, s) => r.map((p) => [c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s]);
function circleRing(cx, cz, r, n, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = rot - (i / n) * Math.PI * 2; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return signedArea(out) > 0 ? out : out.reverse();
}
/** Extents of a ring in the frame of its longest edge: { ux, uz, vx, vz, cx, cz (the box centre), W, Dp }. */
function obb(ring) {
  const ax = longAxis(ring), c = centroid(ring), ux = ax[0], uz = ax[1], vx = -uz, vz = ux;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of ring) { const u = (p[0] - c[0]) * ux + (p[1] - c[1]) * uz, v = (p[0] - c[0]) * vx + (p[1] - c[1]) * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const mu = (u0 + u1) / 2, mv = (v0 + v1) / 2;
  return { ux, uz, vx, vz, cx: c[0] + ux * mu + vx * mv, cz: c[1] + uz * mu + vz * mv, W: u1 - u0, Dp: v1 - v0 };
}
function rectRing(o, w, d) {
  const r = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [o.cx + o.ux * u + o.vx * v, o.cz + o.uz * u + o.vz * v]);
  return signedArea(r) > 0 ? r : r.reverse();
}
/**
 * A descriptor's plan override as a ring (positive area), in the frame of the outline's longest edge and centred on its
 * bounding box: square / rect (D.planW x D.planD, default: the outline's area), cylinder (a 16..48-gon), octagon.
 */
export function planRing(outer, D, area) {
  const o = obb(outer);
  if (D.plan === 'cylinder' || D.plan === 'octagon') {
    const r = D.planW ? D.planW / 2 : Math.min(Math.sqrt(area / Math.PI), Math.min(o.W, o.Dp) / 2);
    const n = D.plan === 'octagon' ? 8 : clamp(4 * Math.round((2 * Math.PI * r) / 4.6 / 4), 16, 48);
    return circleRing(o.cx, o.cz, r, n, Math.atan2(o.uz, o.ux) + Math.PI / n);
  }
  if (D.plan === 'square') { const s = D.planW || Math.min(Math.sqrt(area), o.W, o.Dp); return rectRing(o, s, s); }
  const k = Math.min(1, Math.sqrt(area / Math.max(1, o.W * o.Dp)));
  return rectRing(o, D.planW || o.W * k, D.planD || o.Dp * k);
}
/** A ring set back by `frac` of its half width all round (convex rings: a true inset; else a scale about the centroid). */
function shrinkRing(ring, frac) {
  if (!(frac > 0)) return ring;
  const c = centroid(ring), d = frac * minWidth(ring) * 0.5;
  if (ring.length > 12 || !isConvex(ring)) return starShaped(ring, c) ? scaleRing(ring, c, Math.max(0.2, 1 - frac)) : ring;
  const r = insetRing(ring, d);
  if (!r || !(signedArea(r) > 4) || r.some((p) => !pointInRing(p[0], p[1], ring))) return scaleRing(ring, c, Math.max(0.2, 1 - frac));
  return r;
}
/** A ring a crown can stand on: the ring itself when it is star-shaped round its centroid, else its bounding rectangle, smaller. */
function crownRing(ring) {
  const c = centroid(ring);
  if (starShaped(ring, c)) return ring;
  const o = obb(ring), k = Math.sqrt(Math.abs(signedArea(ring)) / Math.max(1, o.W * o.Dp)) * 0.8;
  return rectRing(o, o.W * k, o.Dp * k);
}
const edgeFrame = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-6; return { ax: a[0], az: a[1], dx: dx / L, dz: dz / L, ox: dz / L, oz: -dx / L, L, mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2 }; };
/** Indices of a ring's edges, longest first. */
function edgesByLength(ring) {
  const e = ring.map((p, i) => { const q = ring[(i + 1) % ring.length]; return [Math.hypot(q[0] - p[0], q[1] - p[1]), i]; });
  return e.sort((a, b) => b[0] - a[0] || a[1] - b[1]).map((x) => x[1]);
}

// ------------------------------------------------------------------ emitters
/**
 * Walls from ring ra at ya up to ring rb at yb (same vertex count; rb smaller or larger = a leaning wall).
 * o: { info | info(i, L, nb), tint, bay, v0, v1 (the facade v at ya / yb), metres (fuv in metres: u along the ring, v =
 * height), smooth (radial normals: a round shaft), wallU (false: no continuous PBR u / street grime), both (two-sided) }
 */
function emitWalls(ctx, ra, ya, rb, yb, o) {
  const { buf, bld } = ctx, n = ra.length, c = o.smooth ? centroid(ra) : null;
  let per = 0;
  for (let i = 0; i < n; i++) per += Math.hypot(ra[(i + 1) % n][0] - ra[i][0], ra[(i + 1) % n][1] - ra[i][1]);
  const tile = (PBR_SETS[o.pbr ?? ctx.wall.pbr] || {}).size || 2;
  const kU = per > tile ? (Math.max(1, Math.round(per / tile)) * tile) / per : 1;
  const rad = (p) => { const x = p[0] - c[0], z = p[1] - c[1], l = Math.hypot(x, z) || 1; return [x / l, 0, z / l]; };
  let cum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = ra[i], b = ra[j], ta = rb[i], tb = rb[j];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 0.05) continue;
    const ux = dx / L, uz = dz / L, ex = ta[0] - a[0], ey = yb - ya, ez = ta[1] - a[1];
    let nx = uz * ey, ny = ux * ez - uz * ex, nz = -ux * ey;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const nA = o.smooth ? rad(a) : [nx, ny, nz], nB = o.smooth ? rad(b) : nA;
    const nb = Math.max(1, Math.round(L / (o.bay || 3)));
    const info = typeof o.info === 'function' ? o.info(i, L, nb) : o.info;
    if (!info) { cum += L; continue; }
    const uA = o.metres ? cum : (o.u0 || 0), uB = o.metres ? cum + L : (o.u0 || 0) + nb, vA = o.metres ? ya : o.v0, vB = o.metres ? yb : o.v1;
    buf.wall = o.wallU === false ? null : { u0: cum, sg: 1, k: kU, ax: a[0], az: a[1], dx: ux, dz: uz, gy: bld.groundAt, ao: -1e4 };
    cum += L;
    // a wall that narrows upward is a trapezoid: one quad would bend the bays along its diagonal, so it goes bay by bay
    const lean = !o.metres && Math.abs(Math.hypot(tb[0] - ta[0], tb[1] - ta[1]) - L) > 0.02, mx = (p, r, t) => p + (r - p) * t;
    // where the street climbs along the wall (o.street: a wall that stands on the ground) the part below street level
    // + 0.4 m is a plain plinth, in slices of about 5 m: no glass under the sidewalk
    let ns = lean ? Math.min(nb, 64) : 1, plinth = null;
    if (o.street && ctx.gl && !lean) {
      const m = Math.max(1, Math.ceil(L / 5)), g = [];
      for (let q = 0; q < m; q++) { const p0 = q / m, p1 = (q + 1) / m, pm = (p0 + p1) / 2; g.push(Math.max(ctx.gl(mx(a[0], b[0], p0), mx(a[1], b[1], p0)), ctx.gl(mx(a[0], b[0], p1), mx(a[1], b[1], p1)), ctx.gl(mx(a[0], b[0], pm), mx(a[1], b[1], pm)))); }
      if (g.some((v) => v > ya + 0.12)) { ns = m; plinth = g; }
    }
    for (const s of o.both ? [1, -1] : [1]) {
      for (let q = 0; q < ns; q++) {
        const t0 = q / ns, t1 = (q + 1) / ns;
        const n0 = ns === 1 ? nA : [mx(nA[0], nB[0], t0), mx(nA[1], nB[1], t0), mx(nA[2], nB[2], t0)], n1 = ns === 1 ? nB : [mx(nA[0], nB[0], t1), mx(nA[1], nB[1], t1), mx(nA[2], nB[2], t1)];
        let yLo = ya, vLo = vA;
        if (plinth && plinth[q] > ya + 0.12) {
          yLo = Math.min(yb, plinth[q] + 0.4); vLo = vA + ((vB - vA) * (yLo - ya)) / (yb - ya);
          const p0 = buf.v(mx(a[0], b[0], t0), ya, mx(a[1], b[1], t0), n0[0], n0[1], n0[2], 0, 0, ctx.plainWall, ctx.plainTint), p1 = buf.v(mx(a[0], b[0], t1), ya, mx(a[1], b[1], t1), n1[0], n1[1], n1[2], 0, 0, ctx.plainWall, ctx.plainTint);
          const p2 = buf.v(mx(a[0], b[0], t1), yLo, mx(a[1], b[1], t1), n1[0], n1[1], n1[2], 0, 0, ctx.plainWall, ctx.plainTint), p3 = buf.v(mx(a[0], b[0], t0), yLo, mx(a[1], b[1], t0), n0[0], n0[1], n0[2], 0, 0, ctx.plainWall, ctx.plainTint);
          buf.quad(p0, p1, p2, p3);
          if (yb - yLo < 0.02) continue;
        }
        const k0 = buf.v(mx(a[0], b[0], t0), yLo, mx(a[1], b[1], t0), n0[0] * s, n0[1] * s, n0[2] * s, mx(uA, uB, t0), vLo, info, o.tint), k1 = buf.v(mx(a[0], b[0], t1), yLo, mx(a[1], b[1], t1), n1[0] * s, n1[1] * s, n1[2] * s, mx(uA, uB, t1), vLo, info, o.tint);
        const k2 = buf.v(mx(ta[0], tb[0], t1), yb, mx(ta[1], tb[1], t1), n1[0] * s, n1[1] * s, n1[2] * s, mx(uA, uB, t1), vB, info, o.tint), k3 = buf.v(mx(ta[0], tb[0], t0), yb, mx(ta[1], tb[1], t0), n0[0] * s, n0[1] * s, n0[2] * s, mx(uA, uB, t0), vB, info, o.tint);
        buf.quad(k0, k1, k2, k3);
      }
    }
    buf.wall = null;
  }
}
/** Faces from a ring at y0 up to a point (apex [x, y, z]): fuv in metres (u along the base edge, v up the slope). */
function emitCone(ctx, ring, y0, apex, info, tint, both = false) {
  const { buf } = ctx, n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.02) continue;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, sl = Math.hypot(apex[0] - mx, apex[1] - y0, apex[2] - mz);
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, ex = apex[0] - a[0], ey = apex[1] - y0, ez = apex[2] - a[1];
    let nx = uz * ey, ny = ux * ez - uz * ex, nz = -ux * ey;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    for (const s of both ? [1, -1] : [1]) {
      const k0 = buf.v(a[0], y0, a[1], nx * s, ny * s, nz * s, 0, 0, info, tint), k1 = buf.v(b[0], y0, b[1], nx * s, ny * s, nz * s, L, 0, info, tint);
      const k2 = buf.v(apex[0], apex[1], apex[2], nx * s, ny * s, nz * s, L / 2, sl, info, tint);
      buf.tri(k0, k1, k2);
    }
  }
}
/** A flat band between two rings of the same vertex count at heights ya (outer ring) and yb (inner ring), facing up (or down). */
function emitBand(ctx, ra, ya, rb, yb, info, tint, up = true) {
  const { buf } = ctx, n = ra.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = ra[i], b = ra[j], c = rb[j], d = rb[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.02) continue;
    const P = [[a[0], ya, a[1]], [b[0], ya, b[1]], [c[0], yb, c[1]], [d[0], yb, d[1]]];
    // the face normal, turned up (or down)
    const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[3][0] - P[0][0], P[3][1] - P[0][1], P[3][2] - P[0][2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    if ((ny < 0) === up) { nx = -nx; ny = -ny; nz = -nz; }
    const w = Math.hypot(d[0] - a[0], yb - ya, d[1] - a[1]);
    buf.q(P, [nx, ny, nz], info, tint, [[0, 0], [L, 0], [L, w], [0, w]]);
  }
}
/** A dome with smooth normals: centre (cx, cz), base y, radius r, height h; n segments round, m rings up. fuv in metres. */
function emitDome(ctx, cx, cz, y, r, h, n, m, info, tint) {
  const { buf } = ctx, rows = [];
  for (let j = 0; j < m; j++) {
    const ph = (j / m) * Math.PI * 0.5, rr = Math.cos(ph), yy = Math.sin(ph), row = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      let nx = (ca * rr) / r, ny = yy / h, nz = (sa * rr) / r; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      row.push(buf.v(cx + ca * r * rr, y + h * yy, cz + sa * r * rr, nx, ny, nz, (i / n) * 2 * Math.PI * r, ph * r, info, tint));
    }
    rows.push(row);
  }
  for (let j = 0; j + 1 < m; j++) for (let i = 0; i < n; i++) buf.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]);
  const top = rows[m - 1];
  for (let i = 0; i < n; i++) { const k = buf.v(cx, y + h, cz, 0, 1, 0, ((i + 0.5) / n) * 2 * Math.PI * r, Math.PI * 0.5 * r, info, tint); buf.tri(top[i], top[i + 1], k); }
}
/** A mast: a tapering square needle from y0 to y1 (width w0 at the foot), a red beacon on top when `beacon`. */
function emitMast(ctx, x, z, y0, y1, w0, info, tint, beacon = true) {
  const { bld, buf, rnd } = ctx, h = y1 - y0;
  if (h < 1) return;
  const foot = circleRing(x, z, w0 * 0.7, 4, Math.PI / 4), c = [x, z];
  emitWalls(ctx, foot, y0, scaleRing(foot, c, 0.45), y0 + h * 0.6, { info, tint, metres: true, wallU: false });
  emitCone(ctx, scaleRing(foot, c, 0.45), y0 + h * 0.6, [x, y1, z], info, tint);
  if (beacon) bld.box(buf, x, z, y1 - 0.5, 0.55, 0.55, 0.5, 0, [2, -1, rnd(), enc(PBR.PLAIN, MODE.LED)], [255, 26, 13]);
}

// ------------------------------------------------------------------ context
function context(bld, buf, b, D, F, rnd) {
  const seed = rnd(), wall = wallMaterial(D), H = F.h, y0 = F.mh > 0.5 ? F.mh : 0;
  const lit = D.night.crownLight || D.crown.lit || null;
  const ctx = { bld, buf, b, D, F, rnd, seed, wall, H, y0, c: F.c, lit, glass: rgb555(D.glass) };
  // the street above the base (the lowest outline point) at a point of the outline: walls keep their glass above it
  ctx.gl = bld.groundAt && y0 === 0 ? (x, z) => bld.groundAt(x, z) - F.base : null;
  ctx.plainWall = [-1, -1, seed, enc(wall.kind === 1 ? PBR.GRANITE : wall.pbr, MODE.WALLONLY)];
  ctx.plainTint = wall.kind === 1 ? tintFor([0.5, 0.49, 0.48]) : wall.tint;
  ctx.trim = [-1, -1, seed, enc(wall.kind ? PBR.PLAIN : PBR.CONCRETE_PANEL, MODE.PLAIN)];
  ctx.trimTint = wall.kind ? tintFor([0.62, 0.63, 0.64]) : tintFor(wall.color.map((v) => Math.min(1, v * 1.06 + 0.02)));
  ctx.roof = [-1, -1, seed, enc(PBR.ROOF_TAR, MODE.PLAIN)];
  ctx.roofTint = tintFor([[0.5, 0.5, 0.5], [0.4, 0.4, 0.41], [0.62, 0.61, 0.58], [0.72, 0.72, 0.7]][Math.floor(rnd() * 4)]);
  return ctx;
}
/** A crown / screen / sign surface: { info, tint } for a CROWN material name (or 'wall'), lit at night when `glow`. */
function surface(ctx, material, o = {}) {
  const { wall } = ctx, M = CROWN[material] || CROWN.stone;
  const col = o.color || M.color || wall.color;
  const lit = o.lit !== undefined ? o.lit : ctx.lit, glow = lit ? (o.glow ?? 1.6) : 0;
  const pbr = M.metal > 0.2 ? PBR.PLAIN : material === 'concrete' ? PBR.CONCRETE_ROUGH : material === 'stone' && wall.kind === 0 ? wall.pbr : PBR.PLAIN;
  return {
    info: [packSurf({ metal: o.metal ?? M.metal, rough: o.rough ?? M.rough, glow, pat: o.pat || 0 }), lit ? rgb555(lit) : 0, 0, enc(pbr, MODE.SURF)],
    tint: pbr === wall.pbr && !o.color && material === 'stone' ? wall.tint : tintFor(col),
  };
}
/** The facade grid of the descriptor's system: { info, tint, bay } for the upper floors (or the lobby with `ground`). */
function facade(ctx, ground = false) {
  const { D, wall, seed, glass } = ctx, v = D.vertical;
  let pier, span, emph, kind = wall.kind, panes = 1;
  const bay = D.bay || 3;
  if (D.system === 'curtain-wall') { pier = v > 0.6 ? 0.1 : 0.05; span = v > 0.6 ? 0.2 : 0.3; emph = v > 0.6 ? 2 : 1; if (kind === 0) kind = 1; }
  else if (D.system === 'piers') { pier = 0.25 + 0.3 * v; span = 0.3; emph = v > 0.75 ? 3 : 2; panes = bay > 2.4 ? 2 : 1; }
  else if (D.system === 'ribbon') { pier = 0.05; span = 0.45 + 0.1 * (1 - v); emph = 0; panes = 2; }
  else { pier = 0.3 + 0.15 * v; span = 0.5 - 0.15 * v; emph = 1; panes = bay > 2.6 ? 2 : 1; }
  let lit = D.night.litFraction, reflect = D.glassReflect, b2 = bay;
  if (ground) {
    // a lobby: tall glass between the same piers (every second or third bay line), a kerb, lit at night
    b2 = clamp(bay * (bay < 2.2 ? 3 : 2), 3.5, 9); pier = kind === 1 ? 0.05 : Math.min(0.3, (pier * bay) / b2 + 0.05); span = 0.1; emph = kind === 1 ? 1 : 2; panes = 3; lit = 0.85; reflect *= 0.6;
  }
  return { info: [packGrid({ pier, span, emph, kind, lit }), glass, packGridSeed(seed, reflect, panes), enc(kind === 1 ? PBR.PLAIN : wall.pbr, MODE.GRID)], tint: wall.tint, bay: b2 };
}

// ------------------------------------------------------------------ tiers (towers, slabs, blocks)
function tiers(ctx) {
  const { bld, buf, D, F, rnd, H, y0 } = ctx;
  const site = F.outer, foundation = y0 === 0 ? bld.foundation : 0;
  // ---- floors: a ground floor of its own height, then equal floors up to the roof
  const fhWant = D.floorHeight || (D.floors ? clamp((H - y0) / D.floors, 2.7, 6.5) : 3.8);
  const parking = D.form === 'parking';
  let gH = 0;
  if (y0 === 0 && D.ground.use && !parking) { gH = clamp(D.ground.height ?? (H > 60 ? 2 * fhWant : H > 22 ? 1.5 * fhWant : fhWant + 0.6), 3, Math.min(16, H * 0.3)); if (gH < 2.8 || H - gH < 2.6) gH = 0; }
  const nU = Math.max(1, Math.round((H - y0 - gH) / fhWant)), fh = (H - y0 - gH) / nU, yG = y0 + gH;
  const snap = (y) => yG + clamp(Math.round((y - yG) / fh), 1, nU - 1) * fh;
  const vOf = (y) => (y - yG) / fh;
  // ---- segments, bottom to top: [ring, ya, yb]
  const segs = [];
  let shaft = F.tower ? (D.planW ? F.tower : scaleRing(F.tower, centroid(F.tower), 1 - D.podium.inset)) : site, yS = y0;
  if (D.podium && nU >= 3) {
    const ph = D.podium.height ?? (D.podium.floors || 3) * fh;
    yS = snap(y0 + clamp(ph, fh, (H - y0) * 0.6));
    if (!F.tower) shaft = shrinkRing(site, D.podium.inset);
    segs.push({ ring: site, ya: y0, yb: yS, podium: true });
  }
  const cuts = [];
  for (const s of D.setbacks) { const y = snap(s.at * H); if (y > yS + fh * 0.5 && y < H - fh * 0.5 && !cuts.some((q) => Math.abs(q.y - y) < fh * 0.5)) cuts.push({ y, inset: s.inset }); }
  let ring = shaft, ya = yS;
  for (const cu of cuts) { segs.push({ ring, ya, yb: cu.y }); ring = shrinkRing(ring, cu.inset); ya = cu.y; }
  segs.push({ ring, ya, yb: H });
  // a taper narrows the shaft linearly from its foot to the roof
  const cS = centroid(shaft), tap = (r, y) => (D.taper && y > yS ? scaleRing(r, cS, 1 - (D.taper * (y - yS)) / Math.max(1, H - yS)) : r);
  const smooth = (r) => r.length >= 16;
  const up = facade(ctx), lobby = facade(ctx, true);
  if (parking) up.info = [packGrid({ pier: 0.05, span: 0.35, emph: 0, kind: 3 }), 0, packGridSeed(ctx.seed, 0, 1), enc(ctx.wall.pbr, MODE.GRID)];
  // courtyards stay open where the outline runs straight up (no plan override, setback or taper)
  const holes = segs.length === 1 && !D.taper && !F.tower ? F.holes : [];
  for (const hr of holes) emitWalls(ctx, hr, y0, hr, H, { info: up.info, tint: up.tint, bay: up.bay, v0: vOf(y0), v1: vOf(H) });
  ctx.holes = holes;
  let top = null;
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k], ra = tap(s.ring, s.ya), rb = tap(s.ring, s.yb), last = k === segs.length - 1;
    let yb0 = s.ya;
    if (k === 0 && y0 === 0) {
      if (foundation) emitWalls(ctx, ra, -foundation, ra, 0, { info: ctx.plainWall, tint: ctx.plainTint, metres: true });
      if (gH > 0) { groundFloor(ctx, ra, gH, lobby, smooth(ra)); yb0 = gH; }
    } else if (k === 0 && y0 > 2) bld.flatPolygon(buf, ra, [], y0, ctx.roof, ctx.roofTint, false);
    const rm = yb0 > s.ya ? tap(s.ring, yb0) : ra;
    emitWalls(ctx, rm, yb0, rb, s.yb, { info: up.info, tint: up.tint, bay: up.bay, v0: vOf(yb0), v1: vOf(s.yb), smooth: smooth(ra), u0: Math.floor(ctx.seed * 4), street: yb0 === 0 });
    if (!last) {
      // a terrace: the roof of this step, a coping round its edge
      bld.flatPolygon(buf, rb, [], s.yb, ctx.roof, ctx.roofTint, true);
      bld.ledge(buf, rb, s.yb - 0.1, 0.55, 0.14, ctx.trim, ctx.trimTint);
    } else top = rb;
  }
  crown(ctx, top, H, { fh, up, smooth: smooth(top), parking });
  if (D.night.sign) sign(ctx, top, H, D.night.sign);
  void rnd;
}

/** The ground floor of a ring from 0 to gH by the descriptor's ground use, with an entrance on the widest street face. */
function groundFloor(ctx, ring, gH, lobby, smooth) {
  const { bld, buf, D, seed, wall, rnd } = ctx, use = D.ground.use;
  const order = edgesByLength(ring);
  let front = order[0];
  for (const i of order.slice(0, 4)) { const f = edgeFrame(ring[i], ring[(i + 1) % ring.length]); if (f.L > 5 && bld.isStreet(f.mx + f.ox * 4.5, f.mz + f.oz * 4.5)) { front = i; break; } }
  const F0 = edgeFrame(ring[front], ring[(front + 1) % ring.length]);
  if (use === 'retail') {
    // shop fronts: the engine's lit shop glazing, a sign band and awnings from the generic builder
    const bay = clamp(D.bay || 4, 3.2, 6);
    emitWalls(ctx, ring, 0, ring, gH, { street: true, info: [FACADE.STOREFRONT, -1, seed, enc(wall.kind ? PBR.CONCRETE_PANEL : wall.pbr, MODE.WALL)], tint: wall.kind ? tintFor([0.6, 0.6, 0.6]) : wall.tint, bay, v0: 0, v1: 1, smooth });
    for (const i of order.slice(0, 3)) {
      const a = ring[i], b = ring[(i + 1) % ring.length], f = edgeFrame(a, b);
      if (f.L >= 6 && bld.style.storeDressing !== false && bld.isStreet(f.mx + f.ox * 4.5, f.mz + f.oz * 4.5)) bld.storefront(buf, f, { bayW: bay, prewar: D.material === 'brick' }, Math.min(gH, 4.6), rnd, seed, 0, ctx.gl ? (s) => ctx.gl(f.ax + f.dx * s, f.az + f.dz * s) : undefined);
    }
    bld.ledge(buf, ring, gH - 0.3, 0.3, 0.12, ctx.trim, ctx.trimTint);
    return;
  }
  if (use === 'arcade' && !smooth && ring.length <= 12) {
    // an arcade: the wall sits back behind a row of columns, a soffit over the walk
    const inner = shrinkRing(ring, clamp(3.2 / Math.max(4, minWidth(ring) * 0.5), 0.05, 0.35));
    if (inner !== ring && inner.length === ring.length) {
      emitWalls(ctx, inner, 0, inner, gH, { info: lobby.info, tint: lobby.tint, bay: lobby.bay, v0: 0, v1: 1, street: true });
      emitBand(ctx, ring, gH - 0.6, inner, gH - 0.6, ctx.trim, ctx.trimTint.map((v) => Math.round(v * 0.8)), false);
      const colW = clamp(gH * 0.11, 0.6, 1.3), sp = clamp(D.bay || 4, 3.4, 7);
      for (let i = 0; i < ring.length; i++) {
        const f = edgeFrame(ring[i], ring[(i + 1) % ring.length]), nc = Math.max(1, Math.round(f.L / sp));
        for (let k = 0; k < nc; k++) { const s = (f.L * k) / nc; bld.box(buf, f.ax + f.dx * s - f.ox * colW * 0.5 + f.dx * colW * 0.5, f.az + f.dz * s - f.oz * colW * 0.5 + f.dz * colW * 0.5, 0, colW, colW, gH - 0.6, Math.atan2(f.dz, f.dx), ctx.plainWall, ctx.plainTint); }
      }
      // the beam the upper floors stand on
      emitWalls(ctx, ring, gH - 0.6, ring, gH, { info: ctx.plainWall, tint: ctx.plainTint, metres: true });
      return;
    }
  }
  emitWalls(ctx, ring, 0, ring, gH, { info: lobby.info, tint: lobby.tint, bay: lobby.bay, v0: 0, v1: 1, smooth, street: true });
  bld.ledge(buf, ring, gH - 0.35, 0.35, 0.1, ctx.trim, ctx.trimTint);
  if (use === 'lobby' && F0.L > 7) entrance(ctx, F0, gH);
}

/** An entrance on a wall frame: a canopy with a lit soffit over a framed door bay. */
function entrance(ctx, f, gH) {
  const { bld, buf, seed } = ctx;
  const w = clamp(f.L * 0.28, 4, 11), s0 = f.L / 2 - w / 2, s1 = s0 + w, yc = clamp(gH - 0.9, 3, 4.6), out = 2.6, th = 0.32;
  // on a slope the door stands on the street where it meets the wall (none where the street has climbed past the lobby)
  const g0 = ctx.gl ? Math.max(0, ctx.gl(f.mx, f.mz)) : 0;
  if (g0 > gH - yc + 0.5) return;
  const P = (s, e, y) => [f.ax + f.dx * s + f.ox * e, y + g0, f.az + f.dz * s + f.oz * e];
  const n = [f.ox, 0, f.oz], d = [f.dx, 0, f.dz];
  const metal = [packSurf({ metal: 0.8, rough: 0.35 }), 0, 0, enc(PBR.PLAIN, MODE.SURF)], mt = tintFor([0.3, 0.3, 0.32]);
  const soffit = [packSurf({ metal: 0, rough: 0.6, glow: 3 }), rgb555([1, 0.86, 0.66]), 0, enc(PBR.PLAIN, MODE.SURF)];
  buf.q([P(s0, 0, yc + th), P(s1, 0, yc + th), P(s1, out, yc + th), P(s0, out, yc + th)], [0, 1, 0], metal, mt);
  buf.q([P(s0, 0, yc), P(s1, 0, yc), P(s1, out, yc), P(s0, out, yc)], [0, -1, 0], soffit, tintFor([0.9, 0.88, 0.84]));
  buf.q([P(s0, out, yc), P(s1, out, yc), P(s1, out, yc + th), P(s0, out, yc + th)], n, metal, mt);
  buf.q([P(s0, 0, yc), P(s0, out, yc), P(s0, out, yc + th), P(s0, 0, yc + th)], d.map((v) => -v), metal, mt);
  buf.q([P(s1, 0, yc), P(s1, out, yc), P(s1, out, yc + th), P(s1, 0, yc + th)], d, metal, mt);
  // the door bay: two posts and dark glass doors proud of the lobby glazing
  for (const s of [s0 + 0.2, s1 - 0.5]) bld.box(buf, f.ax + f.dx * (s + 0.15) + f.ox * 0.2, f.az + f.dz * (s + 0.15) + f.oz * 0.2, g0, 0.3, 0.4, yc, Math.atan2(f.dz, f.dx), metal, mt);
  const door = [packGrid({ pier: 0.05, span: 0.05, emph: 1, kind: 1, lit: 0.9 }), rgb555([0.16, 0.18, 0.2]), packGridSeed(seed, 0.2, 2), enc(PBR.PLAIN, MODE.GRID)];
  const dw = Math.min(w - 1.6, 5.2), d0 = f.L / 2 - dw / 2, nd = Math.max(1, Math.round(dw / 1.8));
  buf.q([P(d0, 0.12, 0), P(d0 + dw, 0.12, 0), P(d0 + dw, 0.12, 2.6), P(d0, 0.12, 2.6)], n, door, [200, 200, 200], [[0, 0], [nd, 0], [nd, 1], [0, 1]]);
}

// ------------------------------------------------------------------ crowns
function crown(ctx, ringTop, H, o) {
  const { bld, buf, D, rnd, wall } = ctx, type = D.crown.type;
  const area = Math.abs(signedArea(ringTop)), mw = minWidth(ringTop), c = centroid(ringTop);
  const mat = D.crown.material || (type === 'pyramid-spire' || type === 'mansard' ? 'copper' : type === 'dome' ? 'copper' : type === 'open-lattice' ? 'steel' : 'stone');
  // crown height: the descriptor's, else what is left between the roof and the architectural height, else by type
  const dflt = { 'pyramid-spire': 0.55 * mw + 6, stepped: clamp(0.14 * H, 6, 30), cylinder: clamp(0.08 * H, 5, 16), dome: 0.6 * mw, mansard: clamp(0.07 * H, 4, 14), 'open-lattice': 0.6 * mw + 6, antenna: clamp(0.18 * H, 8, 60), flat: clamp(0.03 * H + 2.5, 3, 8) }[type];
  const ch = D.crown.height || (D.height != null && D.height > H + 1 ? D.height - H : dflt);
  const cc = D.crown.color ? { color: D.crown.color } : {};
  const S = surface(ctx, mat, cc), flatTop = type === 'flat' || type === 'antenna';
  // the roof edge: a parapet round a flat roof, a coping under every other crown; lit: a light band along the edge
  const parapet = flatTop && area > 60 && H > 7 ? clamp(0.6 + H * 0.004, 0.7, 1.6) : 0;
  if (parapet > 0) {
    emitWalls(ctx, ringTop, H, ringTop, H + parapet, { info: ctx.plainWall, tint: ctx.plainTint, metres: true, smooth: o.smooth });
    bld.parapet(buf, ringTop, H, parapet, ctx.plainWall, ctx.plainTint, ctx.trim, ctx.trimTint, true);
  } else if (H > 4) bld.ledge(buf, ringTop, H - 0.35, 0.5, 0.2, ctx.trim, ctx.trimTint);
  if (ctx.lit && H > 20) {
    const band = [packSurf({ rough: 0.5, glow: 4 }), rgb555(ctx.lit), 0, enc(PBR.PLAIN, MODE.SURF)];
    const out = offsetRing(ringTop, 0.08);
    emitWalls(ctx, out, H + parapet - 0.45, out, H + parapet + 0.05, { info: band, tint: tintFor([0.9, 0.9, 0.9]), metres: true, wallU: false, smooth: o.smooth });
  }
  if (flatTop) {
    bld.flatPolygon(buf, ringTop, ctx.holes || [], H, ctx.roof, ctx.roofTint, true);
    if (o.parking) { parkingRoof(ctx, ringTop, H); return; }
    if (ctx.holes && ctx.holes.length) return;
    // a louvred mechanical screen set back from the edge on anything tall, plant on the roof round it
    let scr = H > 28 && area > 250 ? shrinkRing(crownRing(ringTop), 0.3 + 0.1 * rnd()) : null;
    if (scr === ringTop) scr = null;
    if (scr) {
      const sh = type === 'flat' ? (D.crown.height || dflt) : dflt * 0.6, L = surface(ctx, 'steel', { pat: 2, rough: 0.5, metal: 0.6, color: [0.5, 0.51, 0.52], lit: null });
      emitWalls(ctx, scr, H, scr, H + sh, { info: L.info, tint: L.tint, metres: true, wallU: false, smooth: scr.length >= 16 });
      bld.flatPolygon(buf, scr, [], H + sh - 0.4, ctx.roof, tintFor([0.3, 0.3, 0.31]), true);
    }
    const nH = Math.min(6, Math.floor(area / 600) + (area > 200 ? 1 : 0)), bbx = boundsOf(ringTop), mi = [-1, -1, ctx.seed, enc(PBR.METAL, MODE.PLAIN)];
    const keepIn = shrinkRing(ringTop, 0.25), keepOut = scr ? offsetRing(scr, 2.5) : null, ang = Math.atan2(longAxis(ringTop)[1], longAxis(ringTop)[0]);
    for (let i = 0; i < nH; i++) {
      const sx = 1.6 + rnd() * 3, sz = 1.2 + rnd() * 2.2, sy = 1 + rnd() * 1.4, x = bbx[0] + rnd() * (bbx[2] - bbx[0]), z = bbx[1] + rnd() * (bbx[3] - bbx[1]);
      if (keepIn === ringTop || !pointInRing(x, z, keepIn) || (keepOut && pointInRing(x, z, keepOut))) continue;
      bld.box(buf, x, z, H, sx, sz, sy, ang, mi, tintFor([0.78, 0.79, 0.8]), [-1, -1, ctx.seed, enc(PBR.PLAIN, MODE.PLAIN)], tintFor([0.34, 0.35, 0.36]));
    }
    if (type === 'antenna') {
      const st = surface(ctx, 'steel', { lit: null });
      emitMast(ctx, c[0], c[1], H, H + ch, clamp(ch * 0.05, 0.6, 2.4), st.info, st.tint);
      if (ch > 30) emitMast(ctx, c[0] + mw * 0.16, c[1] + mw * 0.1, H, H + ch * 0.62, clamp(ch * 0.03, 0.5, 1.4), st.info, st.tint);
    }
    return;
  }
  const base = crownRing(ringTop), cb = centroid(base);
  if (type === 'pyramid-spire' || type === 'open-lattice') {
    const lattice = type === 'open-lattice', hp = ch * (lattice ? 0.72 : 0.62);
    const P = lattice ? surface(ctx, mat, { ...cc, pat: 1, glow: 2.2 }) : S;
    if (lattice) {
      // the frame is open: a dark core inside it, the roof under it
      bld.flatPolygon(buf, ringTop, [], H, ctx.roof, ctx.roofTint, true);
      const core = scaleRing(base, cb, 0.5), K = surface(ctx, 'concrete', { color: [0.3, 0.3, 0.31], lit: null });
      emitWalls(ctx, core, H, core, H + hp * 0.3, { info: K.info, tint: K.tint, metres: true, wallU: false });
      emitCone(ctx, core, H + hp * 0.3, [cb[0], H + hp * 0.55, cb[1]], K.info, K.tint);
    }
    emitCone(ctx, base, H, [cb[0], H + hp, cb[1]], P.info, P.tint, lattice);
    // the spire: a needle through the apex
    const nd = mat === 'stone' || mat === 'concrete' ? surface(ctx, 'steel', {}) : surface(ctx, mat, cc);
    const r0 = clamp(mw * 0.035, 0.5, 2.2), foot = circleRing(cb[0], cb[1], r0, 8);
    emitCone(ctx, foot, H + hp * 0.78, [cb[0], H + ch, cb[1]], nd.info, nd.tint);
    bld.box(buf, cb[0], cb[1], H + ch - 0.4, 0.45, 0.45, 0.4, 0, [2, -1, rnd(), enc(PBR.PLAIN, MODE.LED)], [255, 26, 13]);
    return;
  }
  if (type === 'stepped') {
    // three steps, each set back and shorter; the walls carry the facade, the last step is the crown's material
    let r = ringTop, y = H;
    const hs = [0.42, 0.33, 0.25];
    for (let k = 0; k < 3; k++) {
      const src = k === 0 ? base : r, nr = shrinkRing(src, 0.22), hk = ch * hs[k];
      if (nr === src || Math.abs(signedArea(nr)) < 20) break;
      bld.flatPolygon(buf, r, [], y, ctx.roof, ctx.roofTint, true);
      if (k < 2) emitWalls(ctx, nr, y, nr, y + hk, { info: o.up.info, tint: o.up.tint, bay: o.up.bay, v0: 0, v1: Math.max(1, Math.round(hk / o.fh)), smooth: nr.length >= 16 });
      else emitWalls(ctx, nr, y, nr, y + hk, { info: S.info, tint: S.tint, metres: true, wallU: false, smooth: nr.length >= 16 });
      bld.ledge(buf, nr, y + hk - 0.4, 0.5, 0.16, ctx.trim, ctx.trimTint);
      r = nr; y += hk;
    }
    bld.flatPolygon(buf, r, [], y, ctx.roof, ctx.roofTint, true);
    if (ctx.lit) { const st = surface(ctx, 'steel', {}); emitMast(ctx, cb[0], cb[1], y, y + ch * 0.35, 0.7, st.info, st.tint); }
    return;
  }
  if (type === 'mansard') {
    const inner = shrinkRing(base, 0.34), M = surface(ctx, mat, { ...cc, pat: 3 });
    bld.flatPolygon(buf, ringTop, [], H, ctx.roof, ctx.roofTint, true);
    if (inner !== base && inner.length === base.length) { emitWalls(ctx, base, H, inner, H + ch, { info: M.info, tint: M.tint, metres: true, wallU: false }); bld.flatPolygon(buf, inner, [], H + ch, ctx.roof, ctx.roofTint, true); }
    else emitCone(ctx, base, H, [cb[0], H + ch, cb[1]], M.info, M.tint);
    return;
  }
  // cylinder and dome stand on a round drum
  const roundTop = ringTop.length >= 8 && starShaped(ringTop, c);
  const r = Math.min(mw * 0.5 * (roundTop ? 0.92 : type === 'dome' ? 0.62 : 0.8), Math.sqrt(area / Math.PI)), n = clamp(4 * Math.round((2 * Math.PI * r) / 4 / 4), 16, 40);
  bld.flatPolygon(buf, ringTop, [], H, ctx.roof, ctx.roofTint, true);
  if (type === 'cylinder') {
    // a glazed drum (a restaurant, a lounge) under a flat cap, a mast on it
    const drum = circleRing(cb[0], cb[1], r, n), hd = ch * 0.72;
    const G = [packGrid({ pier: 0.05, span: 0.15, emph: 1, kind: 1, lit: 0.8 }), ctx.glass, packGridSeed(ctx.seed, D.glassReflect, 1), enc(PBR.PLAIN, MODE.GRID)];
    emitWalls(ctx, drum, H, drum, H + hd, { info: G, tint: wall.tint, bay: 2, v0: 0, v1: Math.max(1, Math.round(hd / 4)), smooth: true, wallU: false });
    const cap = scaleRing(drum, cb, 1.05);
    emitWalls(ctx, cap, H + hd, cap, H + hd + 0.6, { info: S.info, tint: S.tint, metres: true, wallU: false, smooth: true });
    emitBand(ctx, cap, H + hd, drum, H + hd, S.info, S.tint, false);
    bld.flatPolygon(buf, cap, [], H + hd + 0.6, ctx.roof, ctx.roofTint, true);
    const st = surface(ctx, 'steel', { lit: null });
    emitMast(ctx, cb[0], cb[1], H + hd + 0.6, H + ch, 0.6, st.info, st.tint);
    return;
  }
  // dome: a drum of piers (the taller, the higher the crown over its width), the dome, a lantern with its own small dome
  const rd = r * 0.94, hl = Math.min(ch * 0.2, rd * 0.9), hm = Math.min(ch * 0.6, rd * 1.25), hd = ch - hm - hl;
  const drum = circleRing(cb[0], cb[1], rd, n), W = surface(ctx, 'stone', { pat: 3 });
  emitWalls(ctx, drum, H, drum, H + hd, { info: W.info, tint: W.tint, metres: true, wallU: false, smooth: true });
  bld.ledge(buf, drum, H + hd - 0.3, 0.4, 0.25, ctx.trim, ctx.trimTint);
  emitDome(ctx, cb[0], cb[1], H + hd, rd, hm, n, 7, S.info, S.tint);
  const rl = Math.max(0.6, rd * 0.13), lan = circleRing(cb[0], cb[1], rl, 8);
  emitWalls(ctx, lan, H + hd + hm * 0.96, lan, H + hd + hm + hl * 0.55, { info: W.info, tint: W.tint, metres: true, wallU: false, smooth: true });
  emitDome(ctx, cb[0], cb[1], H + hd + hm + hl * 0.55, rl * 1.1, hl * 0.3, 8, 3, S.info, S.tint);
  emitCone(ctx, circleRing(cb[0], cb[1], rl * 0.18, 4), H + hd + hm + hl * 0.8, [cb[0], H + ch, cb[1]], S.info, S.tint);
}
const boundsOf = (r) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of r) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; };

// ------------------------------------------------------------------ signs
/**
 * A sign in real letters near the top of the ring's widest face and the face behind it (a round shaft: two opposite
 * sides): every run of lit pixels is one quad, lit at night in the sign's colour.
 */
function sign(ctx, ring, H, sg) {
  const { buf } = ctx, T = signRuns(sg.text);
  if (!T.runs.length) return;
  const n = ring.length, round = n >= 16;
  // arc length round the ring
  const cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(ring[(i + 1) % n][0] - ring[i][0], ring[(i + 1) % n][1] - ring[i][1]));
  const per = cum[n];
  // the widest face; of faces about as wide, one on a street
  const order = edgesByLength(ring), wide = (i) => cum[i + 1] - cum[i];
  const e0 = order.find((i) => { const f = edgeFrame(ring[i], ring[(i + 1) % n]); return wide(i) >= 0.9 * wide(order[0]) && ctx.bld.isStreet(f.mx + f.ox * 4.5, f.mz + f.oz * 4.5); }) ?? order[0], L0 = wide(e0);
  const room = round ? per * 0.3 : L0 * 0.86;
  let px = clamp((0.055 * H) / 7, 0.3, 1);
  if (T.w * px > room) px = room / T.w;
  if (px < 0.16) return;
  const info = [packSurf({ rough: 0.5, glow: 4 }), rgb555(sg.color), 0, enc(PBR.PLAIN, MODE.SURF)], tint = tintFor(sg.color);
  const plate = [packSurf({ metal: 0.5, rough: 0.5 }), 0, 0, enc(PBR.PLAIN, MODE.SURF)], plateTint = tintFor([0.07, 0.075, 0.085]);
  const yTop = H - Math.max(0.8, px * 2), e = 0.2;
  // the face behind: the longest edge that looks the other way (a slab's two long sides)
  const mids = [cum[e0] + L0 / 2];
  if (round) mids.push(mids[0] + per / 2);
  else {
    const f0 = edgeFrame(ring[e0], ring[(e0 + 1) % n]);
    const back = order.find((i) => { if (i === e0) return false; const f = edgeFrame(ring[i], ring[(i + 1) % n]); return f.ox * f0.ox + f.oz * f0.oz < -0.7 && f.L >= T.w * px / 0.9; });
    if (back !== undefined) mids.push(cum[back] + (cum[back + 1] - cum[back]) / 2);
  }
  for (const mid of mids) {
    // seen from outside the ring runs right to left, so the text starts at the high end
    const sR = mid + (T.w * px) / 2;
    // a dark band behind the letters (they read by day on a pale wall too), then the letters; both cut at the ring's
    // corners, so on a round shaft every piece lies flat on one face
    strip(sR + 2 * px, sR - (T.w + 2) * px, yTop - 8.5 * px, yTop + 1.5 * px, e - 0.08, plate, plateTint);
    for (const [c0, c1, row] of T.runs) strip(sR - c0 * px, sR - (c1 + 1) * px, yTop - (row + 1) * px, yTop - row * px, e, info, tint);
  }
  /** A band on the ring's faces from arc length s1 down to s0 (s1 > s0), between heights y0 and y1, e proud of the wall. */
  function strip(s1, s0, y0, y1, out, inf, tn) {
    let a = s0;
    while (a < s1 - 1e-4) {
      const m = ((a % per) + per) % per;
      let i = 0; while (i < n - 1 && cum[i + 1] <= m + 1e-6) i++;
      const b = Math.min(s1, a + Math.max(1e-3, cum[i + 1] - m));
      const p = ring[i], q = ring[(i + 1) % n], L = cum[i + 1] - cum[i] || 1e-6, dx = (q[0] - p[0]) / L, dz = (q[1] - p[1]) / L, nx = dz, nz = -dx;
      const ta = m - cum[i], tb = ta + (b - a), ox = p[0] + nx * out, oz = p[1] + nz * out;
      if (b - a > 0.004) buf.q([[ox + dx * tb, y0, oz + dz * tb], [ox + dx * ta, y0, oz + dz * ta], [ox + dx * ta, y1, oz + dz * ta], [ox + dx * tb, y1, oz + dz * tb]], [nx, 0, nz], inf, tn);
      a = b;
    }
  }
}

// ------------------------------------------------------------------ forms
/** The top deck of a car park: a stair and lift core above the deck, lamp posts. */
function parkingRoof(ctx, ring, H) {
  const { bld, buf, seed, rnd } = ctx, o = obb(ring), ang = Math.atan2(o.uz, o.ux);
  const i = Math.floor(seed * ring.length) % ring.length, p = ring[i], c = centroid(ring);
  const x = p[0] + (c[0] - p[0]) * 0.16, z = p[1] + (c[1] - p[1]) * 0.16;
  if (pointInRing(x, z, ring)) bld.box(buf, x, z, H, 5.5, 4, 3.6, ang, ctx.plainWall, ctx.plainTint, ctx.roof, ctx.roofTint);
  const post = [packSurf({ metal: 0.7, rough: 0.4 }), 0, 0, enc(PBR.PLAIN, MODE.SURF)], lamp = [packSurf({ rough: 0.5, glow: 4 }), rgb555([1, 0.93, 0.8]), 0, enc(PBR.PLAIN, MODE.SURF)];
  const nx = Math.max(1, Math.round(o.W / 28)), nz = Math.max(1, Math.round(o.Dp / 28));
  for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
    const u = ((a + 0.5) / nx - 0.5) * o.W, v = ((b + 0.5) / nz - 0.5) * o.Dp, px = o.cx + o.ux * u + o.vx * v, pz = o.cz + o.uz * u + o.vz * v;
    if (!pointInRing(px, pz, ring)) continue;
    bld.box(buf, px, pz, H, 0.18, 0.18, 6, ang, post, tintFor([0.4, 0.4, 0.42]));
    bld.box(buf, px, pz, H + 6, 1.3, 0.35, 0.16, ang, lamp, tintFor([0.95, 0.95, 0.9]));
  }
  void rnd;
}

/** Church: a nave under a ridge roof (convex outlines; else a flat roof), a square tower with a spire at one end. */
function church(ctx) {
  const { bld, buf, D, F, H, seed, wall } = ctx, ring = F.outer, c = F.c, o = obb(ring);
  const convex = isConvex(ring) && !F.holes.length, foundation = bld.foundation;
  const tw = clamp(0.36 * Math.min(o.W, o.Dp), 3.6, 9);                     // tower side
  const wallH = clamp(H * 0.5, 4.5, 18), roofH = convex ? clamp(0.36 * o.Dp, 2, Math.max(2.5, H * 0.3)) : 0;
  const slots = [packGrid({ pier: 0.6, span: 0.3, emph: 2, kind: 0, lit: 0.5 }), rgb555([0.3, 0.22, 0.34]), packGridSeed(seed, 0.2, 2), enc(wall.pbr, MODE.GRID)];
  if (foundation) emitWalls(ctx, ring, -foundation, ring, 0, { info: ctx.plainWall, tint: ctx.plainTint, metres: true });
  const slate = [-1, -1, seed, enc(PBR.ROOF_SLATE, MODE.PLAIN)], slateT = tintFor([0.62, 0.62, 0.66]);
  if (roofH > 0) {
    // tall slot windows up to the eaves, gable walls up to the ridge, the roof in two slopes with an overhang
    const nx = -o.uz, nz = o.ux;
    let dmax = 0;
    for (const p of ring) dmax = Math.max(dmax, Math.abs((p[0] - c[0]) * nx + (p[1] - c[1]) * nz));
    const r2 = insertRidgePoints(ring, c, nx, nz), topH = (x, z) => wallH + roofH * (1 - Math.abs((x - c[0]) * nx + (z - c[1]) * nz) / dmax);
    emitWalls(ctx, ring, 0, ring, wallH, { info: slots, tint: wall.tint, bay: D.bay || 4.2, v0: 0, v1: 1, street: true });
    for (let i = 0; i < r2.length; i++) {
      const a = r2[i], b = r2[(i + 1) % r2.length], ha = topH(a[0], a[1]), hb = topH(b[0], b[1]);
      if (Math.max(ha, hb) < wallH + 0.05) continue;
      const f = edgeFrame(a, b);
      buf.wall = { u0: 0, sg: 1, k: 1, ax: f.ax, az: f.az, dx: f.dx, dz: f.dz, gy: bld.groundAt, ao: -1e4 };
      buf.q([[a[0], wallH, a[1]], [b[0], wallH, b[1]], [b[0], hb, b[1]], [a[0], ha, a[1]]], [f.ox, 0, f.oz], ctx.plainWall, ctx.plainTint);
      buf.wall = null;
    }
    const ringO = offsetRing(r2, 0.4);
    for (const pc of splitByRidge(ringO, c, [o.ux, o.uz])) bld.heightPolygon(buf, pc, topH, slate, slateT);
    bld.eaves(buf, r2, ringO, (p) => topH(p[0], p[1]), seed, null);
  } else {
    emitWalls(ctx, ring, 0, ring, wallH, { info: slots, tint: wall.tint, bay: D.bay || 4.2, v0: 0, v1: 1, street: true });
    bld.flatPolygon(buf, ring, F.holes, wallH, ctx.roof, ctx.roofTint, true);
    bld.ledge(buf, ring, wallH - 0.35, 0.5, 0.2, ctx.trim, ctx.trimTint);
  }
  // the tower at one end of the long axis, inside the outline
  const end = seed < 0.5 ? -1 : 1, tu = end * (o.W / 2 - tw / 2 - 0.3), tx = o.cx + o.ux * tu, tz = o.cz + o.uz * tu;
  const tower = rectRing({ ...o, cx: tx, cz: tz }, tw, tw), tH = Math.max(wallH + roofH + tw * 0.6, H * 0.74), tc = [tx, tz];
  emitWalls(ctx, tower, wallH * 0.5, tower, tH - tw * 0.9, { info: ctx.plainWall, tint: ctx.plainTint, metres: true });
  // the belfry: one tall opening a face
  emitWalls(ctx, tower, tH - tw * 0.9, tower, tH, { info: [packGrid({ pier: 0.55, span: 0.25, emph: 2, kind: 3 }), 0, packGridSeed(seed, 0, 1), enc(wall.pbr, MODE.GRID)], tint: wall.tint, bay: tw, v0: 0, v1: 1 });
  bld.ledge(buf, tower, tH - 0.3, 0.45, 0.22, ctx.trim, ctx.trimTint);
  const S = surface(ctx, D.crown.material || 'copper', {}), sh = D.crown.height || Math.max(tw * 1.6, H * 1.08 - tH);
  emitCone(ctx, scaleRing(tower, tc, 1.04), tH, [tx, tH + sh, tz], S.info, S.tint);
}

/** Stadium: an outer wall leaning out, a roof band over the upper stand, raked seats down to the field. */
function stadium(ctx) {
  const { bld, buf, F, H, c, seed, wall, rnd } = ctx, ring = F.outer;
  if (!starShaped(ring, c) || F.holes.length) return tiers(ctx);
  if (bld.foundation) emitWalls(ctx, ring, -bld.foundation, ring, 0, { info: ctx.plainWall, tint: ctx.plainTint, metres: true });
  const up = facade(ctx), lean = scaleRing(ring, c, 1.035), fh = H / Math.max(2, Math.round(H / 7));
  emitWalls(ctx, ring, 0, lean, H * 0.82, { info: up.info, tint: up.tint, bay: up.bay, v0: 0, v1: (H * 0.82) / fh });
  const ribs = surface(ctx, 'concrete', { pat: 3, color: wall.color, lit: null });
  emitWalls(ctx, lean, H * 0.82, scaleRing(ring, c, 1.05), H, { info: ribs.info, tint: ribs.tint, metres: true, wallU: false });
  // the roof over the upper stand, white, lit from below at night; its underside
  const roofI = [packSurf({ metal: 0.2, rough: 0.5 }), 0, 0, enc(PBR.PLAIN, MODE.SURF)], white = tintFor([0.86, 0.87, 0.88]);
  const rOut = scaleRing(ring, c, 1.05), rIn = scaleRing(ring, c, 0.8);
  emitBand(ctx, rOut, H, rIn, H + H * 0.08, roofI, white, true);
  emitBand(ctx, rOut, H - 0.4, rIn, H + H * 0.08 - 0.4, [packSurf({ rough: 0.7, glow: 2.2 }), rgb555([1, 0.96, 0.88]), 0, enc(PBR.PLAIN, MODE.SURF)], tintFor([0.7, 0.7, 0.7]), false);
  // seats: rows as louvres, in the home colours; the field
  const seatC = [[0.55, 0.12, 0.12], [0.12, 0.2, 0.45], [0.16, 0.36, 0.2], [0.32, 0.33, 0.36]][Math.floor(seed * 4)];
  const seats = [packSurf({ rough: 0.8, pat: 2 }), 0, 0, enc(PBR.PLAIN, MODE.SURF)];
  emitBand(ctx, scaleRing(ring, c, 0.94), H * 0.72, scaleRing(ring, c, 0.5), 2.5, seats, tintFor(seatC), true);
  emitWalls(ctx, scaleRing(ring, c, 0.94), H * 0.72, scaleRing(ring, c, 0.94), H * 0.82, { info: ctx.plainWall, tint: ctx.plainTint, metres: true, both: true, wallU: false });
  bld.flatPolygon(buf, scaleRing(ring, c, 0.5), [], 2.5, [-1, -1, seed, enc(PBR.GRASS, MODE.PLAIN)], [240, 255, 235], true);
  void rnd;
}

/** Arena: walls of glass and a shallow dome over the whole outline. */
function arena(ctx) {
  const { bld, buf, D, F, H, c } = ctx, ring = F.outer;
  if (!starShaped(ring, c) || F.holes.length) return tiers(ctx);
  const wallH = H * 0.62, up = facade(ctx), lobby = facade(ctx, true), gH = Math.min(6, wallH * 0.45);
  if (bld.foundation) emitWalls(ctx, ring, -bld.foundation, ring, 0, { info: ctx.plainWall, tint: ctx.plainTint, metres: true });
  emitWalls(ctx, ring, 0, ring, gH, { info: lobby.info, tint: lobby.tint, bay: lobby.bay, v0: 0, v1: 1, smooth: ring.length >= 16, street: true });
  emitWalls(ctx, ring, gH, ring, wallH, { info: up.info, tint: up.tint, bay: up.bay, v0: 0, v1: Math.max(1, Math.round((wallH - gH) / (D.floorHeight || 5))), smooth: ring.length >= 16 });
  const out = offsetRing(ring, 0.9), S = surface(ctx, D.crown.material || 'steel', { pat: 3 });
  emitBand(ctx, out, wallH, ring, wallH, ctx.trim, ctx.trimTint, false);
  emitWalls(ctx, out, wallH, out, wallH + 0.8, { info: ctx.trim, tint: ctx.trimTint, metres: true, wallU: false });
  const prof = [[1, 0], [0.9, 0.42], [0.7, 0.72], [0.4, 0.92], [0, 1]], rh = H - wallH - 0.8, co = centroid(out);
  for (let k = 0; k + 1 < prof.length; k++) {
    const ra = scaleRing(out, co, prof[k][0]), ya = wallH + 0.8 + rh * prof[k][1], yb = wallH + 0.8 + rh * prof[k + 1][1];
    if (prof[k + 1][0] === 0) emitCone(ctx, ra, ya, [co[0], yb, co[1]], S.info, S.tint);
    else emitBand(ctx, ra, ya, scaleRing(out, co, prof[k + 1][0]), yb, S.info, S.tint, true);
  }
  if (D.night.sign) sign(ctx, ring, wallH, D.night.sign);
}

/** Warehouse: blank walls in metal sheet / brick / concrete, a clerestory band, dock doors on the widest street face. */
function warehouse(ctx) {
  const { bld, buf, D, F, H, seed, wall, rnd } = ctx, ring = F.outer;
  if (bld.foundation) emitWalls(ctx, ring, -bld.foundation, ring, 0, { info: ctx.plainWall, tint: ctx.plainTint, metres: true });
  const sheet = wall.kind === 2 ? [-1, -1, seed, enc(PBR.METAL, MODE.WALLONLY)] : ctx.plainWall;
  const y1 = H * 0.62, y2 = Math.min(H - 0.8, H * 0.86);
  emitWalls(ctx, ring, 0, ring, y1, { info: sheet, tint: wall.tint, metres: true, street: true });
  const band = [packGrid({ pier: 0.1, span: 0.1, emph: 0, kind: wall.kind === 2 ? 2 : 0, lit: 0.3 }), ctx.glass, packGridSeed(seed, 0.2, 3), enc(wall.kind === 2 ? PBR.PLAIN : wall.pbr, MODE.GRID)];
  emitWalls(ctx, ring, y1, ring, y2, { info: (i, L) => (L > 8 ? band : sheet), tint: wall.tint, bay: D.bay || 6, v0: 0, v1: 1 });
  emitWalls(ctx, ring, y2, ring, H, { info: sheet, tint: wall.tint, metres: true });
  for (const hr of F.holes) emitWalls(ctx, hr, 0, hr, H, { info: sheet, tint: wall.tint, metres: true });
  bld.flatPolygon(buf, ring, F.holes, H - 0.15, ctx.roof, ctx.roofTint, true);
  bld.ledge(buf, ring, H - 0.3, 0.3, 0.12, ctx.trim, ctx.trimTint);
  // dock doors: dark roller doors with a canopy on the widest street face
  const order = edgesByLength(ring);
  let front = order[0];
  for (const i of order.slice(0, 3)) { const f = edgeFrame(ring[i], ring[(i + 1) % ring.length]); if (bld.isStreet(f.mx + f.ox * 4.5, f.mz + f.oz * 4.5)) { front = i; break; } }
  const f = edgeFrame(ring[front], ring[(front + 1) % ring.length]), nd = Math.min(8, Math.floor(f.L / 7)), dh = Math.min(4.2, y1 - 0.6);
  const door = surface(ctx, 'steel', { pat: 2, color: [0.2, 0.21, 0.22], rough: 0.6, metal: 0.4, lit: null });
  const P = (s, e, y) => [f.ax + f.dx * s + f.ox * e, y, f.az + f.dz * s + f.oz * e];
  for (let k = 0; k < nd; k++) {
    const s0 = (f.L * (k + 0.5)) / nd - 1.7, s1 = s0 + 3.4;
    buf.q([P(s0, 0.05, 0.1), P(s1, 0.05, 0.1), P(s1, 0.05, dh), P(s0, 0.05, dh)], [f.ox, 0, f.oz], door.info, door.tint, [[0, 0.1], [3.4, 0.1], [3.4, dh], [0, dh]]);
  }
  void rnd;
}

/** Build a described building into `buf` (see the header). */
export function buildDescribed(bld, buf, b, D, F, rnd) {
  const ctx = context(bld, buf, b, D, F, rnd);
  if (D.form === 'church') return church(ctx);
  if (D.form === 'stadium') return stadium(ctx);
  if (D.form === 'arena') return arena(ctx);
  if (D.form === 'warehouse') return warehouse(ctx);
  return tiers(ctx);
}
