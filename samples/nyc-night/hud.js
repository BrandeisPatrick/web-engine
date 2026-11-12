// Night-walk HUD from the engine UI kit, kept minimal: the street you are on and a compass (top left), fps, a key
// strip (desktop), a click-to-play prompt, a first-person dot, Flash messages and the HelpOverlay (H / Esc).
import { UILayer, Panel, Flash, HelpOverlay, setTheme, injectStyle, UIDom } from '@vibe/engine/ui';

export const ACCENT = '#ffb347';
const CSS = `
.ny-street{padding:8px 12px 7px;min-width:0;opacity:.82}
.ny-street .name{font-size:13px;font-weight:600;letter-spacing:.05em;color:#eee;white-space:nowrap}
.ny-street .cross{margin-top:2px;font-size:9px;letter-spacing:.18em;color:var(--ui-dim);text-transform:uppercase;white-space:nowrap}
.ny-street .row{display:flex;align-items:center;gap:8px;margin-top:5px;font-size:9px;letter-spacing:.16em;color:var(--ui-dim)}
.ny-compass{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;
  border:1px solid rgba(255,255,255,.25);position:relative;font-size:10px;color:#fff}
.ny-compass i{position:absolute;left:50%;top:2px;width:2px;height:7px;margin-left:-1px;background:${ACCENT};border-radius:1px;transform-origin:50% 8px}
.ny-keys{display:flex;flex-wrap:wrap;gap:4px 12px;padding:7px 10px;max-width:min(620px,calc(100vw - 44px));font-size:9px;letter-spacing:.12em;color:var(--ui-dim);transition:opacity 1.2s}
.ny-keys.faded{opacity:0}
.ny-keys kbd{display:inline-block;margin-right:6px;padding:1px 6px;border:1px solid rgba(255,255,255,.3);border-radius:4px;font-family:inherit;color:#fff;letter-spacing:.04em}
.ny-prompt{position:absolute;left:50%;top:82%;transform:translate(-50%,-50%) scale(var(--ui-scale));padding:7px 16px;font-size:10px;opacity:.8;font-weight:500;
  letter-spacing:.3em;color:#fff;white-space:nowrap;transition:opacity .3s}
.ny-prompt.hidden{opacity:0;pointer-events:none}
.ny-cross{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:rgba(255,255,255,.8);
  box-shadow:0 0 0 1px rgba(0,0,0,.35);opacity:0;transition:opacity .2s}
.ny-cross.on{opacity:1}
.ny-touch .ny-keys,.ny-touch .ny-prompt{display:none}
@media (max-width:760px){.ny-keys{display:none}.ny-street{min-width:0;padding:9px 12px 8px}.ny-street .name{font-size:14px}}
`;
const KEYS = [['WASD', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump'], ['Mouse', 'Look'], ['V', 'Camera'], ['H', 'Help'], ['F3', 'Profiler']];
const HELP_ROWS = [
  ['W A S D / arrows · left stick', 'Walk (camera-relative)'], ['Shift · LB / L3', 'Run'], ['Space · A', 'Jump'],
  ['Mouse (click to lock) · right stick', 'Look'], ['Right-drag', 'Look without the lock'], ['Wheel', 'Zoom (third person)'],
  ['V · Y', 'Camera: third / first person'], ['R', 'Back to the square'], ['H · Esc', 'This help'], ['F3', 'Profiler'],
  ['Touch', 'Left thumb walks, right side looks; RUN, JUMP, CAM'],
];
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class HUD {
  constructor({ tier }) {
    setTheme({ accent: ACCENT, ok: '#7be08c', warn: '#ffb057' });
    injectStyle('nyc-hud', CSS);
    const { el } = UIDom;
    const L = this.layer = new UILayer({ parent: document.body });
    const sp = new Panel({ parent: L, corner: 'tl', className: 'ny-street' });
    this.name = el('div', 'name', sp.el, 'Times Square');
    this.cross = el('div', 'cross', sp.el, 'Midtown Manhattan');
    const row = el('div', 'row', sp.el);
    const comp = el('span', 'ny-compass', row);
    this.needle = el('i', '', comp);
    this.dir = el('span', '', row, 'N');
    this.fps = el('span', 'ui-num', row, '');
    const kp = new Panel({ parent: L, corner: 'bl', className: 'ny-keys' });
    kp.el.innerHTML = KEYS.map(([k, v]) => `<span><kbd>${k}</kbd>${v}</span>`).join('');
    this.keys = kp;
    setTimeout(() => kp.el.classList.add('faded'), 7000); // the key hints fade after a few seconds (H brings the help)
    this.prompt = el('div', 'ny-prompt ui-glass', L.el, 'CLICK TO WALK');
    this.dot = el('div', 'ny-cross', L.el);
    this.flash = new Flash({ parent: L });
    this.help = new HelpOverlay({
      parent: L, title: 'NIGHT WALK <b>·</b> MIDTOWN', subtitle: 'Buildings and light: OpenStreetMap Midtown, after the rain',
      rows: HELP_ROWS,
      footnote: `Quality: <b>${tier}</b> (gear, top right). Street layout and building massing © OpenStreetMap contributors (ODbL). `
        + 'Every sign and brand is invented. Textures: Poly Haven (CC0). People: Quaternius Business Man, Man in Suit and Animated Woman (CC0). Interiors and night reflections: Poly Haven HDRIs (CC0).',
      hint: 'CLICK TO WALK · <kbd>H</kbd> TO HIDE',
    });
    this.locked = false; this.camName = 'third'; this.touch = false;
    this.onHelp = null;
    this._t = 1; this._street = ''; this._cross = '';
  }
  setTouch(on) { this.touch = !!on; document.body.classList.toggle('ny-touch', this.touch); this._sync(); }
  setCamera(name) { this.camName = name; this._sync(); }
  setLocked(on) { this.locked = !!on; this._sync(); }
  showHelp(on) { this.help.show(on); this._sync(); }
  toggleHelp() { this.help.toggle(); this._sync(); }
  _sync() {
    this.prompt.classList.toggle('hidden', this.locked || this.help.visible || this.touch);
    this.dot.classList.toggle('on', this.camName === 'first');
    if (this.onHelp) this.onHelp(this.help.visible);
  }
  /** heading: camera yaw (rad, 0 = north / -Z, + = left / west); street / cross: names; fps */
  update(dt, heading, street, cross, fps) {
    this._t += dt;
    const deg = ((-heading * 180) / Math.PI + 360) % 360; // compass bearing, clockwise from north
    this.needle.style.transform = `rotate(${-deg}deg)`;
    if (this._t < 0.25) return;
    this._t = 0;
    this.dir.textContent = DIRS[Math.round(deg / 45) % 8];
    if (street !== this._street) { this._street = street; this.name.textContent = street || 'Midtown'; }
    if (cross !== this._cross) { this._cross = cross; this.cross.textContent = cross ? `at ${cross}` : 'Midtown Manhattan'; }
    this.fps.textContent = fps ? `${Math.round(fps)} fps` : '';
  }
}
