// Badges and the night's best (DESIGN.md 2.6): replay hooks shown on the results only. A round earns a badge by its
// stats; the lifetime count of each is kept on the device (localStorage KEY: { id: rounds earned }), and a badge earned
// for the first time is NEW (the results show at most SHOW_NEW of them, each an icon and its name). Locked badges are
// listed greyed, and one of them shows its four-word hint: the one place the game uses text to tease a rule. The
// night's best (Tonight's Patch, rng.js) is kept per seed (DAILY + key). Every storage access is guarded (private
// mode, blocked storage: nothing is kept, nothing breaks).
export const KEY = 'midnight-candy-run.badges', DAILY = 'midnight-candy-run.daily.';
export const SHOW_NEW = 3;
/** [id, name, four-word hint, earned(stats)]; stats: { full, tricks, caught, chain, tags, secrets (mask), potions (mask) } */
export const BADGES = [
  ['full', 'FULL ROUND', 'ALL FIVE COTTAGE PORCHES', (s) => !!s.full],
  ['trickster', 'TRICKSTER', 'BOO THREE LIT DOORMATS', (s) => s.tricks >= 3],
  ['untouchable', 'UNTOUCHABLE', 'NEVER CAUGHT ALL NIGHT', (s) => s.caught === 0],
  ['chainking', 'CHAIN KING', 'THREE STOMPS, NO LANDING', (s) => s.chain >= 3],
  ['tagger', 'TAGGER', 'TAG THE THIEF TWICE', (s) => s.tags >= 2],
  ['explorer', 'EXPLORER', 'WELL, CRYPT AND OAK', (s) => (s.secrets & 7) === 7],
  ['potions', 'POTION MASTER', 'DRINK ALL THREE BREWS', (s) => (s.potions & 7) === 7],
];

const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const read = (k) => { try { const s = store(); return s ? s.getItem(k) : null; } catch { return null; } };
const write = (k, v) => { try { const s = store(); if (s) s.setItem(k, v); } catch { /* private mode / blocked storage */ } };

/** The ids a round's stats earn, in BADGES order. */
export const earnedBy = (stats) => BADGES.filter((b) => b[3](stats)).map((b) => b[0]);

export class BadgeBook {
  constructor() { this.counts = {}; this.load(); }
  load() {
    this.counts = {};
    try { const o = JSON.parse(read(KEY)); if (o && typeof o === 'object') for (const [id] of BADGES) if (Number.isFinite(o[id]) && o[id] > 0) this.counts[id] = Math.floor(o[id]); } catch { /* none yet */ }
    return this;
  }
  /** Earned in some round on this device. */
  has(id) { return (this.counts[id] || 0) > 0; }
  /**
   * A round's end: count the badges its stats earn and keep them. Returns { earned (ids this round), fresh (ids earned
   * for the first time), shown (the fresh ones the results show: at most SHOW_NEW), list ([{ id, name, hint, on (ever),
   * fresh, now (this round) }] in BADGES order), hint (a locked badge's hint, or '') }.
   */
  record(stats, round = 0) {
    const earned = earnedBy(stats), fresh = earned.filter((id) => !this.has(id));
    for (const id of earned) this.counts[id] = (this.counts[id] || 0) + 1;
    write(KEY, JSON.stringify(this.counts));
    const shown = fresh.slice(0, SHOW_NEW);
    const list = BADGES.map(([id, name, hint]) => ({ id, name, hint, on: this.has(id), fresh: shown.includes(id), now: earned.includes(id) }));
    const locked = list.filter((b) => !b.on);
    return { earned, fresh, shown, list, hint: locked.length ? locked[round % locked.length].hint : '' };
  }
}

/** The best candy of the night `key` (rng.js PATCH.key), 0 when none. */
export const dailyBest = (key) => Math.max(0, parseInt(read(DAILY + key), 10) || 0);
/** A round's candy on the night `key`: kept if it beats the night's best. Returns { best, isBest }. */
export function saveDaily(key, n) {
  const was = dailyBest(key), isBest = n > was;
  if (isBest) write(DAILY + key, String(n));
  return { best: Math.max(was, n), isBest };
}
