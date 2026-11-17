// VoicePool: which one-shot voices may sound at once. Pure bookkeeping (no Web Audio), so it is tested in Node.
//
//   const pool = new VoicePool({ max: 24 });
//   const d = pool.admit('step.wood', 5, 4);   // -> { steal: null } (a free slot), { steal: voice } or null (refused)
//   if (d) { if (d.steal) { d.steal.stop(0.004); pool.remove(d.steal); } pool.add(voice); }
//   pool.remove(voice);                        // when it ends
//
// Policy, in order (Saltline's): when the sound already has `cap` voices, steal its oldest; else a free slot; else the
// lowest-priority voice (the oldest among equals), but only if its priority is not higher than the new sound's;
// otherwise the new sound is refused. A voice is any object the pool tags with { name, priority, seq }.

/**
 * @typedef {object} PooledVoice
 * @property {string} [name]
 * @property {number} [priority]
 * @property {number} [seq]  admission order (older = smaller)
 */

export class VoicePool {
  /**
   * @param {object} [o]
   * @param {number} [o.max=24]  voices at once
   */
  constructor({ max = 24 } = {}) {
    this.max = max;
    /** @type {PooledVoice[]} */
    this.voices = [];
    this._seq = 0;
  }

  get size() { return this.voices.length; }

  /** How many voices of `name` are sounding. */
  count(name) { let n = 0; for (const v of this.voices) if (v.name === name) n++; return n; }

  /**
   * Decide whether a new voice of `name` may start.
   * @param {string} name
   * @param {number} [priority=5]  1..10
   * @param {number} [cap=Infinity]  most voices of this name
   * @returns {{ steal: PooledVoice|null }|null}  null: refused
   */
  admit(name, priority = 5, cap = Infinity) {
    let oldestSame = null, same = 0;
    for (const v of this.voices) if (v.name === name) { same++; if (!oldestSame || v.seq < oldestSame.seq) oldestSame = v; }
    if (same >= cap && oldestSame) return { steal: oldestSame };
    if (this.voices.length < this.max) return { steal: null };
    let low = null;
    for (const v of this.voices) if (!low || v.priority < low.priority || (v.priority === low.priority && v.seq < low.seq)) low = v;
    if (low && low.priority <= priority) return { steal: low };
    return null;
  }

  /**
   * Register a started voice (tags it with name, priority and its admission order).
   * @template {PooledVoice} T
   * @param {T} voice
   * @param {string} name
   * @param {number} [priority=5]
   * @returns {T}
   */
  add(voice, name, priority = 5) {
    voice.name = name; voice.priority = priority; voice.seq = ++this._seq;
    this.voices.push(voice);
    return voice;
  }

  /** Forget a voice (ended or stolen). Returns true when it was in the pool. */
  remove(voice) {
    const i = this.voices.indexOf(voice);
    if (i < 0) return false;
    this.voices.splice(i, 1);
    return true;
  }

  clear() { this.voices.length = 0; }
}
