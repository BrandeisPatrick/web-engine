// lookStats (core/Bench.js): tone and palette statistics of a capture, the numbers a sample's art direction is held to.
import { lookStats, LOOK_HUES } from '../src/core/Bench.js';

let failed = 0, n = 0;
const check = (name, ok, got) => { n++; if (!ok) { failed++; console.log(`FAIL  ${name}`, got ?? ''); } else console.log(`PASS  ${name}`); };
// a capture of solid blocks: `cells` = [[r, g, b, count], ...] at scale s (data holds box sums = value * s * s)
function cap(cells, s = 2) {
  const total = cells.reduce((a, c) => a + c[3], 0), data = new Uint16Array(total * 4);
  let k = 0;
  for (const [r, g, b, c] of cells) for (let i = 0; i < c; i++) { data[k++] = r * s * s; data[k++] = g * s * s; data[k++] = b * s * s; data[k++] = 255 * s * s; }
  return { w: total, h: 1, scale: s, data };
}
{
  const s = lookStats(cap([[0, 0, 0, 50], [255, 255, 255, 50]]));
  check('black / white halves: mean 127.5, no saturation, no hues', s.lumMean === 127.5 && s.satMean === 0 && Object.keys(s.hues).length === 0, s);
  check('black / white halves: 50 % under 40, 50 % over 160 and over 240', s.under40 === 50 && s.under80 === 50 && s.over160 === 50 && s.over240 === 50 && s.lumMax === 255, s);
}
{
  const s = lookStats(cap([[200, 0, 0, 10], [200, 100, 0, 10], [0, 200, 200, 10], [100, 0, 200, 10], [20, 20, 20, 60]]), 4);
  check('hue bins: red, orange, cyan, violet at 10 % each', s.hues.red === 10 && s.hues.orange === 10 && s.hues.cyan === 10 && s.hues.violet === 10 && Object.keys(s.hues).length === 4, s.hues);
  check('dark greys are not counted as a hue; 60 % under 40', s.under40 === 70 && s.satMean === 0.4, s);
  check('scale does not change the result', JSON.stringify(s) === JSON.stringify(lookStats(cap([[200, 0, 0, 10], [200, 100, 0, 10], [0, 200, 200, 10], [100, 0, 200, 10], [20, 20, 20, 60]], 1))));
}
{
  // the reference frame the samples are held to is low key and single-hued: a synthetic stand-in passes its own gate
  const s = lookStats(cap([[23, 18, 14, 64], [90, 70, 70, 20], [115, 70, 52, 14], [155, 86, 60, 2]]));
  check('low-key warm frame: mean under 48, nothing over 160, only red / orange hues', s.lumMean < 48 && s.over160 === 0 && Object.keys(s.hues).every((h) => h === 'red' || h === 'orange'), s);
  check('LOOK_HUES: 12 names', LOOK_HUES.length === 12 && LOOK_HUES[0] === 'red' && LOOK_HUES[9] === 'violet');
}
console.log(failed ? `${failed} of ${n} check(s) FAILED` : `all ${n} checks passed`);
process.exit(failed ? 1 : 0);
