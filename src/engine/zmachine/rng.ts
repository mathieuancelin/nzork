// Random number generator compatible with Frotz 2.5x (dfrotz -s <seed>), so that our
// transcripts can be compared word for word with the original interpreter.

export interface RngState {
  a: number
  interval: number
  counter: number
}

export class FrotzRandom {
  state: RngState

  /** Like frotz at start-up: the user seed (or the clock) becomes the LCG state. */
  constructor(seed: number) {
    this.state = { a: seed ? seed >>> 0 : (Date.now() & 0x7fff) >>> 0, interval: 0, counter: 0 }
  }

  /** Mirrors frotz `seed_random`: 0 = time based, < 1000 = counting mode, else LCG seed. */
  seed(value: number): void {
    if (value === 0) {
      this.state = { a: (Date.now() & 0x7fff) >>> 0, interval: 0, counter: 0 }
    } else if (value < 1000) {
      this.state = { a: this.state.a, interval: value, counter: 0 }
    } else {
      this.state = { a: value >>> 0, interval: 0, counter: 0 }
    }
  }

  /** Returns a number in 1..range (range > 0). */
  next(range: number): number {
    const s = this.state
    let result: number
    if (s.interval !== 0) {
      if (s.counter++ === s.interval) s.counter = 1
      result = s.counter
    } else {
      // A = 0x015a4e35 * A + 1 on a C long; only bits 16..30 are used.
      s.a = (Math.imul(0x015a4e35, s.a) + 1) >>> 0
      result = (s.a >>> 16) & 0x7fff
    }
    return (result % range) + 1
  }
}
