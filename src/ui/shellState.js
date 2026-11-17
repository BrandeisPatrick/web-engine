// The GameShell's state machine, without any DOM (Node-testable). GameShell drives it; a game reads `shell.state`.
//
//   loading --ready--> title --start--> playing <--pause / resume--> paused
//   loading --ready (card skipped: ?autostart=1, ?bench=1)--> playing
//
//   const s = new ShellState();
//   const off = s.on((to, from, reason) => { ... });
//   s.go('title'); s.go('playing', 'click'); s.can('paused');   // go() returns false for a move the graph forbids
//   skipStartCard('?autostart=1')   // true: the shell goes straight from loading to playing

/** @typedef {'loading' | 'title' | 'playing' | 'paused'} ShellStateName */

/** @type {ReadonlyArray<ShellStateName>} */
export const SHELL_STATES = Object.freeze(['loading', 'title', 'playing', 'paused']);

/** @type {Readonly<Record<ShellStateName, ReadonlyArray<ShellStateName>>>} allowed moves from each state */
const MOVES = Object.freeze({
  loading: ['title', 'playing'],
  title: ['playing'],
  playing: ['paused'],
  paused: ['playing'],
});

export class ShellState {
  constructor() {
    /** @type {ShellStateName} */
    this.state = 'loading';
    /** True once 'playing' has been entered (the start happened). */
    this.started = false;
    /** @type {Set<(to: ShellStateName, from: ShellStateName, reason: string) => void>} */
    this._subs = new Set();
  }

  /**
   * Whether `to` can be entered from the current state.
   * @param {ShellStateName} to
   */
  can(to) { return MOVES[this.state].includes(to); }

  /**
   * Move to `to` when allowed and notify listeners. Returns false (and changes nothing) otherwise.
   * @param {ShellStateName} to
   * @param {string} [reason]  passed to listeners ('click', 'key', 'pad', 'hidden', 'pointerlock', 'api', ...)
   * @returns {boolean}
   */
  go(to, reason = 'api') {
    if (!this.can(to)) return false;
    const from = this.state;
    this.state = to;
    if (to === 'playing') this.started = true;
    for (const fn of [...this._subs]) fn(to, from, reason);
    return true;
  }

  /**
   * Listen to every move; returns a function that removes the listener.
   * @param {(to: ShellStateName, from: ShellStateName, reason: string) => void} fn
   * @returns {() => void}
   */
  on(fn) { this._subs.add(fn); return () => { this._subs.delete(fn); }; }
}

/**
 * True when the URL asks to skip the start card: `?autostart=1` (headless tests) or `?bench=1` (the perf bench).
 * A value of 0 does not count.
 * @param {string} [search]  location.search (default: the current page's, '' without a window)
 * @returns {boolean}
 */
export function skipStartCard(search) {
  const s = search ?? (typeof location !== 'undefined' ? location.search : '');
  const p = new URLSearchParams(s);
  const on = (k) => p.has(k) && p.get(k) !== '0' && p.get(k) !== 'false';
  return on('autostart') || on('bench');
}

/**
 * True when the URL runs the perf bench (`?bench=1`): the shell then never pauses by itself.
 * @param {string} [search]
 * @returns {boolean}
 */
export function isBenchRun(search) {
  const s = search ?? (typeof location !== 'undefined' ? location.search : '');
  const p = new URLSearchParams(s);
  return p.has('bench') && p.get('bench') !== '0';
}
