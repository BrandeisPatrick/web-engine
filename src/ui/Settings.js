// Settings: a small saved key / value store for a game's player settings (volume, toggles, sliders). Pure JS, safe in
// Node (no storage there: it works in memory).
//
//   const settings = createSettings('my-game.settings', { volume: 0.7, assist: true }, { version: 1 });
//   settings.get('volume');                       // 0.7, or the saved value
//   settings.set('volume', 0.4);                  // saved at once; listeners run when the value changed
//   const off = settings.on('volume', (v) => bus.setVolume(v));   // runs NOW with the current value, then on change
//   settings.define('fov', 70, { min: 50, max: 100 });            // add a key later (GameShell.addSlider does this)
//   settings.all(); settings.reset();
//
// Stored as JSON `{ "v": version, "values": { ... } }` under `key` in localStorage. What is loaded is checked against
// the defaults: unknown keys are dropped, a value whose type differs from its default's is ignored (the default stays),
// numbers are clamped to their range. Corrupt JSON, a missing or different `version`, or storage that throws (private
// mode, blocked site data) all give the defaults; nothing throws. Bump `version` when a saved value would be wrong for
// a new build (the old record is then ignored and overwritten on the next set()).

/** @typedef {number | boolean | string} SettingValue */

/**
 * @typedef {object} SettingsStorage  the part of the Web Storage API the store uses (localStorage, or a fake in tests)
 * @property {(key: string) => string | null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} [removeItem]
 */

/**
 * @typedef {object} SettingsOptions
 * @property {number} [version=1]  records saved with another version are ignored
 * @property {SettingsStorage | null} [storage]  default: window.localStorage when reachable, else none (memory only)
 * @property {Record<string, { min?: number, max?: number }>} [ranges]  clamp ranges for number settings
 */

/**
 * @typedef {object} Settings
 * @property {string} key  the storage key
 * @property {number} version
 * @property {(k: string) => SettingValue | undefined} get  the current value (undefined for an unknown key)
 * @property {(k: string, v: SettingValue) => SettingValue | undefined} set  validate, store and save; returns the
 *   value kept (a wrong type keeps the old value; an unknown key is ignored and returns undefined)
 * @property {(k: string, fn: (value: SettingValue, key: string) => void) => () => void} on  call fn now with the
 *   current value and after every change; returns a function that removes it
 * @property {(k: string, def: SettingValue, range?: { min?: number, max?: number }) => Settings} define  add a key
 *   with its default (a saved value of the right type is picked up); an existing key only gets the range
 * @property {() => Record<string, SettingValue>} all  a copy of every value
 * @property {() => void} reset  every key back to its default (saved; listeners run for those that changed)
 */

function defaultStorage() {
  try { return typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

const clampNum = (v, r) => (r ? Math.min(r.max ?? Infinity, Math.max(r.min ?? -Infinity, v)) : v);

/**
 * Create a saved settings store (see the file header).
 * @param {string} key  storage key, e.g. 'my-game.settings'
 * @param {Record<string, SettingValue>} [defaults]
 * @param {SettingsOptions} [o]
 * @returns {Settings}
 */
export function createSettings(key, defaults = {}, o = {}) {
  const version = o.version ?? 1;
  const storage = o.storage !== undefined ? o.storage : defaultStorage();
  /** @type {Record<string, SettingValue>} */ const defs = { ...defaults };
  /** @type {Record<string, { min?: number, max?: number }>} */ const ranges = { ...(o.ranges || {}) };
  /** @type {Map<string, Set<Function>>} */ const subs = new Map();

  // the saved record, read once (values of keys defined later are picked up by define())
  let saved = {};
  try {
    const raw = storage ? storage.getItem(key) : null;
    if (raw) {
      const rec = JSON.parse(raw);
      if (rec && typeof rec === 'object' && rec.v === version && rec.values && typeof rec.values === 'object') saved = rec.values;
    }
  } catch { saved = {}; }

  /** A value checked against key k's default and range, or undefined when it does not fit. */
  const valid = (k, v) => {
    const d = defs[k];
    if (d === undefined || typeof v !== typeof d) return undefined;
    if (typeof v === 'number') return Number.isFinite(v) ? clampNum(v, ranges[k]) : undefined;
    return v;
  };

  /** @type {Record<string, SettingValue>} */ const values = {};
  const adopt = (k) => { const s = valid(k, saved[k]); values[k] = s !== undefined ? s : valid(k, defs[k]) ?? defs[k]; };
  for (const k of Object.keys(defs)) adopt(k);

  const save = () => {
    if (!storage) return;
    try { storage.setItem(key, JSON.stringify({ v: version, values })); } catch { /* quota, private mode */ }
  };
  const emit = (k) => { const set = subs.get(k); if (set) for (const fn of [...set]) fn(values[k], k); };

  /** @type {Settings} */
  const api = {
    key, version,
    get: (k) => values[k],
    set(k, v) {
      if (defs[k] === undefined) return undefined;
      const ok = valid(k, v);
      if (ok === undefined) return values[k];
      if (ok !== values[k]) { values[k] = ok; save(); emit(k); }
      return values[k];
    },
    on(k, fn) {
      let set = subs.get(k); if (!set) subs.set(k, (set = new Set()));
      set.add(fn);
      if (values[k] !== undefined) fn(values[k], k);
      return () => { set.delete(fn); };
    },
    define(k, def, range) {
      if (range) ranges[k] = range;
      if (defs[k] === undefined) { defs[k] = def; adopt(k); }
      else if (typeof values[k] === 'number') values[k] = clampNum(values[k], ranges[k]);
      return api;
    },
    all: () => ({ ...values }),
    reset() {
      const changed = [];
      for (const k of Object.keys(defs)) { const d = valid(k, defs[k]) ?? defs[k]; if (values[k] !== d) { values[k] = d; changed.push(k); } }
      save();
      for (const k of changed) emit(k);
    },
  };
  return api;
}
