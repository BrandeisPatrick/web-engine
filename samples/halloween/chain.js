// Stomp chains (DESIGN.md 2.5): a stomp bounces the kid up (the game sets v.y 6.4: 1.3 s in the air, ~7.8 m of reach);
// landing a stomp on another jack-o'-lantern within WINDOW s of the last one continues the chain, and each link pays
// more: PAY[0] for a lone stomp, then PAY[1], PAY[2], capped there ("CHAIN x2!", "CHAIN x3!", ...). The patch's
// lanterns stand in triangles 2.5..3 m apart for it. Game time, so a hitstop does not break a chain.
export const CHAIN = { WINDOW: 1.6, PAY: [7, 10, 13] };

export class StompChain {
  constructor() { this.reset(); }
  /** A new round: no chain; the round's best and count back to 0. */
  reset() { this.n = 0; this.last = -99; this.best = 0; this.chains = 0; this.paid = 0; }
  /** A stomp at game time t: returns the candy it spills (this.n = the chain's length now: 1 = a lone stomp). */
  stomp(t) {
    this.n = t - this.last <= CHAIN.WINDOW ? this.n + 1 : 1;
    this.last = t;
    if (this.n === 2) this.chains++; // a chain (two or more stomps in a row) counted once
    if (this.n > this.best) this.best = this.n;
    const pay = CHAIN.PAY[Math.min(this.n, CHAIN.PAY.length) - 1];
    this.paid += pay;
    return pay;
  }
}
