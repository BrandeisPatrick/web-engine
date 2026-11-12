// HUD for the drive, on the engine's UI kit (UILayer, Panel, Gauge, Readout, Minimap, Flash, HelpOverlay): an
// original "dusk dashboard" look: a round minimap bottom-left with a heading bezel and the street name under it, a
// tachometer arc bottom-right (cyan -> magenta -> red at the limiter) around a large speed readout and the gear,
// a small clock / odometer readout top-right beside the quality gear, flash messages, the help card, a rotate-
// your-phone hint in portrait on touch devices.
import { UILayer, Panel, Gauge, Readout, Minimap, Flash, HelpOverlay, setTheme, injectStyle, UIDom } from '@vibe/engine/ui';
import { GEARBOX } from './spec.js';

export const ACCENT = '#ff3d8b';
export function applyTheme() { setTheme({ accent: ACCENT, regen: '#38e1ff', font: '"Avenir Next","Futura","Inter",-apple-system,system-ui,sans-serif' }); }

const CSS = `
.mi-map.ui-glass{width:236px;height:236px;border-radius:50%;padding:8px;position:relative}
.mi-map .ui-minimap canvas{border-radius:50% !important;box-shadow:inset 0 0 30px rgba(0,0,0,.8)}
.mi-map .ui-minimap-foot{display:none}
.mi-bezel{position:absolute;inset:0;border-radius:50%;pointer-events:none;
  background:conic-gradient(from 0deg,rgba(255,61,139,.0),rgba(255,61,139,.55) 6%,rgba(56,225,255,.0) 12%,rgba(56,225,255,0) 88%,rgba(56,225,255,.55) 94%,rgba(255,61,139,0));
  -webkit-mask:radial-gradient(circle,transparent 66%,#000 67%,#000 69%,transparent 70%);mask:radial-gradient(circle,transparent 66%,#000 67%,#000 69%,transparent 70%)}
.mi-north{position:absolute;left:50%;top:2px;transform:translateX(-50%);font:600 11px var(--ui-font);color:#fff;letter-spacing:.1em;
  text-shadow:0 0 8px #ff3d8b}
.mi-street{margin-top:10px;text-align:center;font:500 13px var(--ui-font);letter-spacing:.24em;text-transform:uppercase;color:#fff;
  text-shadow:0 0 8px rgba(255,61,139,.4),0 1px 2px rgba(0,0,0,.8);white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.mi-street small{display:block;margin-top:3px;font-size:9px;letter-spacing:.3em;color:rgba(255,255,255,.55);text-shadow:none}
.mi-speedo.ui-glass{width:252px;height:226px;padding:0;position:relative;border-radius:28px}
.mi-speedo .ui-rv.xl{font-size:74px;font-weight:200;color:rgba(255,255,255,.88);text-shadow:0 0 10px rgba(56,225,255,.2)}
.mi-gear{position:absolute;right:26px;bottom:20px;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;
  font:600 22px var(--ui-font);color:#fff;border:1.5px solid rgba(255,61,139,.85);box-shadow:0 0 6px rgba(255,61,139,.25),inset 0 0 6px rgba(255,61,139,.15)}
.mi-unit{position:absolute;left:28px;bottom:30px;font:500 11px var(--ui-font);letter-spacing:.3em;color:rgba(255,255,255,.65)}
.mi-rpm{position:absolute;left:0;right:0;top:136px;text-align:center;font:500 10px var(--ui-font);letter-spacing:.3em;color:rgba(255,255,255,.5)}
.mi-clock{position:fixed;top:max(18px,env(safe-area-inset-top));right:calc(max(14px,env(safe-area-inset-right)) + 58px);padding:9px 16px;
  border-radius:14px;display:flex;gap:16px;align-items:baseline;transform-origin:100% 0;transform:scale(var(--ui-scale))}
.mi-clock b{font:300 22px var(--ui-font);color:#fff;font-variant-numeric:tabular-nums}
.mi-clock span{font:500 10px var(--ui-font);letter-spacing:.22em;color:rgba(255,255,255,.55);text-transform:uppercase}
.mi-title{position:absolute;left:var(--ui-gutter);top:var(--ui-gutter);transform-origin:0 0;transform:scale(var(--ui-scale));
  font:600 15px var(--ui-font);letter-spacing:.42em;color:#fff;text-shadow:0 0 14px rgba(255,61,139,.9),0 0 30px rgba(56,225,255,.4)}
.mi-title small{display:block;margin-top:4px;font-weight:500;font-size:9px;letter-spacing:.32em;color:rgba(255,255,255,.6);text-shadow:none}
.mi-rotate{position:fixed;inset:0;z-index:60;display:none;place-items:center;background:rgba(6,6,14,.82);color:#fff;
  font:500 15px var(--ui-font);letter-spacing:.2em;text-align:center;padding:30px}
.mi-rotate svg{width:72px;height:72px;margin-bottom:18px;animation:miRot 2.4s ease-in-out infinite}
@keyframes miRot{0%,20%{transform:rotate(0)}50%,70%{transform:rotate(-90deg)}100%{transform:rotate(0)}}
@media (orientation:portrait){.mi-touch .mi-rotate{display:grid}}
/* quiet, small instruments (the reference's HUD is a small corner map and a few numbers): ~9-10 % of the frame width */
.ui-corner.mi-map-wrap{transform:scale(calc(var(--ui-scale) * 0.62))}
.ui-corner.mi-speedo-wrap{transform:scale(calc(var(--ui-scale) * 0.56))}
.mi-touch .mi-title,.mi-touch .mi-clock{display:none}
.mi-touch .ui-corner.mi-speedo-wrap{top:max(10px,env(safe-area-inset-top));bottom:auto;right:calc(max(10px,env(safe-area-inset-right)) + 54px);transform-origin:100% 0;transform:scale(calc(var(--ui-scale) * 0.5))}
.mi-touch .ui-corner.mi-map-wrap{top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left));transform-origin:0 0;transform:scale(calc(var(--ui-scale) * 0.52))}
@media (max-height:500px){.mi-title{display:none}}
.mi-osm{position:fixed;left:50%;bottom:max(4px,env(safe-area-inset-bottom));transform:translateX(-50%);font:400 9px var(--ui-font);color:rgba(255,255,255,.45);letter-spacing:.04em;pointer-events:none}
`;

