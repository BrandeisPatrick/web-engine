// Self-test of test/helpers/alloc.mjs: what it does with a window it must not trust. Each case is a loop whose floor
// (run(0)) allocates more than its whole window, so the window reads below the floor, as when heapUsed drops without
// a GC (tyre-fx's smoke gate read -6 B / call on CI): such a window is retried and listed in `why`, and when every try
// reads below the floor the reading is NaN and the gate fails. A loop that allocates nothing, and one that does, read
// as they should through the same path.
import { ALLOC, bytesPerCall, gate } from './helpers/alloc.mjs';

let failures = 0;
const lines = [];
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(3).padStart(9) : String(x).padStart(9));
function check(name, v, lo, hi, unit = '') {
  const ok = Number.isFinite(v) && v >= lo && v <= hi;
  if (!ok) failures++;
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(64)} ${fmt(v)} ${unit.padEnd(4)} [${lo} .. ${hi}]`);
  return ok;
}
const note = (s) => lines.push(`      ${s}`);
// gate() through a check() that only records: how many of its checks failed
const gateFails = (m, budget) => { let f = 0; gate((n, v, lo, hi) => { if (!(Number.isFinite(v) && v >= lo && v <= hi)) f++; }, () => {}, 'x', m, { budget }); return f; };

if (!ALLOC.ok) note(ALLOC.reason);
else {
  const N = 1000, box = { keep: null };
  let sink = 0;
  const work = (n) => { for (let i = 0; i < n; i++) sink = (sink + i) | 0; };

  // one array per call whose length is the only thing run(0) changes (a branch first taken in the floor windows would
  // deoptimise the loop instead): 64 elements in run(0), 1 otherwise, 504 B more in each floor window
  const arr = (big) => { box.keep = new Array(big ? 64 : 1); };
  // 1. below the floor on every try: no valid window, NaN, the gate fails
  const always = (n) => { arr(n === 0); work(n); };
  const a = bytesPerCall(always, N, { warm: 2000, tries: 3 });
  check('below the floor on every try: no reading (NaN)', Number.isNaN(a.per) ? 1 : 0, 1, 1);
  check('  every try listed as below the floor', a.why.filter((s) => /below the floor/.test(s)).length, 3, 3);
  check('  gate() fails it', gateFails(a, 0.5), 1, 1);
  note(`always below: ${a.why.join('; ')}`);

  // 2. below the floor on the first try only: retried, listed in why, read on try 2
  let early = true;
  const once = (n) => { arr(n === 0 && early); work(n); if (n === N) early = false; };
  const o = bytesPerCall(once, N, { warm: 2000, tries: 3 });
  check('below the floor once: read on a later try', o.tries, 2, 3);
  check('  that reading allocates nothing', o.per, 0, 0.5, 'B');
  check('  the first try listed as below the floor', /^try 1: \d+ B below the floor/.test(o.why[0] ?? '') ? 1 : 0, 1, 1);
  check('  gate() passes it', gateFails(o, 0.5), 0, 0);
  note(`once below: ${o.why.join('; ')}`);

  // 3. the same path on a loop that allocates nothing and one that keeps one 64-element array per unit
  // (560 B: a 32 B JSArray and its 16 + 512 B backing store)
  const z = bytesPerCall((n) => work(n), N, { warm: 2000 });
  check('a loop that allocates nothing', z.per, 0, 0.5, 'B');
  const r = bytesPerCall((n) => { for (let i = 0; i < n; i++) box.keep = new Array(64); }, N, { warm: 2000, budget: 1000 });
  check('a loop that keeps a 64-element array per unit', r.per, 559, 561, 'B');
  if (!Number.isFinite(sink)) failures++;
}

console.log(lines.join('\n'));
console.log(failures ? `\n${failures} alloc-helper check(s) FAILED` : '\nall alloc-helper checks passed');
process.exit(failures ? 1 : 0);
