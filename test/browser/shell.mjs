// The game shell (src/ui/GameShell.js) on a real page in headless Chrome: starter-walk's own shell (window.__sample.shell),
// with the starter's real AudioBus({ master: 'safe' }) and CharacterInput. audio.start is wrapped only to count calls:
//   1. desktop, 1280 x 720: the start card is up over the blurred canvas once __sample.ready is set (ready() did not
//      wait for a click); the input is off behind it and the bus has not started; a real click starts (audio.start()
//      once, inside the click: the AudioContext runs), the input comes back and the blur clears; Esc pauses
//      (engine.clock paused, the game time stands still, the bus's setPaused(true) fades its buses); the volume slider
//      moves the bus's volume; Esc resumes.
//   2. reload: the slider's value is still there (and on the bus); Space starts from the keyboard.
//   3. ?autostart=1: ready() went straight to playing, no card; the bus waits for the first gesture (unlockOnGesture).
//   4. 375 x 812 touch: the card fits (no horizontal scroll), the touch sticks are hidden behind it, a tap starts, the
//      round pause button shows and pauses.
// Screenshots of the start card (desktop, 375 px) and the pause card go to --out=<dir> (default: the OS temp folder).
// Needs Chrome and the GPU: run it through the machine's GPU lock.
//   node test/browser/shell.mjs [--out=<dir>]
// Exit code 1 on a failed check, a console error or a page error.
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startVite, resolvePage, launchChrome, watchErrors, loadSample, parseArgs, repoRoot } from './playwright.config.mjs';

const args = parseArgs();
const out = path.resolve(typeof args.out === 'string' ? args.out : path.join(os.tmpdir(), 'vibe-shell'));
await fsp.mkdir(out, { recursive: true });
const vite = await startVite();
const browser = await launchChrome();
const fs = `/@fs${repoRoot.replace(/\/$/, '')}`;
const pagePath = await resolvePage(vite, 'starter-walk');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// in the page: take the starter's shell and bus, count audio.start() calls, record onStart / onPause
const BUILD = () => {
  const h = window.__sample, shell = window.__shell = h.shell, audio = h.audio;
  const log = window.__log = { start: 0, started: 0, pauses: [] };
  const start = audio.start.bind(audio);
  audio.start = (...a) => { log.start++; return start(...a); };
  if (!shell._rowsAdded) { shell.addToggle('assist', 'Steering assist'); shell._rowsAdded = true; }
  shell.onStart(() => { log.started++; });
  shell.onPause((p) => log.pauses.push(p));
  return { state: shell.state };
};
const STATE = () => {
  const s = window.__shell, c = window.__sample.engine.renderer.domElement, card = s.startCard, pc = s.pauseCard, a = window.__sample.audio;
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
  const touch = document.querySelector('.ui-touch');
  return {
    state: s.state, input: s.inputs[0].enabled, log: window.__log,
    bus: { started: a.started, ctx: a.ctx ? a.ctx.state : null, paused: a.paused, volume: a.volume, armed: !!a._unlock, mode: a.mode },
    touch: touch ? getComputedStyle(touch).display : null,
    filter: getComputedStyle(c).filter, startShown: card.classList.contains('show') && getComputedStyle(card).visibility === 'visible',
    pauseShown: pc.classList.contains('show') && getComputedStyle(pc).visibility === 'visible',
    focus: document.activeElement === s.startButton ? 'start' : document.activeElement === s.resumeButton ? 'resume' : document.activeElement && document.activeElement.tagName,
    clockPaused: window.__sample.engine.clock.paused, time: window.__sample.engine.clock.time,
    volume: s.settings.get('volume'), loading: !!document.querySelector('.ui-loading'),
    card: box(card), pcard: box(pc), vw: innerWidth, scrollW: document.scrollingElement.scrollWidth,
    pauseBtn: getComputedStyle(s.pauseButton).display !== 'none',
  };
};

async function open(viewport, query = '', extra = {}) {
  const page = await browser.newPage({ viewport, ...extra });
  const errors = watchErrors(page);
  const session = await loadSample(page, vite.base + pagePath + query, errors);
  if (session.status !== 'ready') throw new Error(`starter-walk not ready: ${session.note}`);
  return { page, errors };
}