export class HUD {
  constructor({ world, touch }) {
    injectStyle('miami-hud', CSS);
    const layer = this.layer = new UILayer({ parent: document.body, autoScale: touch ? { refW: 1200, refH: 760, minW: 640, min: 0.5, max: 1.1 } : undefined });
    if (touch) document.body.classList.add('mi-touch');
    const { el } = UIDom;
    this.title = el('div', 'mi-title', layer.el);
    this.title.innerHTML = 'NEON COAST<small>MIAMI BEACH · DUSK RUN</small>';
    // minimap (bottom-left; on phones top-left so the thumbs keep the bottom corners)
    const mapPanel = this.mapPanel = new Panel({ parent: layer, corner: touch ? 'tl' : 'bl', className: 'mi-map-wrap', glass: false });
    const mapBox = el('div', 'mi-map ui-glass', mapPanel.el);
    this.map = new Minimap({ parent: mapBox, size: 220, background: '#0b0d18', strokes: [[18, 'rgba(255,61,139,.18)'], [9, 'rgba(120,140,190,.55)'], [4, 'rgba(225,235,255,.9)']], foot: false });
    el('div', 'mi-bezel', mapBox);
    this.street = el('div', 'mi-street', mapPanel.el);
    this.street.innerHTML = '&nbsp;';
    layer.onScale((s) => this.map.setScale(s));
    const md = world.getMinimapData && world.getMinimapData();
    if (md) this.map.setData(md);
    // speedometer (bottom-right)
    const sp = new Panel({ parent: layer, corner: 'br', className: 'mi-speedo-wrap', glass: false });
    const box = el('div', 'mi-speedo ui-glass', sp.el);
    this.gauge = new Gauge({ parent: box, width: 252, height: 226, cx: 126, cy: 118, radius: 92, sweep: 250, thickness: 6, ticks: 16, majorEvery: 2, centerTop: 70, color: '#38e1ff', glow: 'drop-shadow(0 0 4px rgba(56,225,255,.35))' });
    this.speed = new Readout({ parent: this.gauge.center, size: 'xl', value: '0' });
    this.rpmLabel = el('div', 'mi-rpm', box, 'RPM x1000');
    this.unit = el('div', 'mi-unit', box, 'KM/H');
    this.gear = el('div', 'mi-gear', box, 'N');
    // clock / odometer (top-right, left of the settings gear)
    this.clock = el('div', 'mi-clock ui-glass', layer.el);
    this.clockT = el('b', '', this.clock, '20:24'); el('span', '', this.clock, 'Ocean Dr');
    this.odo = el('b', '', this.clock, '0.0'); el('span', '', this.clock, 'km');
    this.clock.children[1].textContent = 'MIAMI';
    this.flash = new Flash({ parent: layer });
    this.help = new HelpOverlay({
      parent: layer, title: 'NEON COAST <b>·</b> CONTROLS', subtitle: 'Miami Beach at dusk',
      rows: touch
        ? [['Left stick', 'Steer'], ['GAS / BRK', 'Throttle / brake, reverse when stopped'], ['HB', 'Handbrake'], ['CAM / RST', 'Camera / back on the road'], ['⚙', 'Graphics quality']]
        : [['W / ↑', 'Throttle'], ['S / ↓', 'Brake, reverse when stopped'], ['A D / ← →', 'Steer'], ['Space', 'Handbrake'], ['B', 'Look back'],
          ['C', 'Change camera'], ['R', 'Back on the road'], ['M', 'Mute'], ['1 - 4', 'Dusk / night / golden / noon'], ['H', 'This card'], ['F3', 'Profiler']],
      footnote: 'Gamepad: RT / LT throttle and brake (analog), left stick steer, B handbrake, Y camera, X reset, ↓ look back. Rumble on impacts. Knock the cones, bins and café chairs around; the beach has a ramp.',
      hint: touch ? 'TAP <kbd>?</kbd> TO CLOSE' : 'PRESS <kbd>H</kbd> TO HIDE',
    });
    el('div', 'mi-osm', layer.el, 'Map data © OpenStreetMap contributors');
    this.rotate = el('div', 'mi-rotate', document.body);
    this.rotate.innerHTML = '<div><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.4"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg><div>ROTATE YOUR PHONE</div><div style="opacity:.6;font-size:12px;margin-top:8px;letter-spacing:.1em">Neon Coast plays in landscape</div></div>';
    this._streetT = 0; this._odo = 0; this._lastStreet = '';
  }

