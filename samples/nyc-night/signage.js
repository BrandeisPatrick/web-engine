// Signage for the night walk: every sign is ORIGINAL (invented names, drawn in code; no real brand, logo or
// trademark). One 2048 x 2048 canvas atlas holds
//   rows 0-2   12 LED-screen ads (512 x 256), cycled 4 to a row by the shader (three playlists);
//   row 3      4 theatre marquees (changeable letters under a bulb border);
//   rows 4-5   16 shop fascias (512 x 128: diner, deli, pizza, noodles, pharmacy, ...);
//   rows 6-7   16 vertical blade signs (128 x 512: HOTEL, BAR, PARKING, ...).
// One InstancedMesh draws every sign (plane per instance; per-instance atlas rect, playlist, phase, brightness),
// a second mesh the scrolling news ticker. The material is a MeshStandardMaterial (dark, glossy face: lamps glint on
// it) whose emissive comes from the atlas (LED dot grid up close, a slow sheen, flicker for neon), so it goes through
// the G-buffer / TAA / bloom like everything else.
// Placement (`buildSignage`): building edges that face a street (MapWorld raster: road or sidewalk 3.5 m out), giant
// screens stacked up the facades within `squareRadius` of the square centre, a ticker band on a few of them,
// theatre marquees on buildings OSM names as theatres, shop fascias and blades on street fronts within `shopRadius`.
// Shop bays and entrance canopies are only PLACED here (`shops`, `canopies`, same random draws as before): their
// geometry (stall risers, glazing, doorways, fascias, shutters, canopies, lobby doors) is groundfloors.js.
// Light: every sign is also a light source (`lights`: position 2-6 m in front of its face, colour = the mean colour
// of the frame it shows, range by size) that the sample pushes into the ClusteredLights list after the lamps.
import * as THREE from 'three';
import { RBIT } from '@vibe/engine/world';

const AW = 2048, AH = 2048;

// ------------------------------------------------------------------ drawing helpers
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const COND = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
function fit(g, text, maxW, size, weight = '800', family = SANS) {
  let s = size;
  do { g.font = `${weight} ${s}px ${family}`; if (g.measureText(text).width <= maxW) break; s -= 2; } while (s > 8);
  return s;
}
function txt(g, text, x, y, maxW, size, color, { weight = '800', family = SANS, align = 'center', glow = 0, glowColor = null } = {}) {
  fit(g, text, maxW, size, weight, family);
  g.textAlign = align; g.textBaseline = 'middle';
  if (glow) { g.shadowColor = glowColor || color; g.shadowBlur = glow; }
  g.fillStyle = color; g.fillText(text, x, y);
  g.shadowBlur = 0;
}
function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
function rad(g, x, y, r, stops) { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }

