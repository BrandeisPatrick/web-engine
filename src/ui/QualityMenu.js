// QualityMenu: the settings button (a gear, top right by default) and its panel, where the player picks a quality
// tier. The device's recommended tier carries a "Recommended" tag. Picking another tier stores it and reloads the page
// (a tier changes render targets, shadow maps and world budgets: a reload is the one path that is always right).
//
//   const q = resolveQuality();                                   // core/Quality.js
//   const menu = new QualityMenu({ quality: q, corner: 'tr' });   // onChange(tier) instead of the reload, if given
//   menu.addRow('Sound', toggleEl);                               // a game's own settings under the tiers
import { QUALITY_TIERS, TIER_IDS, storeTier } from '../core/Quality.js';
import { injectTheme, injectStyle } from './theme.js';

const CSS = `
.ui-q-btn{position:fixed;z-index:40;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;cursor:pointer;
  color:var(--ui-text);pointer-events:auto;padding:0;font:inherit}
.ui-q-btn svg{width:22px;height:22px;opacity:.85}
.ui-q-btn:focus-visible,.ui-q-tier:focus-visible{outline:2px solid var(--ui-accent);outline-offset:2px}
.ui-q-tr{top:max(14px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right))}
.ui-q-tl{top:max(14px,env(safe-area-inset-top));left:max(14px,env(safe-area-inset-left))}
.ui-q-br{bottom:max(14px,env(safe-area-inset-bottom));right:max(14px,env(safe-area-inset-right))}
.ui-q-bl{bottom:max(14px,env(safe-area-inset-bottom));left:max(14px,env(safe-area-inset-left))}
.ui-q-panel{position:fixed;z-index:41;width:min(340px,calc(100vw - 28px));padding:18px;pointer-events:auto;
  color:var(--ui-text);font-family:var(--ui-font);font-size:14px;line-height:1.4;display:none}
.ui-q-panel.open{display:block}
.ui-q-panel.ui-q-tr{top:calc(max(14px,env(safe-area-inset-top)) + 54px)}
.ui-q-panel.ui-q-tl{top:calc(max(14px,env(safe-area-inset-top)) + 54px)}
.ui-q-panel.ui-q-br{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 54px)}
.ui-q-panel.ui-q-bl{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 54px)}
.ui-q-title{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ui-dim);font-weight:500;margin:0 0 12px}
.ui-q-tier{display:block;width:100%;text-align:left;padding:12px 14px;margin:0 0 8px;border-radius:12px;cursor:pointer;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:inherit;font:inherit}
.ui-q-tier[aria-checked="true"]{border-color:var(--ui-accent);background:rgba(var(--ui-accent-rgb),.14)}
.ui-q-tier b{font-weight:600;font-size:15px}
.ui-q-tier span{display:block;color:var(--ui-mute);font-size:13px;margin-top:3px}
.ui-q-tag{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:500;
  background:rgba(var(--ui-accent-rgb),.25);color:var(--ui-text);vertical-align:1px}
.ui-q-note{color:var(--ui-dim);font-size:12px;margin:6px 0 0}
.ui-q-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding-top:12px;
  border-top:1px solid rgba(255,255,255,.08)}
`;
const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

export class QualityMenu {
  /**
   * @param {{ quality: { tier: string, recommended: string, storageKey?: string }, corner?: 'tr' | 'tl' | 'br' | 'bl',
   *   parent?: HTMLElement, title?: string, onChange?: (tier: string) => void, onToggle?: (open: boolean) => void }} o
   */
  constructor(o) {
    injectTheme(); injectStyle('ui-quality', CSS);
    this.quality = o.quality; this.onChange = o.onChange || null; this.onToggle = o.onToggle || null;
    const corner = `ui-q-${o.corner || 'tr'}`, parent = o.parent || document.body;
    const btn = this.button = document.createElement('button');
    btn.type = 'button'; btn.className = `ui-q-btn ui-glass ${corner}`; btn.innerHTML = GEAR;
    btn.setAttribute('aria-label', 'Settings'); btn.setAttribute('aria-expanded', 'false');
    const panel = this.panel = document.createElement('div');
    panel.className = `ui-q-panel ui-glass ${corner}`; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Settings');
    const title = document.createElement('p'); title.className = 'ui-q-title'; title.textContent = o.title || 'Graphics quality';
    const group = document.createElement('div'); group.setAttribute('role', 'radiogroup'); group.setAttribute('aria-label', 'Graphics quality');
    panel.append(title, group);
    for (const id of TIER_IDS) {
      const t = QUALITY_TIERS[id], b = document.createElement('button');
      b.type = 'button'; b.className = 'ui-q-tier'; b.setAttribute('role', 'radio'); b.dataset.tier = id;
      b.setAttribute('aria-checked', String(id === this.quality.tier));
      const name = document.createElement('b'); name.textContent = t.label; b.append(name);
      if (id === this.quality.recommended) { const tag = document.createElement('i'); tag.className = 'ui-q-tag'; tag.style.fontStyle = 'normal'; tag.textContent = 'Recommended'; b.append(tag); }
      const blurb = document.createElement('span'); blurb.textContent = t.blurb; b.append(blurb);
      b.addEventListener('click', () => this.choose(id));
      group.append(b);
    }
    const note = document.createElement('p'); note.className = 'ui-q-note'; note.textContent = 'Changing quality reloads the page.';
    panel.append(note);
    btn.addEventListener('click', (e) => { e.stopPropagation(); this.setOpen(!this.open); });
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    this._onDoc = (e) => { if (this.open && !panel.contains(e.target) && e.target !== btn) this.setOpen(false); };
    this._onKey = (e) => { if (e.key === 'Escape' && this.open) { this.setOpen(false); btn.focus(); } };
    document.addEventListener('pointerdown', this._onDoc); document.addEventListener('keydown', this._onKey);
    parent.append(btn, panel);
    this.open = false;
  }

  setOpen(open) {
    this.open = !!open; this.panel.classList.toggle('open', this.open);
    this.button.setAttribute('aria-expanded', String(this.open));
    if (this.onToggle) this.onToggle(this.open);
  }

  /** Store `tier` and apply it: onChange(tier) when given, else reload without any ?quality= override. */
  choose(tier) {
    if (tier === this.quality.tier) { this.setOpen(false); return; }
    storeTier(tier, this.quality.storageKey);
    if (this.onChange) { this.onChange(tier); return; }
    const u = new URL(location.href); u.searchParams.delete('quality'); location.replace(u.toString());
  }

  /** Add a game setting under the tiers: a label and any control element. Returns the row. */
  addRow(label, control) {
    const row = document.createElement('div'); row.className = 'ui-q-row';
    const l = document.createElement('span'); l.textContent = label; row.append(l, control);
    this.panel.insertBefore(row, this.panel.lastElementChild);
    return row;
  }

  dispose() {
    document.removeEventListener('pointerdown', this._onDoc); document.removeEventListener('keydown', this._onKey);
    this.button.remove(); this.panel.remove();
  }
}