  toggleHelp() { return this.help.toggle(); }

  /** car: HeroCar, streetName: string | null, hours: time of day */
  update(dt, car, streetName, hours) {
    const vc = car.vc, kmh = vc.speed * 3.6;
    this._odo += vc.speed * dt;
    if (this.speed.tickText(dt)) {
      this.speed.set(String(Math.round(Math.abs(vc.forwardSpeed) * 3.6)));
      const g = car.gear < 0 ? 'R' : kmh < 1 && car.controls.throttle < 0.05 ? 'N' : String(car.gear);
      if (g !== this.gear.textContent) this.gear.textContent = g;
      const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
      this.clockT.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      this.odo.textContent = (this._odo / 1000).toFixed(1);
    }
    const r = (car.rpm - GEARBOX.idle) / (GEARBOX.redline - GEARBOX.idle);
    this.gauge.setValue(r);
    this.gauge.setColor(r > 0.9 ? '#ff2a3d' : r > 0.66 ? '#ff3d8b' : '#38e1ff', r > 0.66 ? 'drop-shadow(0 0 5px rgba(255,61,139,.45))' : 'drop-shadow(0 0 4px rgba(56,225,255,.35))');
    // minimap: heading-up, zoom out with speed
    const p = car.object3d.position;
    this.map.update(dt, p.x, p.z, car.headingDeg, 240 + Math.min(1, kmh / 160) * 260, ACCENT);
    this._streetT -= dt;
    if (this._streetT <= 0) {
      this._streetT = 0.4;
      const s = streetName || '';
      if (s !== this._lastStreet) { this._lastStreet = s; this.street.innerHTML = s ? `${s}<small>MIAMI BEACH</small>` : '&nbsp;'; }
    }
  }
}