// ------------------------------------------------------------------ LED ads (512 x 256 each)
// [draw(g, w, h)] in a local frame; 12 of them, three playlists of four
const ADS = [
  // mostly dark imagery with a few bright elements (as real night ads are); the warm family (red, amber, warm white)
  // with one cool accent (Zephyr), so the square never reads as a wall of white or violet light
  (g, w, h) => { // NOVA COLA
    g.fillStyle = lin(g, 0, 0, w, h, [[0, '#3a0006'], [1, '#0c0002']]); g.fillRect(0, 0, w, h);
    g.fillStyle = rad(g, w * 0.8, h * 0.5, 120, [[0, 'rgba(255,60,40,0.45)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, w, h);
    txt(g, 'NOVA', w * 0.36, h * 0.38, w * 0.62, 120, '#ffe8d8', { family: SERIF, weight: 'italic 700' });
    txt(g, 'COLA', w * 0.36, h * 0.72, w * 0.5, 64, '#e8303a', { weight: '900' });
    g.fillStyle = '#d82a30'; g.beginPath(); g.ellipse(w * 0.82, h * 0.5, 30, 80, 0, 0, 7); g.fill();
    g.fillStyle = '#ffd9c8'; g.fillRect(w * 0.82 - 30, h * 0.46, 60, 16);
  },
  (g, w, h) => { // ZEPHYR phone (the one cool accent)
    g.fillStyle = '#04060c'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.roundRect(w * 0.68, h * 0.1, 110, 210, 18); g.fill();
    g.fillStyle = lin(g, w * 0.68, h * 0.1, w * 0.9, h * 0.9, [[0, '#2a4a8a'], [1, '#0a1430']]); g.beginPath(); g.roundRect(w * 0.68 + 7, h * 0.1 + 7, 96, 196, 14); g.fill();
    txt(g, 'ZEPHYR 12', w * 0.34, h * 0.4, w * 0.6, 76, '#e8eef8', { weight: '300' });
    txt(g, 'brighter than the city', w * 0.34, h * 0.68, w * 0.6, 28, '#8fa6c8', { weight: '400' });
  },
  (g, w, h) => { // LUMEN musical
    g.fillStyle = '#050302'; g.fillRect(0, 0, w, h);
    g.fillStyle = rad(g, w * 0.5, h * 0.55, w * 0.45, [[0, 'rgba(255,170,60,0.55)'], [0.4, 'rgba(120,40,10,0.25)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, w, h);
    txt(g, 'LUMEN', w * 0.5, h * 0.42, w * 0.85, 130, '#ffe6b8', { family: SERIF, weight: '700', glow: 18, glowColor: '#ff9a30' });
    txt(g, 'THE MUSICAL  ·  NOW ON BROADWAY', w * 0.5, h * 0.78, w * 0.85, 26, '#d8a050', { weight: '600' });
  },
  (g, w, h) => { // KITE airlines
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#2a0c04'], [0.6, '#5a1a08'], [1, '#120402']]); g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffb060'; g.beginPath(); g.moveTo(w * 0.78, h * 0.22); g.lineTo(w * 0.9, h * 0.5); g.lineTo(w * 0.78, h * 0.78); g.lineTo(w * 0.66, h * 0.5); g.closePath(); g.fill();
    txt(g, 'KITE AIR', w * 0.34, h * 0.4, w * 0.6, 80, '#fff0e0', { weight: '900' });
    txt(g, 'fly everywhere tonight', w * 0.34, h * 0.68, w * 0.6, 28, '#e09060', { weight: '400' });
  },
  (g, w, h) => { // ORBIT sneakers
    g.fillStyle = '#080706'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffa020'; g.lineWidth = 12; g.beginPath(); g.ellipse(w * 0.83, h * 0.5, 60, 36, -0.3, 0, 7); g.stroke();
    txt(g, 'ORBIT', w * 0.36, h * 0.42, w * 0.6, 120, '#ffb030', { weight: '900', family: COND });
    txt(g, 'RUN THE NIGHT', w * 0.33, h * 0.75, w * 0.55, 32, '#e8e0d0', { weight: '700' });
  },
  (g, w, h) => { // HALCYON watches
    g.fillStyle = lin(g, 0, 0, w, 0, [[0, '#14100a'], [1, '#050403']]); g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8b46a'; g.lineWidth = 6; g.beginPath(); g.arc(w * 0.8, h * 0.5, 80, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(w * 0.8, h * 0.5); g.lineTo(w * 0.8, h * 0.5 - 60); g.moveTo(w * 0.8, h * 0.5); g.lineTo(w * 0.8 + 42, h * 0.5 + 10); g.stroke();
    txt(g, 'HALCYON', w * 0.36, h * 0.44, w * 0.62, 70, '#f0dcae', { family: SERIF, weight: '400' });
    txt(g, 'GENÈVE · SINCE 1921', w * 0.36, h * 0.7, w * 0.6, 22, '#b89450', { weight: '500' });
  },
  (g, w, h) => { // MANGO+ streaming
    g.fillStyle = '#0a0602'; g.fillRect(0, 0, w, h);
    g.fillStyle = rad(g, w * 0.5, h * 0.3, 260, [[0, 'rgba(255,150,30,0.35)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, w, h);
    txt(g, 'mango+', w * 0.5, h * 0.38, w * 0.8, 110, '#ffa832', { weight: '900' });
    txt(g, 'NEW SEASON STREAMING FRIDAY', w * 0.5, h * 0.8, w * 0.86, 26, '#d8c8b0', { weight: '700' });
  },
  (g, w, h) => { // AURORA energy (amber, not green)
    g.fillStyle = '#060402'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) { g.fillStyle = `hsla(${18 + i * 7},90%,45%,0.22)`; g.beginPath(); g.ellipse(w * (0.2 + i * 0.16), h * 0.5, 50, 140, 0.4, 0, 7); g.fill(); }
    txt(g, 'AURORA', w * 0.5, h * 0.42, w * 0.8, 110, '#ffe2c0', { weight: '900', glow: 14, glowColor: '#ff7a20' });
    txt(g, 'ENERGY · ZERO SUGAR', w * 0.5, h * 0.76, w * 0.7, 26, '#e09048', { weight: '700' });
  },
  (g, w, h) => { // TACO PLANET
    g.fillStyle = '#100604'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8a020'; g.beginPath(); g.arc(w * 0.18, h * 0.55, 70, Math.PI, 0); g.fill();
    g.strokeStyle = '#c83018'; g.lineWidth = 7; g.beginPath(); g.ellipse(w * 0.18, h * 0.55, 100, 24, -0.2, 0, 7); g.stroke();
    txt(g, 'TACO PLANET', w * 0.66, h * 0.42, w * 0.6, 66, '#ffc040', { weight: '900' });
    txt(g, 'OPEN LATE · 2 FOR $5', w * 0.66, h * 0.72, w * 0.6, 28, '#e8d8c0', { weight: '700' });
  },
  (g, w, h) => { // PIXELWAVE TV
    g.fillStyle = '#040302'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { const y = h * 0.5 + Math.sin(x * 0.03) * 50; g.fillStyle = `hsl(${10 + (x / w) * 35},90%,${45 + 10 * Math.sin(x * 0.05)}%)`; g.fillRect(x, y - 6, 12, 12); }
    txt(g, 'PIXELWAVE', w * 0.5, h * 0.2, w * 0.8, 50, '#f0e6d8', { weight: '900' });
    txt(g, 'channel 88 · live tonight', w * 0.5, h * 0.86, w * 0.8, 24, '#c8a070', { weight: '500' });
  },
  (g, w, h) => { // QUILL BANK
    g.fillStyle = '#060504'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8b878'; g.beginPath(); g.moveTo(w * 0.12, h * 0.75); g.quadraticCurveTo(w * 0.2, h * 0.1, w * 0.3, h * 0.2); g.quadraticCurveTo(w * 0.2, h * 0.4, w * 0.12, h * 0.75); g.fill();
    txt(g, 'QUILL', w * 0.62, h * 0.4, w * 0.6, 90, '#f2e6cc', { family: SERIF, weight: '700' });
    txt(g, 'BANK  ·  write your next chapter', w * 0.62, h * 0.72, w * 0.66, 22, '#b8a078', { weight: '500' });
  },
  (g, w, h) => { // SKYLINE NEWS
    g.fillStyle = '#0a0404'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a01810'; g.fillRect(0, 0, w, h * 0.12);
    txt(g, 'SKYLINE NEWS', w * 0.5, h * 0.4, w * 0.86, 62, '#f2e8e0', { weight: '900' });
    txt(g, 'RAIN CLEARS · 52°F · WIND NW 8', w * 0.5, h * 0.76, w * 0.86, 28, '#e05030', { weight: '800' });
  },
];

const MARQUEES = [
  ['THE MERIDIAN', 'GLASS HARBOR', 'A NEW PLAY · TONIGHT 8PM'],
  ['THE BELVEDERE', 'SIX CROWS', 'THE HIT MUSICAL · SOLD OUT'],
  ['THE ALDEN', "THE CLOCKMAKER'S DAUGHTER", 'PREVIEWS BEGIN DEC 3'],
  ['THE HOLLIS', 'ROOFTOP ROMEO', '"DAZZLING" — THE DAILY LEDGER'],
];

// [text, sub, neon colour, background]
const FASCIAS = [
  ['MOONLIGHT DINER', 'OPEN 24 HOURS', '#ff4a30', '#100302'], ['LUCKY 7 DELI', 'SANDWICHES · COFFEE', '#ffc040', '#0c0802'],
  ["NICO'S PIZZA", 'BY THE SLICE', '#ff7a20', '#100500'], ['NOODLE BAR', 'RAMEN · DUMPLINGS', '#ff3a28', '#100202'],
  ['PHARMACY 24', 'PRESCRIPTIONS', '#f2efe6', '#060606'], ['NEWS & LOTTO', 'MAGAZINES · SNACKS', '#ffd890', '#0a0802'],
  ['GRAMERCY GRILL', 'STEAKS · CHOPS', '#ffb060', '#0e0702'], ['KARAOKE', 'PRIVATE ROOMS', '#ff5040', '#0e0303'],
  ['CAFÉ AUGUSTE', 'ESPRESSO · PASTRY', '#ffe0b0', '#080604'], ['SUSHI KOBO', 'OMAKASE', '#ff6048', '#0e0303'],
  ['GOLDEN WOK', 'CHINESE KITCHEN', '#ffc030', '#100302'], ['THE TIPSY OWL', 'COCKTAILS', '#7ac8ff', '#02060a'],
  ['FIFTH LANE BOWL', 'LANES · BAR', '#ff9048', '#0a0402'], ['BAGEL BROS', 'FRESH DAILY', '#ffa040', '#100602'],
  ['SOUVENIRS', 'I ♥ THE CITY', '#ff4030', '#0e0202'], ['ELECTRONICS', 'CAMERAS · PHONES', '#f0ece4', '#060606'],
];
// [text, neon colour]
const BLADES = [
  ['HOTEL', '#ff4030'], ['BAR', '#ffb050'], ['PARKING', '#ffd040'], ['CAFE', '#ff9a3c'], ['DELI', '#ffe0a0'], ['PIZZA', '#ff5a2a'],
  ['LIQUORS', '#ff6040'], ['OPEN', '#ff2f2f'], ['DINER', '#78c8ff'], ['HOTEL', '#ffe9b0'], ['TICKETS', '#ffb000'], ['KARAOKE', '#ff7050'],
  ['SUSHI', '#ff6b5a'], ['JAZZ', '#ffc070'], ['GRILL', '#ffa040'], ['24 HR', '#fff0d0'],
];

function drawMarquee(g, w, h, [house, show, line]) {
  g.fillStyle = '#1a0606'; g.fillRect(0, 0, w, h);
  // bulb border
  for (let x = 10; x < w; x += 18) for (const y of [8, h - 8]) { g.fillStyle = rad(g, x, y, 8, [[0, '#fff6c8'], [0.5, '#ffc040'], [1, 'rgba(80,30,0,0)']]); g.fillRect(x - 8, y - 8, 16, 16); }
  for (let y = 26; y < h - 16; y += 18) for (const x of [8, w - 8]) { g.fillStyle = rad(g, x, y, 8, [[0, '#fff6c8'], [0.5, '#ffc040'], [1, 'rgba(80,30,0,0)']]); g.fillRect(x - 8, y - 8, 16, 16); }
  txt(g, house, w / 2, 44, w - 60, 34, '#ff3a2a', { weight: '900', glow: 14, glowColor: '#ff2010' });
  g.fillStyle = '#f2ead6'; g.fillRect(24, 70, w - 48, h - 96);
  g.fillStyle = '#e0d6bc'; for (let y = 70; y < h - 26; y += 54) g.fillRect(24, y, w - 48, 2);
  txt(g, show, w / 2, 112, w - 70, 50, '#111', { weight: '900', family: COND });
  txt(g, line, w / 2, 182, w - 70, 30, '#7a0000', { weight: '800', family: COND });
}
function drawFascia(g, w, h, [name, sub, neon, bg]) {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = neon; g.globalAlpha = 0.55; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12); g.globalAlpha = 1;
  txt(g, name, w / 2, h * 0.42, w - 36, 64, '#fff', { weight: '800', glow: 16, glowColor: neon });
  txt(g, name, w / 2, h * 0.42, w - 36, 64, neon, { weight: '800' });
  g.globalAlpha = 0.85; txt(g, sub, w / 2, h * 0.8, w - 60, 20, '#e8e8e8', { weight: '600' }); g.globalAlpha = 1;
}
function drawBlade(g, w, h, [word, neon]) {
  g.fillStyle = '#0b0a0c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = neon; g.lineWidth = 4; g.globalAlpha = 0.6; g.strokeRect(5, 5, w - 10, h - 10); g.globalAlpha = 1;
  const n = word.length, step = (h - 30) / n, size = Math.min(w * 0.72, step * 0.92);
  for (let i = 0; i < n; i++) {
    const y = 15 + step * (i + 0.5);
    txt(g, word[i], w / 2, y, w - 16, size, '#fff', { weight: '900', glow: 14, glowColor: neon });
    txt(g, word[i], w / 2, y, w - 16, size, neon, { weight: '900' });
  }
}

/** Draws the atlas; returns { canvas, rects: { ads[12], marquees[4], fascias[16], blades[16] }, colours (same keys) } */
export function buildSignAtlas() {
  const c = document.createElement('canvas'); c.width = AW; c.height = AH;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, AW, AH);
  const rects = { ads: [], marquees: [], fascias: [], blades: [] };
  const cell = (key, x, y, w, h, draw) => {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); draw(g, w, h); g.restore();
    rects[key].push({ x, y, w, h });
  };
  ADS.forEach((d, i) => cell('ads', (i % 4) * 512, Math.floor(i / 4) * 256, 512, 256, d));
  MARQUEES.forEach((m, i) => cell('marquees', i * 512, 768, 512, 256, (gg, w, h) => drawMarquee(gg, w, h, m)));
  FASCIAS.forEach((f, i) => cell('fascias', (i % 4) * 512, 1024 + Math.floor(i / 4) * 128, 512, 128, (gg, w, h) => drawFascia(gg, w, h, f)));
  BLADES.forEach((b, i) => cell('blades', i * 128, 1536, 128, 512, (gg, w, h) => drawBlade(gg, w, h, b)));
  // mean colour of every rect (light colour of a sign showing it), from a 1/16 downsample
  const sw = AW / 16, sh = AH / 16, s = document.createElement('canvas'); s.width = sw; s.height = sh;
  const sg = s.getContext('2d'); sg.drawImage(c, 0, 0, sw, sh);
  const px = sg.getImageData(0, 0, sw, sh).data;
  const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const colours = {};
  for (const k in rects) {
    colours[k] = rects[k].map((r) => {
      let R = 0, G = 0, B = 0, n = 0;
      for (let y = Math.floor(r.y / 16); y < Math.ceil((r.y + r.h) / 16); y++) for (let x = Math.floor(r.x / 16); x < Math.ceil((r.x + r.w) / 16); x++) {
        const o = (y * sw + x) * 4; R += toLin(px[o]); G += toLin(px[o + 1]); B += toLin(px[o + 2]); n++;
      }
      return [R / n, G / n, B / n];
    });
  }
  return { canvas: c, rects, colours };
}

// ------------------------------------------------------------------ the sign material
const KIND = { LED: 0, MARQUEE: 1, NEON: 2, SHOP: 3 };

// ------------------------------------------------------------------ shop interiors (2048 x 1024: 4 x 2 of 512 x 256,
// each ~6 x 3 m of shop seen through the glass): deli, cafe, clothes, pharmacy, electronics, bar, pizza, lobby
const SHOPS = [
  { wall: ['#3a2a1c', '#5a4028'], light: '#ffd9a0', shelves: true, goods: ['#e33', '#fc3', '#3a6', '#36c', '#f80', '#fff'], fridge: true },
  { wall: ['#4a2e1e', '#7a5232'], light: '#ffc27a', pendants: true, counter: '#2a1a10' },
  { wall: ['#8a8278', '#a8a094'], light: '#fff2dc', racks: true, goods: ['#222', '#844', '#336', '#aa8', '#c66', '#555'] },
  { wall: ['#7c8c96', '#a4b4bc'], light: '#e8f4ff', shelves: true, goods: ['#fff', '#9cf', '#f66', '#6c9', '#fd6', '#c9f'] },
  { wall: ['#14161c', '#232733'], light: '#c8dcff', screens: true, counter: '#0c0d10' },
  { wall: ['#2a0e10', '#4a1618'], light: '#ff9a6a', bottles: true, counter: '#1a0a08' },
  { wall: ['#5a3a20', '#8a5a30'], light: '#ffcf8a', oven: true, counter: '#3a2414', menu: true },
  { wall: ['#6e665a', '#9a9080'], light: '#fff0d8', lobby: true },
];
function drawShop(g, w, h, S, R) {
  const wall = g.createLinearGradient(0, 0, 0, h); wall.addColorStop(0, S.wall[1]); wall.addColorStop(1, S.wall[0]);
  g.fillStyle = wall; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h * 0.86, w, h * 0.14);            // floor
  g.globalCompositeOperation = 'lighter';
  for (let x = 40; x < w; x += 120) { const gr = g.createRadialGradient(x, 6, 0, x, 6, 90); gr.addColorStop(0, S.light); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.55; g.fillStyle = gr; g.fillRect(x - 90, 0, 180, 120); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(255,255,255,0.85)'; for (let x = 20; x < w; x += 120) g.fillRect(x, 4, 60, 4);   // ceiling tubes
  const goods = S.goods || ['#888'];
  if (S.shelves) for (let row = 0; row < 4; row++) {
    const y = h * (0.28 + row * 0.15);
    g.fillStyle = '#2a2622'; g.fillRect(0, y + 22, w * (S.fridge ? 0.7 : 1), 4);
    for (let x = 4; x < w * (S.fridge ? 0.7 : 1) - 8; x += 7 + R() * 5) { g.fillStyle = goods[(R() * goods.length) | 0]; const ph = 10 + R() * 12; g.fillRect(x, y + 22 - ph, 5 + R() * 4, ph); }
  }
  if (S.fridge) { g.fillStyle = '#9fe0ff'; g.globalAlpha = 0.8; g.fillRect(w * 0.72, h * 0.18, w * 0.26, h * 0.66); g.globalAlpha = 1; g.strokeStyle = '#334'; g.lineWidth = 3; for (let x = w * 0.72; x < w * 0.98; x += w * 0.087) g.strokeRect(x, h * 0.18, w * 0.087, h * 0.66); for (let row = 0; row < 5; row++) for (let x = w * 0.73; x < w * 0.97; x += 9) { g.fillStyle = goods[(R() * goods.length) | 0]; g.fillRect(x, h * (0.22 + row * 0.12), 6, 18); } }
  if (S.racks) for (let k = 0; k < 4; k++) { const x0 = 30 + k * 120; g.fillStyle = '#555'; g.fillRect(x0, h * 0.35, 90, 3); for (let x = x0; x < x0 + 88; x += 6) { g.fillStyle = goods[(R() * goods.length) | 0]; g.fillRect(x, h * 0.36, 5, 50 + R() * 30); } }
  if (S.pendants) for (let x = 60; x < w; x += 110) { g.fillStyle = '#111'; g.fillRect(x, 0, 2, 60); const gr = g.createRadialGradient(x, 66, 0, x, 66, 40); gr.addColorStop(0, '#fff3c8'); gr.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gr; g.fillRect(x - 40, 26, 80, 80); }
  if (S.screens) for (let k = 0; k < 6; k++) { const x = 20 + k * 82; g.fillStyle = '#000'; g.fillRect(x, h * 0.2, 70, 44); g.fillStyle = `hsl(${(k * 57) % 360},80%,55%)`; g.fillRect(x + 3, h * 0.2 + 3, 64, 38); }
  if (S.bottles) for (let row = 0; row < 3; row++) { g.fillStyle = '#ffb070'; g.globalAlpha = 0.5; g.fillRect(0, h * (0.2 + row * 0.16), w, 3); g.globalAlpha = 1; for (let x = 6; x < w; x += 9) { g.fillStyle = ['#7a3', '#da5', '#b33', '#eee', '#4a8'][(R() * 5) | 0]; g.fillRect(x, h * (0.2 + row * 0.16) - 22, 5, 22); } }
  if (S.oven) { g.fillStyle = '#222'; g.fillRect(w * 0.6, h * 0.3, w * 0.3, h * 0.36); const gr = g.createRadialGradient(w * 0.75, h * 0.5, 0, w * 0.75, h * 0.5, 50); gr.addColorStop(0, '#ffb040'); gr.addColorStop(1, 'rgba(255,60,0,0.1)'); g.fillStyle = gr; g.beginPath(); g.ellipse(w * 0.75, h * 0.52, 46, 26, 0, Math.PI, 0); g.fill(); }
  if (S.menu) { g.fillStyle = '#111'; g.fillRect(w * 0.1, h * 0.12, w * 0.4, h * 0.22); g.fillStyle = '#fff'; for (let k = 0; k < 6; k++) g.fillRect(w * 0.12, h * (0.15 + k * 0.03), w * (0.16 + R() * 0.18), 3); }
  if (S.lobby) { g.fillStyle = '#6a5a48'; g.fillRect(w * 0.35, h * 0.55, w * 0.3, h * 0.2); g.fillStyle = '#e8dcc4'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 2, h); g.fillStyle = '#c9a050'; g.fillRect(w * 0.42, h * 0.3, w * 0.16, h * 0.08); }
  if (S.counter) { g.fillStyle = S.counter; g.fillRect(w * 0.05, h * 0.62, w * 0.5, h * 0.24); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(w * 0.05, h * 0.62, w * 0.5, 4); }
  // a few people silhouettes
  for (let k = 0; k < 2; k++) if (R() < 0.6) { const x = w * (0.15 + R() * 0.7); g.fillStyle = 'rgba(10,10,14,0.85)'; g.beginPath(); g.ellipse(x, h * 0.44, 9, 11, 0, 0, 7); g.fill(); g.fillRect(x - 13, h * 0.5, 26, h * 0.36); }
}
/** Interior panoramas (equirect images, Poly Haven CC0 indoor HDRIs tone-mapped offline) stacked into one strip
 *  texture (512 x 256 each); falls back to the drawn shops when none loaded. Returns { texture, count }. */
export function buildInteriorAtlas(images) {
  if (!images.length) { const a = buildShopAtlas(); return { texture: a.texture, count: 1 }; }
  const c = document.createElement('canvas'); c.width = 512; c.height = 256 * images.length;
  const g = c.getContext('2d');
  images.forEach((im, i) => g.drawImage(im, 0, i * 256, 512, 256));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.ClampToEdgeWrapping;
  return { texture: t, count: images.length };
}

export function buildShopAtlas() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const g = c.getContext('2d'), R = rng(77);
  const rects = [];
  SHOPS.forEach((S, i) => { const x = (i % 4) * 512, y = Math.floor(i / 4) * 256; g.save(); g.beginPath(); g.rect(x, y, 512, 256); g.clip(); g.translate(x, y); drawShop(g, 512, 256, S, R); g.restore(); rects.push([x / 2048, 1 - (y + 256) / 1024, 512 / 2048, 256 / 1024]); });
  // shops atlas rect in the sign rect units: the sign shader adds vRect.xy, scales by vRect.zw
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { texture: t, rects, canvas: c };
}

function signMaterial(atlas, U) {
  const m = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.35, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.12 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uAtlas: { value: atlas } }); // U carries uShops (the shop interiors)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aRect; attribute vec4 aAnim; attribute vec4 aLook;
varying vec2 vSUv; varying vec4 vRect; varying vec4 vAnim; varying vec4 vLook;
varying vec3 vSPos; varying vec3 vSTan; varying vec3 vSBit; varying vec3 vSNor;`)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSUv = uv; vRect = aRect; vAnim = aAnim; vLook = aLook;')
      .replace('#include <project_vertex>', `#include <project_vertex>
{ mat3 sM = mat3(modelViewMatrix) * mat3(instanceMatrix); vSTan = normalize(sM * vec3(1.0, 0.0, 0.0)); vSBit = normalize(sM * vec3(0.0, 1.0, 0.0)); vSNor = normalize(sM * vec3(0.0, 0.0, 1.0)); vSPos = mvPosition.xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uAtlas; uniform sampler2D uShops; uniform float uTime; uniform float uSignGain;
varying vec2 vSUv; varying vec4 vRect; varying vec4 vAnim; varying vec4 vLook;
varying vec3 vSPos; varying vec3 vSTan; varying vec3 vSBit; varying vec3 vSNor;
float sHash(float n) { return fract(sin(n) * 43758.5453); }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
if (vAnim.w > 2.5) { roughnessFactor = 0.14; diffuseColor.rgb = vec3(0.004); } // shop glass: a dark mirror-ish pane (env + SSR)
#ifdef ENGINE_GBUFFER
engineGbRoughness = roughnessFactor;
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  // vAnim: x frames (1 = static), y phase s, z s per frame, w kind (0 LED, 1 marquee, 2 neon); vLook: x gain, y seed
  vec2 suv = vSUv;
  if (!gl_FrontFacing) suv.x = 1.0 - suv.x;  // blades read the right way round from both sides
  float t = uTime + vAnim.y;
  float fr = vAnim.x > 1.5 ? mod(floor(t / vAnim.z), vAnim.x) : 0.0;
  vec2 uv = vec2(vRect.x + (fr + suv.x) * vRect.z, vRect.y + suv.y * vRect.w);
  vec3 c = vAnim.w > 2.5 ? vec3(0.0) : texture2D(uAtlas, uv).rgb;
  float gain = vLook.x;
  if (vAnim.w > 2.5) {
    // shop front (vAnim.y: 0 open, 1 closed): open = a photographed interior (an equirect panorama of a real room,
    // looked up along the view ray in the front's own frame, so it shifts with the viewpoint like a room behind glass),
    // closed = a steel roller shutter with a faint night light through the transom. Mullions, transom, door.
    vec3 V = normalize(-vSPos);
    vec3 d = -vec3(dot(V, vSTan), dot(V, vSBit), -dot(V, vSNor)); // into the shop: x along the front, y up, z inward
    vec2 sz = vLook.zw;
    float panes = max(1.0, floor(sz.x / 1.6 + 0.5));
    float fx = fract(suv.x * panes), pane = floor(suv.x * panes);
    if (vAnim.y < 0.5) {
      float yaw0 = (vLook.y - 0.5) * 2.0 + (suv.x - 0.5) * 0.9;           // per shop, and across the front
      float u = 0.5 + atan(d.x, d.z) / 6.2832 + yaw0 * 0.08;
      float v = 0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.1416 * 0.92 - 0.06;
      c = texture2D(uShops, vec2(vRect.x + fract(u) * vRect.z, vRect.y + clamp(v, 0.02, 0.98) * vRect.w)).rgb;
      c *= c * 0.32; // display-referred panoramas back to linear-ish, and dim: a suggestion behind the reflections
    } else {
      float band = 0.65 + 0.35 * smoothstep(0.0, 0.18, abs(fract(suv.y * 46.0) - 0.5));
      c = vec3(0.022, 0.021, 0.02) * band * (0.8 + 0.4 * sHash(pane + vLook.y * 37.0));
      c = mix(c, vec3(0.12, 0.08, 0.045), step(0.83, suv.y) * step(suv.y, 0.95)); // the transom: a night light inside
    }
    float px = fwidth(suv.x * panes) * 1.5;
    float frame = 1.0 - smoothstep(0.0, 0.02 + px, min(fx, 1.0 - fx));
    if (vAnim.z > 1.5) frame = 0.0; // glazing bars, transom and door are geometry (groundfloors.js)
    else {
    frame = max(frame, 1.0 - smoothstep(0.0, 0.012 + fwidth(suv.y), abs(suv.y - 0.8)));
    frame = max(frame, step(suv.y, 0.04)); frame = max(frame, step(0.975, suv.y));
    if (vAnim.y < 0.5) {
      float door = step(abs(pane - floor(vLook.y * panes)), 0.5) * step(suv.y, 0.8);
      c *= mix(1.0, 0.6, door);
      frame = max(frame, door * (1.0 - smoothstep(0.0, 0.025, abs(suv.y - 0.42))) * step(0.15, fx) * step(fx, 0.85));
    }
    }
    c = mix(c, vec3(0.006), frame);
  } else if (vAnim.w < 0.5) {
    // LED screen: a wipe between frames, a slow sheen, the dot grid where it is resolved (fades with the derivative)
    float ph = fract(t / vAnim.z);
    float wipe = smoothstep(0.0, 0.04, ph) * (1.0 - smoothstep(0.96, 1.0, ph));
    c *= mix(0.15, 1.0, max(wipe, step(vAnim.x, 1.5)));
    c *= 0.92 + 0.12 * smoothstep(0.7, 1.0, sin(suv.x * 3.0 - t * 0.9) * 0.5 + 0.5);
    vec2 cell = fract(suv * vec2(vRect.z, vRect.w) * vec2(${AW / 2}.0, ${AH / 2}.0));
    float px = max(fwidth(suv.x * vRect.z * ${AW / 2}.0), fwidth(suv.y * vRect.w * ${AH / 2}.0));
    float dots = smoothstep(0.5, 0.25, length(cell - 0.5));
    c *= mix(0.35 + 0.9 * dots, 1.0, smoothstep(0.25, 0.6, px));
  } else if (vAnim.w < 1.5) {
    // marquee: chaser bulbs along the border (bright warm texels), slowly running
    float lum = dot(c, vec3(0.3, 0.55, 0.15));
    float edge = step(suv.y, 0.07) + step(0.93, suv.y) + step(suv.x, 0.035) + step(0.965, suv.x);
    float chase = 0.55 + 0.45 * step(0.5, fract((suv.x + suv.y) * 14.0 - t * 1.6));
    c *= mix(1.0, chase * 1.6, step(0.5, edge) * step(0.55, lum));
  } else {
    // neon: a little hum, now and then a stutter on a few signs
    float s = vLook.y;
    float stutter = step(0.985, sHash(floor(t * 9.0) + s * 91.0)) * step(0.75, s);
    c *= (0.94 + 0.06 * sin(t * 50.0 + s * 20.0)) * (1.0 - 0.8 * stutter);
  }
  totalEmissiveRadiance = c * gain * uSignGain;
}`);
  };
  m.customProgramCacheKey = () => 'nyc-sign-5';
  return m;
}

// ------------------------------------------------------------------ placement
const _n = [0, 0];
/** Outward unit normal of edge a -> b of ring p (the side whose probe point is outside the footprint). */
function outward(p, ax, az, bx, bz, inside) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
  let nx = dz / L, nz = -dx / L;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  if (inside(mx + nx * 0.6, mz + nz * 0.6, p)) { nx = -nx; nz = -nz; }
  _n[0] = nx; _n[1] = nz;
  return _n;
}
function pointIn(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], zi = ring[i][1], xj = ring[j][0], zj = ring[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Place the signs. o: { world, square: {x, z} (world), squareRadius = 190, shopRadius = 520, seed, maxScreens,
 * lightScale }. Returns { group, mesh, ticker, uniforms, lights: [{ x, y, z, range, r, g, b, anim: { rects, colours,
 * frames, phase, period } | null }], counts }.
 */
export function buildSignage(o) {
  const { world } = o;
  const R = rng(o.seed ?? 20251111);
  const atlasData = buildSignAtlas();
  const atlas = new THREE.CanvasTexture(atlasData.canvas);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 8;
  atlas.generateMipmaps = true; atlas.minFilter = THREE.LinearMipmapLinearFilter;
  const shopsAtlas = buildInteriorAtlas(o.interiors || []);
  const U = { uTime: { value: 0 }, uSignGain: { value: 1 }, uShops: { value: shopsAtlas.texture } };
  const mat = signMaterial(atlas, U);
  const SQ = o.square, sqR = o.squareRadius ?? 190, shopR = o.shopRadius ?? 520;
  const raster = world.raster, street = RBIT.ROAD | RBIT.SIDEWALK;
  const inst = []; // { x, y, z, yaw, w, h, rect, anim[4], look[4] }
  const lights = [];
  const tickers = [];
  const counts = { screens: 0, marquees: 0, fascias: 0, blades: 0, tickers: 0 };
  const rr = (a, b) => a + (b - a) * R();
  const rect4 = (r) => [r.x / AW, 1 - (r.y + r.h) / AH, r.w / AW, r.h / AH];
  const add = (x, y, z, yaw, w, h, rect, anim, look) => { inst.push({ x, y, z, yaw, w, h, rect, anim, look }); return inst.length - 1; };
  // structure (one instanced box mesh): screen cabinets, rooftop posts, entrance canopies. { x, y, z (centre), yaw, w, h, d, glow }
  const boxes = [];
  const box = (x, y, z, yaw, w, h, d, glow = 0) => boxes.push({ x, y, z, yaw, w, h, d, glow });
  const shops = [], canopies = [], fasciaAt = []; // shop bays and entrance canopies: placed here (same draws), built by groundfloors.js
  counts.wraps = 0; counts.roof = 0; counts.canopies = 0; counts.wash = 0;
  /** An LED screen w x h on a dark cabinet `depth` deep, its face `out` m off the wall at (s along the edge). */
  const screen = (f, s, yc, w, h, out, list, phase, period, yaw, lightOut = null) => {
    const at = (ss, o2) => [f.a[0] + f.tx * ss + f.nx * o2, f.a[1] + f.tz * ss + f.nz * o2];
    const [x, z] = at(s, out);
    add(x, yc, z, yaw, w, h, rect4(ads[list * 4]), [4, phase, period, KIND.LED], [rr(1.15, 1.45), R(), 0, 0]);
    const [bx, bz] = at(s, out / 2 - 0.02);
    box(bx, yc, bz, yaw, w + 0.5, h + 0.5, Math.max(0.3, out - 0.04));
    const [lx, lz] = at(s, lightOut ?? Math.min(6, 2 + w * 0.15));
    lights.push({ kind: 'screen', sx: x, sy: yc, sz: z, nx: f.nx, nz: f.nz, x: lx, y: yc - h * 0.15, z: lz, range: Math.min(12 + w * 0.45, 22), k: (w * h) / 260 * L, anim: { cols: adCol.slice(list * 4, list * 4 + 4), frames: 4, phase, period }, r: 1, g: 1, b: 1 });
    counts.screens++;
  };
  const ground = (x, z) => world.getGroundHeight(x, z);
  const theatre = /theat/i;
  const ads = atlasData.rects.ads, adCol = atlasData.colours.ads;
  const maxScreens = o.maxScreens ?? 90;
  const L = o.lightScale ?? 1;

  // facades that face a street, nearest the square first (screens fill the square, shops the blocks around)
  const facades = [];
  for (const b of world.data.buildings) {
    const p = b && b.p; if (!p || p.length < 3 || !(b.h > 0) || (b.mh || 0) > 0.5) continue;
    let cx = 0, cz = 0; for (const q of p) { cx += q[0]; cz += q[1]; } cx /= p.length; cz /= p.length;
    const d = Math.hypot(cx - SQ.x, cz - SQ.z);
    if (d > shopR + 60) continue;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], c = p[(i + 1) % p.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 5) continue;
      const [nx, nz] = outward(p, a[0], a[1], c[0], c[1], pointIn);
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      if (!raster.any(mx + nx * 3.5, mz + nz * 3.5, 1.5, street)) continue;
      const dm = Math.hypot(mx - SQ.x, mz - SQ.z);
      facades.push({ b, a, c, len, nx, nz, mx, mz, d: dm, tx: (c[0] - a[0]) / len, tz: (c[1] - a[1]) / len, theatre: theatre.test(String(b.n || '')) });
    }
  }
  facades.sort((p, q) => p.d - q.d);
  const yawOf = (nx, nz) => Math.atan2(nx, nz); // plane faces +Z: rotate +Z onto the normal

  // ---- corner wraps: two screens meeting at a building corner between two street fronts (same playlist and phase,
  // so they read as one screen bent round the corner), on tall buildings around the square
  {
    const byB = new Map();
    for (const f of facades) { if (!byB.has(f.b)) byB.set(f.b, []); byB.get(f.b).push(f); }
    for (const [b, fs] of byB) {
      if (counts.wraps >= 6 || !(b.h > 28)) continue;
      for (const f1 of fs) {
        const f2 = fs.find((g) => g.a === f1.c);
        if (!f2 || f1.d > sqR || f1.len < 9 || f2.len < 9) continue;
        const turn = f1.tx * f2.tx + f1.tz * f2.tz; // cos of the corner angle between the two runs
        if (Math.abs(turn) > 0.45 || R() > 0.7) continue;
        const gy = ground(f1.c[0], f1.c[1]), w = Math.min(9, f1.len * 0.5, f2.len * 0.5), h = rr(9, 14), yc = gy + rr(12, 20) + h / 2;
        if (yc + h / 2 > gy + b.h - 2) continue;
        const list = Math.floor(R() * 3), phase = rr(0, 40), period = rr(6, 9), out = 0.6;
        screen(f1, f1.len - w / 2 + out * Math.abs(f2.tx * f1.nx + f2.tz * f1.nz), yc, w, h, out, list, phase, period, yawOf(f1.nx, f1.nz));
        screen(f2, w / 2 - out, yc, w, h, out, list, phase, period, yawOf(f2.nx, f2.nz));
        f1.wrapped = f2.wrapped = true; counts.wraps++;
        break;
      }
    }
  }
  // ---- rooftop sign structures on the low buildings round the square: a screen on a steel frame above the parapet
  for (const f of facades) {
    const H = f.b.h;
    if (f.d > sqR + 80 || H < 9 || H > 40 || f.len < 10 || f.b._roof || counts.roof >= 10 || R() > 0.4) continue;
    f.b._roof = true;
    const gy = ground(f.mx, f.mz), w = Math.min(f.len * 0.75, 18), h = w * 0.5, s = f.len / 2, base = gy + H + 1.6;
    const yaw = yawOf(f.nx, f.nz), at = (ss, o2) => [f.a[0] + f.tx * ss + f.nx * o2, f.a[1] + f.tz * ss + f.nz * o2];
    screen(f, s, base + h / 2, w, h, -1.2, Math.floor(R() * 3), rr(0, 40), rr(5, 9), yaw, 3);
    for (const k of [-0.38, 0, 0.38]) { const [px, pz] = at(s + k * w, -1.9); box(px, gy + H + (1.6 + h) / 2, pz, yaw, 0.25, 1.6 + h, 0.25); }
    const [cx, cz] = at(s, -2.6); box(cx, base + h * 0.5, cz, yaw, w, 0.18, 1.6); // a catwalk behind
    counts.roof++;
  }
  // ---- entrance canopies (hotels, office lobbies): a dark cantilevered slab with a lit underside strip and a warm
  // downlight; and wall lights washing down the facades of every street front near the square
  for (const f of facades) {
    if (f.d > shopR || f.len < 14) continue;
    const gy = ground(f.mx, f.mz), yaw = yawOf(f.nx, f.nz), at = (ss, o2) => [f.a[0] + f.tx * ss + f.nx * o2, f.a[1] + f.tz * ss + f.nz * o2];
    if (!f.theatre && counts.canopies < 70 && f.b.h > 25 && R() < 0.22) {
      const w = rr(3.6, 6), d = rr(2.2, 3.2), s = rr(w, f.len - w);
      const [x, z] = at(s, d / 2);
      canopies.push({ f, s, w, d, gy, yaw }); // built by groundfloors.js (canopy, doors, lobby behind the glass)
      const [lx, lz] = at(s, d * 0.6);
      lights.push({ kind: 'canopy', sx: x, sy: gy + 3.4, sz: z, nx: f.nx, nz: f.nz, x: lx, y: gy + 3.1, z: lz, range: 9, k: 1, anim: null, r: 0.9, g: 0.62, b: 0.36 });
      counts.canopies++;
    }
    if (f.d < sqR + 260) {
      for (let s = 7; s < f.len - 3; s += 24) {
        const [bx, bz] = at(s, 0.12), [lx, lz] = at(s, 1.6);
        void bx; void bz; // (no visible fixture box: it read as a floating white card)
        lights.push({ kind: 'wash', sx: lx, sy: gy + 4.6, sz: lz, nx: f.nx, nz: f.nz, x: lx, y: gy + 3.4, z: lz, range: 9, k: 1, anim: null, r: 0.9, g: 0.6, b: 0.32 });
        counts.wash++;
      }
    }
  }

  for (const f of facades) {
    const gy = ground(f.mx, f.mz), H = f.b.h;
    const yaw = yawOf(f.nx, f.nz);
    const at = (s, out) => [f.a[0] + f.tx * s + f.nx * out, f.a[1] + f.tz * s + f.nz * out]; // s along the edge, out off the wall
    if (f.d < shopR && H > 5 && !f.theatre) {
      // a continuous run of lit shop fronts along the ground floor, one bay per ~5-9 m, a pier between bays
      for (let s0 = 0.6; s0 + 3 < f.len; ) {
        const w = Math.min(rr(4.5, 9), f.len - s0 - 0.6);
        if (w < 2.5) break;
        if (R() < 0.9) {
          // 1 a.m.: about half the shops are closed behind roller shutters (a dim night light in the transom)
          const open = R() < 0.5, k = Math.floor(R() * shopsAtlas.count), hh = 3.0;
          const r4 = [0, 1 - (k + 1) / shopsAtlas.count, 1, 1 / shopsAtlas.count];
          const [x, z] = at(s0 + w / 2, 0.55);
          // the front itself (stall riser, glazing, doorway, fascia, shutter) is real geometry: groundfloors.js
          shops.push({ f, s0, w, gy, yaw, open, k, r4, look: [open ? rr(0.35, 0.55) : rr(0.25, 0.4), R(), w, hh] });
          if (open) {
            const [lx, lz] = at(s0 + w / 2, 1.6);
            lights.push({ kind: 'shop', sx: x, sy: gy + 1.6, sz: z, nx: f.nx, nz: f.nz, x: lx, y: gy + 2.2, z: lz, range: 7, k: 0.3 * L, anim: null, r: 1.5, g: 1.05, b: 0.62 });
          }
          counts.shops = (counts.shops || 0) + 1;
        }
        s0 += w + rr(0.5, 0.9);
      }
    }
    // ---- giant LED screens around the square
    if (f.d < sqR && H > 14 && counts.screens < maxScreens && R() < 0.92) {
      let y = gy + rr(6.5, 9), stack = 0;
      const top = gy + Math.min(H - 2, 70);
      while (y < top - 5 && stack < 4 && counts.screens < maxScreens) {
        const w = Math.min(f.len * rr(0.6, 0.92), 34), h = Math.min(w * 0.5, top - y);
        if (w < 6 || h < 3) break;
        const s = (f.len - w) * rr(0.15, 0.85) + w / 2;
        screen(f, s, y + h / 2, w, h, rr(0.7, 1.3), Math.floor(R() * 3), rr(0, 40), rr(5, 9), yaw);
        stack++;
        y += h + rr(1.2, 3.5);
      }
      // a news ticker band wrapping this facade, low down
      if (f.len > 14 && counts.tickers < 6 && R() < 0.3) {
        tickers.push({ f, y: gy + 4.6, h: 1.25 });
        counts.tickers++;
      }
      continue;
    }
    // ---- theatre marquees (OSM-named theatres), over the entrance
    if (f.theatre && f.d < shopR && counts.marquees < 12 && f.len > 8 && !f.b._marq) {
      f.b._marq = true;
      const w = Math.min(f.len * 0.7, 16), h = w * 0.5 * 0.55;
      const [x, z] = at(f.len / 2, 1.4);
      const m = counts.marquees % 4, r4 = rect4(atlasData.rects.marquees[m]);
      add(x, gy + 4.2 + h / 2, z, yaw, w, h, r4, [1, rr(0, 9), 1, KIND.MARQUEE], [1.5, R(), 0, 0]);
      const c = atlasData.colours.marquees[m];
      const [lx, lz] = at(f.len / 2, 4);
      lights.push({ kind: 'marquee', sx: x, sy: gy + 4.2, sz: z, nx: f.nx, nz: f.nz, x: lx, y: gy + 3.4, z: lz, range: 16, k: 1.4 * L, anim: null, r: c[0] + 0.25, g: c[1] + 0.18, b: c[2] + 0.05 });
      counts.marquees++;
      continue;
    }
    // ---- shops: fascias every ~9 m of street front, blades now and then
    if (f.d < shopR && H > 5) {
      for (let s = 2.5; s + 3 < f.len; s += rr(7.5, 12)) {
        if (R() < 0.42) {
          const w = Math.min(rr(3.6, 5.6), f.len - s), h = w / 4;
          const i = Math.floor(R() * 16), r4 = rect4(atlasData.rects.fascias[i]);
          const [x, z] = at(s + w / 2, 0.42);
          add(x, gy + rr(3.3, 3.8) + h / 2, z, yaw, w, h, r4, [1, rr(0, 50), 1, KIND.NEON], [rr(1.1, 1.5), R(), 0, 0]);
          const c = atlasData.colours.fascias[i], [lx, lz] = at(s + w / 2, 1.8);
          lights.push({ kind: 'fascia', sx: x, sy: gy + 3.6, sz: z, nx: f.nx, nz: f.nz, x: lx, y: gy + 3.2, z: lz, range: 9, k: 0.55 * L, anim: null, ...boost(c, 1.2) });
          counts.fascias++; fasciaAt.push({ f, s0: s, s1: s + w });
        }
        if (H > 9 && R() < 0.1) {
          const h = rr(3, 5.5), w = h / 4;
          const i = Math.floor(R() * 16), r4 = rect4(atlasData.rects.blades[i]);
          const [x, z] = at(s, 0.15 + w / 2); // perpendicular to the wall, sticking out
          add(x, gy + rr(5, 8) + h / 2, z, yaw + Math.PI / 2, w, h, r4, [1, rr(0, 50), 1, KIND.NEON], [rr(1.2, 1.6), R(), 0, 0]);
          const c = atlasData.colours.blades[i], [lx, lz] = at(s, 2.2);
          lights.push({ kind: 'blade', sx: x, sy: gy + 6.5, sz: z, nx: f.nx, nz: f.nz, x: lx, y: gy + 6.5, z: lz, range: 11, k: 0.6 * L, anim: null, ...boost(c, 1.2) });
          counts.blades++;
        }
      }
    }
  }

  // ---- the instanced signs
  const n = inst.length;
  const geo = new THREE.PlaneGeometry(1, 1);
  const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index;
  for (const k of ['position', 'normal', 'uv']) ig.setAttribute(k, geo.getAttribute(k));
  const aRect = new Float32Array(n * 4), aAnim = new Float32Array(n * 4), aLook = new Float32Array(n * 4);
  inst.forEach((s, i) => { aRect.set(s.rect, i * 4); aAnim.set(s.anim, i * 4); aLook.set(s.look, i * 4); });
  ig.setAttribute('aRect', new THREE.InstancedBufferAttribute(aRect, 4));
  ig.setAttribute('aAnim', new THREE.InstancedBufferAttribute(aAnim, 4));
  ig.setAttribute('aLook', new THREE.InstancedBufferAttribute(aLook, 4));
  const mesh = new THREE.InstancedMesh(ig, mat, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3();
  inst.forEach((s, i) => { q.setFromAxisAngle(up, s.yaw); m4.compose(P.set(s.x, s.y, s.z), q, S.set(s.w, s.h, 1)); mesh.setMatrixAt(i, m4); });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = 'signs'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;

  // ---- tickers: a scrolling news band along the facade (own canvas texture, repeat-wrapped, offset per frame)
  const group = new THREE.Group(); group.name = 'signage'; group.add(mesh);
  if (boxes.length) {
    const bm = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.6 });
    // the canopies' soffits glow warm (instance colour, emissive: one material for everything)
    bm.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.42) * 0.55 * vGlow;');
    };
    bm.customProgramCacheKey = () => 'nyc-sign-box-1';
    const bg = new THREE.BoxGeometry(1, 1, 1);
    bg.setAttribute('aGlow', new THREE.InstancedBufferAttribute(new Float32Array(boxes.map((b) => b.glow)), 1));
    const bmesh = new THREE.InstancedMesh(bg, bm, boxes.length);
    boxes.forEach((b, i) => { q.setFromAxisAngle(up, b.yaw); m4.compose(P.set(b.x, b.y, b.z), q, S.set(b.w, b.h, b.d)); bmesh.setMatrixAt(i, m4); });
    bmesh.instanceMatrix.needsUpdate = true; bmesh.computeBoundingSphere();
    bmesh.name = 'sign-structures'; bmesh.castShadow = true; bmesh.receiveShadow = true;
    group.add(bmesh);
  }
  let ticker = null;
  if (tickers.length) {
    const tc = document.createElement('canvas'); tc.width = 4096; tc.height = 128;
    const g = tc.getContext('2d');
    g.fillStyle = '#020202'; g.fillRect(0, 0, 4096, 128);
    const items = ['RAIN CLEARS OVER MIDTOWN · 52°F', 'NOVA +2.4%  ZEPHYR −0.8%  QUILL +0.3%', 'SUBWAY SERVICE RESUMES ON ALL LINES', 'TONIGHT: CITY LIGHTS FESTIVAL ON 7TH AVE', 'MANGO+ NEW SEASON FRIDAY', 'SIX CROWS EXTENDS RUN THROUGH SPRING'];
    g.font = `800 84px ${SANS}`; g.textBaseline = 'middle'; g.shadowColor = '#ffb020'; g.shadowBlur = 12;
    let x = 20; let k = 0;
    while (x < 4096) { const s = `${items[k++ % items.length]}   ◆   `; g.fillStyle = k % 2 ? '#ffd040' : '#ff8030'; g.fillText(s, x, 66); x += g.measureText(s).width; }
    const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace; tt.wrapS = THREE.RepeatWrapping; tt.anisotropy = 8;
    const tm = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4, emissive: 0xffffff, emissiveMap: tt, emissiveIntensity: 1.3 });
    const pos = [], uvs = [], idx = [];
    for (const t of tickers) {
      const f = t.f, base = pos.length / 3, out = 0.5;
      // text runs to the viewer's right when facing the wall: along (nz, -nx)
      const flip = f.tx * f.nz - f.tz * f.nx < 0, A = flip ? f.c : f.a, B = flip ? f.a : f.c;
      const ax = A[0] + f.nx * out, az = A[1] + f.nz * out, bx = B[0] + f.nx * out, bz = B[1] + f.nz * out;
      const u1 = f.len / (t.h * (4096 / 128)); // keep the letters' aspect
      pos.push(ax, t.y, az, bx, t.y, bz, bx, t.y + t.h, bz, ax, t.y + t.h, az);
      uvs.push(0, 0, u1, 0, u1, 1, 0, 1);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      const mx = f.mx + f.nx * 2.5, mz = f.mz + f.nz * 2.5;
      lights.push({ x: mx, y: t.y, z: mz, range: 14, k: 0.9 * L, anim: null, r: 1.0, g: 0.62, b: 0.22 });
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    tg.setIndex(idx); tg.computeVertexNormals();
    ticker = new THREE.Mesh(tg, tm); ticker.name = 'ticker'; tm.side = THREE.DoubleSide;
    ticker.userData.tex = tt;
    group.add(ticker);
  }
  // light colours: static ones now, animated ones per frame (update)
  for (const l of lights) if (!l.anim) { l.r *= l.k; l.g *= l.k; l.b *= l.k; }
  // the small static signs (fascias, blades, tickers) merged on an 18 m grid: one light per cell at the mean position
  // with the summed colour (their spheres overlap anyway; far fewer lights per cluster cell)
  const merged = [], cells = new Map();
  for (const l of lights) {
    if (l.anim || l.kind === 'marquee' || l.kind === 'canopy' || l.kind === 'wash') { merged.push(l); continue; }
    const key = `${Math.floor(l.x / 18)},${Math.floor(l.z / 18)}`;
    let m = cells.get(key);
    if (!m) { m = { ...l, n: 0, x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, range: 0 }; cells.set(key, m); merged.push(m); }
    m.x = (m.x * m.n + l.x) / (m.n + 1); m.y = (m.y * m.n + l.y) / (m.n + 1); m.z = (m.z * m.n + l.z) / (m.n + 1); m.n++;
    m.r += l.r; m.g += l.g; m.b += l.b; m.range = Math.max(m.range, l.range + 2);
  }
  counts.lightsRaw = lights.length; counts.lights = merged.length;
  return { group, mesh, ticker, uniforms: U, lights: merged, signLights: lights, counts, atlas, material: mat, facades, shops, canopies, shopCount: shopsAtlas.count, fasciaAt, fasciaRects: atlasData.rects.fascias.map(rect4) };
}

/** Saturated light colour from a sign's mean colour (the dark backing pulls the mean down). */
function boost(c, k) {
  const m = Math.max(c[0], c[1], c[2], 1e-4);
  return { r: (c[0] / m) * k * 0.4, g: (c[1] / m) * k * 0.4, b: (c[2] / m) * k * 0.4 };
}

/** Per frame: time uniform, ticker scroll, animated sign light colours (the frame each screen shows). */
export function updateSignage(S, time) {
  S.uniforms.uTime.value = time;
  if (S.ticker) S.ticker.userData.tex.offset.x = (time * 0.035) % 1;
  for (const l of S.lights) {
    const a = l.anim; if (!a) continue;
    const t = time + a.phase, fr = Math.floor(t / a.period) % a.frames, ph = (t / a.period) % 1;
    const wipe = Math.min(1, ph / 0.04, (1 - ph) / 0.04);
    const c = a.cols[fr], k = l.k * (0.15 + 0.85 * Math.max(0, wipe)) * 1.6;
    l.r = c[0] * k; l.g = c[1] * k; l.b = c[2] * k;
  }
}

/**
 * The building generator's own storefront sign boards (Buildings.js MODE.SIGN, lit with procedural pseudo-lettering)
 * read as noise next to real text: keep their boards and colour, drop the fake letters, and light them as a soft
 * backlit panel (dimmer than this file's signs). A chained onBeforeCompile on the facade materials; no engine change.
 */
export function quietBuildingSigns(world) {
  const LETTER = 'fEmis = mix(vTint * 0.35, lcol * 1.6, lk) * uNight * 2.2;';
  for (const m of [world.mat && world.mat.facade, world.mat && world.mat.facadeWin]) {
    if (!m) continue;
    const prev = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      if (!sh.fragmentShader.includes(LETTER)) return;
      sh.fragmentShader = sh.fragmentShader
        .replace(LETTER, 'fCol = vTint * 0.1; fEmis = vec3(0.0);') // no blank lit boards: dark painted panels
        // lit windows per window, not per floor (the floor hash weighed 55 / 75 %); warm / cool per window
        .replace('float hp = mix(fHash(id + 3.7), fl, 0.55);', 'float hp = mix(fHash(id + 3.7), fl, 0.28);')
        .replace('float hp = mix(fHash(id + 3.7), fl, 0.75);', 'float hp = mix(fHash(id + 3.7), fl, 0.35);')
        .replace('step(0.5, fHash(vec2(vInfo.z, cell.y)))) * uWinGain', 'step(0.55, fHash(id + 8.1))) * uWinGain')
        // shop fronts: warm or cool, dimmer and varied (they were a flat white band at night)
        .replace('if (store > 0.5) lc = vec3(1.0, 0.84, 0.64);', 'if (store > 0.5) lc = mix(vec3(1.0, 0.8, 0.58), vec3(0.82, 0.9, 1.0), step(0.72, fHash(id + 2.9))) * (0.07 + 0.09 * fHash(id + 1.3));');
    };
    m.customProgramCacheKey = () => `${key()}|nyc-quiet-signs-4`;
    m.needsUpdate = true;
  }
}