try {
  // ---------------------------------------------------------------- 1. desktop: card, click, Esc, slider
  {
    const { page, errors } = await open({ width: 1280, height: 720 });
    const r = await page.evaluate(BUILD);
    check('__sample.ready set with the card up (ready() did not wait for a click)', r.state === 'title', `state ${r.state}`);
    await sleep(700);
    let s = await page.evaluate(STATE);
    check('start card visible, loading gone', s.startShown && !s.loading);
    check('canvas blurred and dimmed behind the card', /blur/.test(s.filter) && /brightness/.test(s.filter), s.filter);
    check('input off behind the card', s.input === false);
    check('the start button has focus', s.focus === 'start', String(s.focus));
    check('clock running behind the card', !s.clockPaused);
    check('saved volume on the bus, the bus not started', s.bus.volume === 0.7 && !s.bus.started, JSON.stringify(s.bus));
    check("the starter's bus is AudioBus({ master: 'safe' })", s.bus.mode === 'safe');
    await page.screenshot({ path: path.join(out, 'start-card-1280.png') });

    await page.click('.ui-shell-card.show .ui-shell-btn');
    await sleep(1300);
    s = await page.evaluate(STATE);
    check('click: playing, audio.start() once, onStart once', s.state === 'playing' && s.log.start === 1 && s.log.started === 1, JSON.stringify({ st: s.state, start: s.log.start }));
    check('click: the AudioContext runs', s.bus.started && s.bus.ctx === 'running', JSON.stringify(s.bus));
    check('click: input back on', s.input === true);
    check('click: blur cleared in about a second', s.filter === 'none' && !s.startShown, s.filter);

    await page.keyboard.press('Escape');
    const t1 = (await page.evaluate(STATE)).time; await sleep(400);
    s = await page.evaluate(STATE);
    check('Esc: paused, clock paused, game time still', s.state === 'paused' && s.clockPaused && s.time === t1, `t ${t1} -> ${s.time}`);
    check('Esc: the bus paused, onPause(true), input off', s.bus.paused === true && s.log.pauses.at(-1) === true && s.input === false);
    check('pause card shown, Resume focused', s.pauseShown && s.focus === 'resume');
    await page.evaluate(() => { const i = document.querySelector('#ui-shell-volume'); i.value = '0.35'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    s = await page.evaluate(STATE);
    check('slider: setting and bus volume follow', s.volume === 0.35 && s.bus.volume === 0.35);
    await page.click('#ui-shell-assist');
    check('toggle flips its setting', await page.evaluate(() => window.__shell.settings.get('assist') === true));
    await sleep(300);
    await page.screenshot({ path: path.join(out, 'pause-card-1280.png') });
    await page.keyboard.press('Escape');
    await sleep(100);
    s = await page.evaluate(STATE);
    check('Esc again: playing, clock running, the bus resumed', s.state === 'playing' && !s.clockPaused && s.bus.paused === false && s.log.pauses.at(-1) === false);
    await page.keyboard.press('KeyP'); await sleep(50);
    const p1 = await page.evaluate(STATE); await page.keyboard.press('KeyP'); await sleep(50);
    check('P toggles pause too', p1.state === 'paused' && (await page.evaluate(STATE)).state === 'playing');

    // ------------------------------------------------------------ 2. reload: saved slider, Enter starts
    await page.reload({ waitUntil: 'load' });
    for (let i = 0; i < 360 && !(await page.evaluate(() => !!(window.__sample && window.__sample.ready))); i++) await sleep(250);
    await page.evaluate(BUILD);
    await sleep(600);
    s = await page.evaluate(STATE);
    const slider = await page.evaluate(() => document.querySelector('#ui-shell-volume').value);
    check('reload: the volume survived', s.volume === 0.35 && slider === '0.35' && s.bus.volume === 0.35, `setting ${s.volume}, slider ${slider}, bus ${s.bus.volume}`);
    check('reload: the toggle survived', await page.evaluate(() => window.__shell.settings.get('assist') === true && document.querySelector('#ui-shell-assist').getAttribute('aria-checked') === 'true'));
    await page.keyboard.down('Space');
    await sleep(150);
    s = await page.evaluate(STATE);
    check('Space starts from the keyboard (and the bus)', s.state === 'playing' && s.log.start === 1 && s.bus.ctx === 'running');
    check('input stays off while the start key is held', s.input === false);
    await page.keyboard.up('Space'); await sleep(150);
    check('input on once the key is released', (await page.evaluate(STATE)).input === true);
    check('desktop: no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 3. ?autostart=1
  {
    const { page, errors } = await open({ width: 1280, height: 720 }, '?autostart=1');
    const r = await page.evaluate(BUILD);
    await sleep(300);
    const s = await page.evaluate(STATE);
    check('?autostart=1: straight to playing, no card', r.state === 'playing' && !s.startShown && s.filter === 'none');
    check('?autostart=1: input on, the bus waits for the first gesture', s.input === true && s.bus.armed && !s.bus.started, JSON.stringify(s.bus));
    check('autostart: no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 4. 375 px, touch
  {
    const { page, errors } = await open({ width: 375, height: 812 }, '', { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.evaluate(BUILD);
    await sleep(700);
    let s = await page.evaluate(STATE);
    check('375: touch sticks hidden behind the card', s.touch === null || s.touch === 'none', String(s.touch));
    check('375: start card inside the screen', s.startShown && s.card.x >= 8 && s.card.right <= s.vw - 8 && s.card.bottom <= 812, JSON.stringify(s.card));
    check('375: no horizontal scroll', s.scrollW <= s.vw, `scrollWidth ${s.scrollW}, viewport ${s.vw}`);
    await page.screenshot({ path: path.join(out, 'start-card-375.png') });
    await page.tap('.ui-shell-card.show .ui-shell-btn');
    await sleep(500);
    s = await page.evaluate(STATE);
    check('375: tap starts, audio.start() called', s.state === 'playing' && s.log.start === 1);
    check('375: touch sticks shown in play', s.touch === null || s.touch !== 'none', String(s.touch));
    check('375: pause button visible on touch', s.pauseBtn);
    await page.tap('.ui-shell-pause');
    await sleep(600);
    s = await page.evaluate(STATE);
    check('375: pause button pauses', s.state === 'paused' && s.clockPaused);
    check('375: pause card inside the screen', s.pcard.x >= 8 && s.pcard.right <= s.vw - 8 && s.pcard.bottom <= 812, JSON.stringify(s.pcard));
    await page.screenshot({ path: path.join(out, 'pause-card-375.png') });
    check('375: no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }
} catch (e) {
  failed++;
  console.log(`FAIL  ${e.stack || e}`);
} finally {
  await browser.close();
  await vite.close();
}
console.log(`\nscreenshots: ${out}`);
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
