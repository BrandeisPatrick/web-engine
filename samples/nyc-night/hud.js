// Night NYC drive HUD from the engine UI kit, kept minimal: the street you are on and a compass with fps (top left),
// the speed (bottom left), Flash messages (centre), the map credit (bottom right), and the car choice, a row of cards
// in the GameShell's start card and its pause card (the choice is a shell setting, so it is saved).
import { UILayer, Panel, Flash, Readout, setTheme, injectStyle, UIDom } from '@vibe/engine/ui';

export const ACCENT = '#ffb347';
const CSS = `
.ny-street{padding:8px 12px 7px;min-width:0;opacity:.82}
.ny-street .name{font-size:13px;font-weight:600;letter-spacing:.05em;color:#eee;white-space:nowrap}
.ny-street .cross{margin-top:2px;font-size:9px;letter-spacing:.18em;color:var(--ui-dim);text-transform:uppercase;white-space:nowrap}
.ny-street .row{display:flex;align-items:center;gap:8px;margin-top:5px;font-size:9px;letter-spacing:.16em;color:var(--ui-dim)}
.ny-compass{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;
  border:1px solid rgba(255,255,255,.25);position:relative;font-size:10px;color:#fff}
.ny-compass i{position:absolute;left:50%;top:2px;width:2px;height:7px;margin-left:-1px;background:${ACCENT};border-radius:1px;transform-origin:50% 8px}
.ny-credit{padding:4px 9px;font-size:9px;letter-spacing:.08em;color:var(--ui-dim);opacity:.7}
.ny-cars{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0 0;text-align:left}
.ny-car{padding:10px 10px 9px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);
  color:var(--ui-text);font:inherit;cursor:pointer;text-align:left;display:flex;flex-direction:column;justify-content:flex-start}
.ny-car b{display:block;font-size:13px;font-weight:600;letter-spacing:.03em;color:#fff}
.ny-car span{display:block;margin-top:4px;font-size:11px;line-height:1.35;font-weight:300;color:var(--ui-mute)}
.ny-car[aria-checked="true"]{border-color:rgba(var(--ui-accent-rgb),.95);background:rgba(var(--ui-accent-rgb),.2)}
.ui-shell-rows .ny-cars{margin:4px 0 12px}
body.ny-touch .ny-credit{display:none}
@media (max-width:760px){.ny-street{padding:9px 12px 8px}.ny-street .name{font-size:14px}}
`;
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** The engine theme in this demo's colours (before the GameShell, so its loading screen and cards use them). */
export const applyTheme = () => setTheme({ accent: ACCENT, ok: '#7be08c', warn: '#ffb057' });

export class HUD {
  constructor() {
    injectStyle('nyc-hud', CSS);
    const { el } = UIDom;
    const L = this.layer = new UILayer({ parent: document.body });
    const sp = new Panel({ parent: L, corner: 'tl', className: 'ny-street' });
    this.name = el('div', 'name', sp.el, '7th Avenue');
    this.cross = el('div', 'cross', sp.el, 'Midtown Manhattan');
    const row = el('div', 'row', sp.el);
    const comp = el('span', 'ny-compass', row);
    this.needle = el('i', '', comp);
    this.dir = el('span', '', row, 'N');
    this.fps = el('span', 'ui-num', row, '');
    this.speed = new Panel({ parent: L, corner: 'bl' }).add(new Readout({ label: 'SPEED', value: '0', unit: 'km/h' }));
    new Panel({ parent: L, corner: 'br', className: 'ny-credit' }).el.textContent = 'Map © OpenStreetMap contributors · signs invented';
    this.flash = new Flash({ parent: L });
    this._t = 1; this._street = ''; this._cross = '';
  }

  /**
   * The car cards in the shell's start card (above Play) and at the top of its pause card, bound to the saved
   * setting `car`: a click sets it, and both rows follow it.
   * @param {import('@vibe/engine/ui').GameShell} shell
   * @param {Array<{ id: string, name: string, blurb: string }>} cars
   */
  carChoice(shell, cars) {
    const { el } = UIDom;
    for (const [parent, before] of [[shell.startCard, shell.startButton], [shell.rows, shell.rows.firstChild]]) {
      const box = el('div', 'ny-cars');
      box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', 'Car');
      for (const c of cars) {
        const b = el('button', 'ny-car', box);
        b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.car = c.id;
        el('b', '', b, c.name); el('span', '', b, c.blurb);
        b.addEventListener('click', () => shell.settings.set('car', c.id));
      }
      parent.insertBefore(box, before);
      shell.settings.on('car', (id) => { for (const b of box.children) b.setAttribute('aria-checked', String(b.dataset.car === id)); });
    }
  }

  setTouch(on) { document.body.classList.toggle('ny-touch', !!on); }

  /** heading: the car's yaw (rad, 0 = north / -Z, + = left / west); kmh; street / cross: names; fps */
  update(dt, heading, kmh, street, cross, fps) {
    this._t += dt;
    const deg = ((-heading * 180) / Math.PI + 360) % 360; // compass bearing, clockwise from north
    this.needle.style.transform = `rotate(${-deg}deg)`;
    this.speed.set(String(Math.round(kmh)));
    if (this._t < 0.25) return;
    this._t = 0;
    this.dir.textContent = DIRS[Math.round(deg / 45) % 8];
    if (street !== this._street) { this._street = street; this.name.textContent = street || 'Midtown'; }
    if (cross !== this._cross) { this._cross = cross; this.cross.textContent = cross ? `at ${cross}` : 'Midtown Manhattan'; }
    this.fps.textContent = fps ? `${Math.round(fps)} fps` : '';
  }
}
