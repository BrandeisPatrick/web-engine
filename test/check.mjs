// The two test levels (AGENTS.md "Commands"):
//   npm run check        quick, for every change: the Node suites, the type check, the build, and the quick browser
//                        scripts (two starters loaded, the sound kit, the game shell, the HOWTO recipes)
//   npm run check:full   before `npm run deploy` or a release: the quick level, then smoke, the feature matrix,
//                        the played frame, phone-start, drive-feel, car-camera, flicker and perf
// Runs the steps in order with their output as it comes, stops at the first failing step and ends with a table:
// step, result, seconds. Exit code: the failing step's (perf's 2 is noise, see bench/README.md), else 0. The browser
// steps need Chrome and the GPU: run it through the machine's GPU lock when other jobs share the machine.
//   node test/check.mjs [quick|full]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const QUICK = [
  'npm test',
  'npm run types:check', // emits types/ first (npm run types)
  'npm run build',
  'node test/browser/check-page.mjs starter-walk',
  'node test/browser/check-page.mjs starter-drive',
  'node test/browser/sound-check.mjs',
  'node test/browser/shell.mjs --out=test/browser/out/shell',
  'node test/browser/howto.mjs',
];
const FULL = [
  ...QUICK,
  'npm run smoke',
  'node test/browser/feature-matrix.mjs',
  'node test/browser/played-frame.mjs',
  'node test/browser/phone-start.mjs',
  'node test/browser/drive-feel.mjs',
  'node test/browser/car-camera.mjs',
  'node test/browser/flicker.mjs',
  'npm run perf',
];

const level = process.argv[2] || 'quick';
const steps = { quick: QUICK, full: FULL }[level];
if (!steps) { console.error(`unknown level '${level}': quick or full`); process.exit(1); }
const cwd = fileURLToPath(new URL('../', import.meta.url));
const rows = [];
let code = 0;
for (const [i, step] of steps.entries()) {
  if (code) { rows.push([step, 'not run', '']); continue; }
  console.log(`\n=== check ${level} ${i + 1}/${steps.length}: ${step}\n`);
  const [cmd, ...args] = step.split(' ');
  const t = performance.now();
  const r = spawnSync(cmd === 'node' ? process.execPath : cmd, args, { cwd, stdio: 'inherit' });
  code = r.status ?? 1;
  rows.push([step, code ? `FAIL (${r.error?.code ?? `exit ${r.status ?? r.signal}`})` : 'pass', ((performance.now() - t) / 1000).toFixed(1)]);
}
const total = rows.reduce((s, r) => s + (+r[2] || 0), 0).toFixed(1);
const w = [Math.max(...rows.map((r) => r[0].length)), 16];
console.log(`\ncheck ${level}: ${code ? 'FAILED' : 'passed'}\n`);
for (const [a, b, c] of [['step', 'result', 'seconds'], ...rows, ['total', '', total]]) console.log(`${a.padEnd(w[0])}  ${b.padEnd(w[1])}  ${c.padStart(7)}`);
process.exitCode = code;
