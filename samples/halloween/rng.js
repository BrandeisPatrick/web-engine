// Tonight's Patch, the daily seed (DESIGN.md 2.6): one seed a night (YYYYMMDD of the player's local date, or a friend's
// `?seed=<n>` from a shared link) lays out the round's placement: the resting candy and its spots (world.js candySpot,
// candy.js kinds, the pop timer), the porches' relight jitter (porches.js) and the grave hands' cycles (hands.js). Each
// round re-seeds them (reset()), so every round of a night starts the same field and two players on the same night
// (or a friend's link) run the same patch. Three sub-streams of the one seed keep the candy draws (which follow the
// kid's path once play starts) from shifting the porches' or the hands' timing. Ghost AI, sparks, spill arcs and the
// other cosmetic randomness stay on Math.random. No server: the daily best is kept per night in localStorage
// (badges.js). Node-safe (no `location` in the headless suites: the seed is today's).

/** mulberry32: a tiny seeded PRNG (32-bit state), uniform in [0, 1). */
export function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** YYYYMMDD of a Date (local time). */
export const dayNumber = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
/** "NOV 1" for 20261101; null when n is not a plausible date. */
export function dayLabel(n) {
  const y = Math.floor(n / 10000), m = Math.floor(n / 100) % 100, d = n % 100;
  if (y < 2000 || y > 2199 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${MONTHS[m - 1]} ${d}`;
}
/**
 * The night's patch from the page's query (`?seed=<n>`, a positive integer) and today's date: { seed, today (bool:
 * tonight's own patch), label ("NOV 1", or "#1234" for a seed that is not a date), key (the daily best's key) }.
 */
export function patchFor(search = '', now = new Date()) {
  const today = dayNumber(now);
  let seed = today;
  const m = /(?:^|[?&])seed=(\d{1,10})(?:&|$)/.exec(search);
  if (m) { const n = Number(m[1]); if (n > 0 && n < 4294967296) seed = n; }
  const label = dayLabel(seed) || `#${seed}`;
  return { seed, today: seed === today, label, key: String(seed) };
}

/** A seeded stream whose `next` is a stable function (handed to the modules once; reseed() restarts it). */
class Stream {
  constructor(salt) { this.salt = salt; this.s = 0; this.next = () => { this.s = (this.s + 0x6D2B79F5) | 0; let t = this.s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  reseed(seed) { this.s = (Math.imul(seed ^ this.salt, 0x9E3779B1) ^ (seed >>> 16)) | 0; for (let i = 0; i < 4; i++) this.next(); }
}

const _candy = new Stream(0x51ED27), _porch = new Stream(0x2C1B3C6D), _hands = new Stream(0x297A2D39);
export const PATCH = patchFor(typeof location !== 'undefined' ? location.search : '');

/**
 * The placement streams: rng.candy / rng.porch / rng.hands are functions () -> [0, 1) (pass them, not rng); rng.reset()
 * restarts all three from the night's seed (each round, before the field is filled); rng.reset(n) for another seed.
 */
export const rng = {
  candy: _candy.next, porch: _porch.next, hands: _hands.next,
  seed: PATCH.seed,
  reset(seed = PATCH.seed) { this.seed = seed; _candy.reseed(seed); _porch.reseed(seed); _hands.reseed(seed); },
};
rng.reset();
