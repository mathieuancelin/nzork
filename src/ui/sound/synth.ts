// Building blocks of the procedural soundtrack (Web Audio): noise, reverb, drones, pulses and
// short sounds. Everything works on a BaseAudioContext, so an ambience can also be rendered
// offline (OfflineAudioContext) to measure its level.
import type { Preset, DroneDef, NoiseDef, EventDef, EventKind, NoiseColor } from './presets'

type Ctx = BaseAudioContext

const rand = (a: number, b: number) => a + Math.random() * (b - a)

// ------------------------------------------------------------------ shared buffers

const buffers = new WeakMap<Ctx, Map<string, AudioBuffer>>()

function cached(ctx: Ctx, key: string, make: () => AudioBuffer): AudioBuffer {
  let byCtx = buffers.get(ctx)
  if (!byCtx) buffers.set(ctx, (byCtx = new Map()))
  let b = byCtx.get(key)
  if (!b) byCtx.set(key, (b = make()))
  return b
}

/** 6 seconds of stereo noise that loops without a click. */
export function noiseBuffer(ctx: Ctx, color: NoiseColor): AudioBuffer {
  return cached(ctx, `noise:${color}`, () => {
    const len = ctx.sampleRate * 6
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        if (color === 'white') d[i] = w * 0.5
        else if (color === 'pink') {
          // Paul Kellet's filter
          b0 = 0.99886 * b0 + w * 0.0555179
          b1 = 0.99332 * b1 + w * 0.0750759
          b2 = 0.969 * b2 + w * 0.153852
          b3 = 0.8665 * b3 + w * 0.3104856
          b4 = 0.55 * b4 + w * 0.5329522
          b5 = -0.7616 * b5 - w * 0.016898
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
          b6 = w * 0.115926
        } else {
          last = (last + 0.02 * w) / 1.02
          d[i] = last * 3.5
        }
      }
      // bend the end onto the start, so the loop point does not click
      const step = d[len - 1] - d[0]
      for (let i = 0; i < len; i++) d[i] -= (step * i) / (len - 1)
    }
    return buf
  })
}

/** Reverb impulse: decaying stereo noise, darker as it fades (damping 0..1). */
export function impulse(ctx: Ctx, seconds: number, damping: number): AudioBuffer {
  return cached(ctx, `ir:${seconds}:${damping}`, () => {
    const len = Math.max(1, Math.round(ctx.sampleRate * seconds))
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      let y = 0
      for (let i = 0; i < len; i++) {
        const t = i / len
        const c = 1 - damping * 0.95 * Math.sqrt(t)
        y += c * (Math.random() * 2 - 1 - y)
        d[i] = y * Math.exp(-6.9 * t)
      }
    }
    return buf
  })
}

// ------------------------------------------------------------------ small helpers

function gain(ctx: Ctx, value: number): GainNode {
  const g = ctx.createGain()
  g.gain.value = value
  return g
}

/** A slow oscillator added to an audio parameter (rate in Hz, depth in the parameter's unit). */
function lfo(ctx: Ctx, target: AudioParam, rate: number, depth: number, sources: AudioScheduledSourceNode[], when: number) {
  const o = ctx.createOscillator()
  o.frequency.value = rate * rand(0.85, 1.15)
  const g = gain(ctx, depth)
  o.connect(g).connect(target)
  o.start(when)
  sources.push(o)
}

/** Envelope: silence, attack to peak, exponential decay to silence. */
function envelope(p: AudioParam, t: number, peak: number, attack: number, decay: number) {
  p.setValueAtTime(0, t)
  p.linearRampToValueAtTime(peak, t + attack)
  p.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

// ------------------------------------------------------------------ continuous layers

function drone(ctx: Ctx, out: AudioNode, d: DroneDef, sources: AudioScheduledSourceNode[], when: number) {
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = d.cutoff
  filter.Q.value = d.q ?? 0.7
  const amp = gain(ctx, 1 - (d.swell ?? 0) / 2)
  const pan = ctx.createStereoPanner()
  filter.connect(amp).connect(pan).connect(out)
  for (const [ratio, g] of d.partials) {
    for (const side of [-1, 1]) {
      const o = ctx.createOscillator()
      o.type = d.wave ?? 'sawtooth'
      o.frequency.value = d.freq * ratio
      o.detune.value = side * (d.detune ?? 6) + rand(-2, 2)
      const pg = gain(ctx, g / 2)
      const p = ctx.createStereoPanner()
      p.pan.value = side * 0.35
      o.connect(pg).connect(p).connect(filter)
      if (d.drift) lfo(ctx, o.detune, rand(0.01, 0.03), d.drift, sources, when)
      o.start(when)
      sources.push(o)
    }
  }
  if (d.sweep) lfo(ctx, filter.frequency, d.sweepRate ?? 0.05, d.sweep, sources, when)
  if (d.swell) lfo(ctx, amp.gain, d.swellRate ?? 0.07, d.swell / 2, sources, when)
  if (d.pan) lfo(ctx, pan.pan, rand(0.02, 0.05), d.pan, sources, when)
}

function noise(ctx: Ctx, out: AudioNode, n: NoiseDef, sources: AudioScheduledSourceNode[], when: number) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, n.color)
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = n.type
  filter.frequency.value = n.freq
  filter.Q.value = n.q ?? 0.7
  const amp = gain(ctx, n.gain * (1 - (n.gust ?? 0) / 2))
  const pan = ctx.createStereoPanner()
  src.connect(filter).connect(amp).connect(pan).connect(out)
  if (n.sweep) lfo(ctx, filter.frequency, n.sweepRate ?? 0.05, n.sweep, sources, when)
  if (n.gust) {
    // two slow oscillators at unrelated rates: gusts that never repeat exactly
    lfo(ctx, amp.gain, n.gustRate ?? 0.08, (n.gain * n.gust) / 4, sources, when)
    lfo(ctx, amp.gain, (n.gustRate ?? 0.08) * 2.37, (n.gain * n.gust) / 4, sources, when)
  }
  if (n.pan) lfo(ctx, pan.pan, rand(0.02, 0.06), n.pan, sources, when)
  src.start(when, rand(0, 5.9))
  sources.push(src)
}

// ------------------------------------------------------------------ short sounds

type Voice = (ctx: Ctx, out: AudioNode, t: number, g: number) => void

function osc(ctx: Ctx, type: OscillatorType, freq: number, t: number, stop: number): OscillatorNode {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.start(t)
  o.stop(stop)
  return o
}

function noiseBurst(ctx: Ctx, color: NoiseColor, t: number, dur: number): AudioBufferSourceNode {
  const s = ctx.createBufferSource()
  s.buffer = noiseBuffer(ctx, color)
  s.start(t, rand(0, 5))
  s.stop(t + dur)
  return s
}

/** Partials with their own decays: bells, metal. */
function partials(ctx: Ctx, out: AudioNode, t: number, g: number, freq: number, ratios: number[], decay: number) {
  ratios.forEach((r, i) => {
    const a = gain(ctx, 0)
    const d = decay / (1 + i * 0.6)
    envelope(a.gain, t, g / (1 + i * 0.8), 0.004, d)
    osc(ctx, 'sine', freq * r, t, t + d + 0.1).connect(a).connect(out)
  })
}

export const VOICES: Record<EventKind, Voice> = {
  // a water drop: a sine that rises quickly
  drip(ctx, out, t, g) {
    const f = rand(900, 1700)
    const o = osc(ctx, 'sine', f, t, t + 0.25)
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.045)
    const a = gain(ctx, 0)
    envelope(a.gain, t, g, 0.003, 0.15)
    o.connect(a).connect(out)
  },
  // wood under stress: a low sawtooth chopped by a fast stick-slip oscillation
  creak(ctx, out, t, g) {
    const dur = rand(0.5, 1.2)
    const f = rand(70, 140)
    const o = osc(ctx, 'sawtooth', f, t, t + dur + 0.1)
    o.frequency.linearRampToValueAtTime(f * rand(0.75, 0.9), t + dur)
    const chop = osc(ctx, 'square', rand(22, 45), t, t + dur + 0.1)
    const a = gain(ctx, 0)
    a.gain.setValueAtTime(0, t)
    a.gain.linearRampToValueAtTime(g, t + 0.08)
    a.gain.setValueAtTime(g, t + dur - 0.15)
    a.gain.linearRampToValueAtTime(0, t + dur)
    const depth = gain(ctx, g * 0.8)
    chop.connect(depth).connect(a.gain)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = rand(600, 1200)
    bp.Q.value = 3
    o.connect(bp).connect(a).connect(out)
  },
  // a distant bell: inharmonic partials, long decay
  bell(ctx, out, t, g) {
    partials(ctx, out, t, g, [196, 220, 261.6, 293.7][Math.floor(rand(0, 4))], [1, 2.76, 5.4, 8.93], 5)
  },
  // whispers: noise through two moving formants
  whisper(ctx, out, t, g) {
    const dur = rand(1.2, 2.2)
    const src = noiseBurst(ctx, 'white', t, dur + 0.1)
    const a = gain(ctx, 0)
    a.gain.setValueAtTime(0, t)
    a.gain.linearRampToValueAtTime(g, t + 0.3)
    a.gain.linearRampToValueAtTime(0, t + dur)
    for (const [f0, f1] of [[rand(500, 900), rand(700, 1300)], [rand(1200, 1800), rand(1600, 2400)]]) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 8
      bp.frequency.setValueAtTime(f0, t)
      bp.frequency.linearRampToValueAtTime(f1, t + dur)
      src.connect(bp).connect(a)
    }
    a.connect(out)
  },
  // something heavy, far away
  rumble(ctx, out, t, g) {
    const dur = rand(3, 5)
    const src = noiseBurst(ctx, 'brown', t, dur + 0.1)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 110
    const a = gain(ctx, 0)
    a.gain.setValueAtTime(0, t)
    a.gain.linearRampToValueAtTime(g, t + dur * 0.35)
    a.gain.linearRampToValueAtTime(0, t + dur)
    src.connect(lp).connect(a).connect(out)
  },
  // pebbles rolling down
  stone(ctx, out, t, g) {
    let at = t
    let level = g
    for (let i = 0, n = Math.floor(rand(3, 8)); i < n; i++) {
      const src = noiseBurst(ctx, 'white', at, 0.03)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = rand(1800, 4000)
      const a = gain(ctx, 0)
      envelope(a.gain, at, level, 0.001, 0.02)
      src.connect(bp).connect(a).connect(out)
      at += rand(0.04, 0.16)
      level *= 0.8
    }
  },
  // a far clank of metal
  metal(ctx, out, t, g) {
    partials(ctx, out, t, g, rand(300, 600), [1, 1.71, 2.53, 3.89], rand(0.6, 1.4))
  },
  // a few distant bird calls
  bird(ctx, out, t, g) {
    let at = t
    for (let i = 0, n = Math.floor(rand(2, 5)); i < n; i++) {
      const f = rand(2500, 4200)
      const o = osc(ctx, 'sine', f, at, at + 0.1)
      o.frequency.linearRampToValueAtTime(f * rand(1.1, 1.3), at + 0.03)
      o.frequency.linearRampToValueAtTime(f * 0.9, at + 0.07)
      const a = gain(ctx, 0)
      envelope(a.gain, at, g, 0.005, 0.07)
      o.connect(a).connect(out)
      at += rand(0.09, 0.2)
    }
  },
  // something breathing close by (the grue)
  breath(ctx, out, t, g) {
    const inhale = rand(1, 1.4)
    const exhale = rand(1.3, 1.8)
    const src = noiseBurst(ctx, 'pink', t, inhale + exhale + 0.5)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 2
    lp.frequency.setValueAtTime(500, t)
    lp.frequency.linearRampToValueAtTime(900, t + inhale)
    lp.frequency.linearRampToValueAtTime(380, t + inhale + 0.3 + exhale)
    const a = gain(ctx, 0)
    a.gain.setValueAtTime(0, t)
    a.gain.linearRampToValueAtTime(g * 0.6, t + inhale)
    a.gain.linearRampToValueAtTime(g * 0.3, t + inhale + 0.3)
    a.gain.linearRampToValueAtTime(g, t + inhale + 0.6)
    a.gain.linearRampToValueAtTime(0, t + inhale + 0.3 + exhale)
    src.connect(lp).connect(a).connect(out)
  },
  // a wave that rises, breaks and draws back over the sand
  wave(ctx, out, t, g) {
    const rise = rand(1, 1.8)
    const fall = rand(2.5, 4)
    const src = noiseBurst(ctx, 'pink', t, rise + fall + 0.2)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(300, t)
    lp.frequency.linearRampToValueAtTime(rand(1800, 2600), t + rise)
    lp.frequency.exponentialRampToValueAtTime(350, t + rise + fall)
    const a = gain(ctx, 0)
    a.gain.setValueAtTime(0, t)
    a.gain.linearRampToValueAtTime(g, t + rise)
    a.gain.exponentialRampToValueAtTime(0.0001, t + rise + fall)
    src.connect(lp).connect(a).connect(out)
  },
  // wood burning: a burst of dry pops, now and then a louder one
  crackle(ctx, out, t, g) {
    let at = t
    for (let i = 0, n = Math.floor(rand(4, 12)); i < n; i++) {
      const loud = rand(0, 1) < 0.15
      const src = noiseBurst(ctx, 'white', at, 0.02)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = loud ? rand(700, 1400) : rand(2500, 6000)
      bp.Q.value = 1.5
      const a = gain(ctx, 0)
      envelope(a.gain, at, loud ? g : g * rand(0.25, 0.6), 0.0005, loud ? 0.04 : 0.012)
      src.connect(bp).connect(a).connect(out)
      at += rand(0.02, 0.18)
    }
  },
  // a glassy chime, high in the air
  chime(ctx, out, t, g) {
    const f = [880, 987.8, 1174.7, 1318.5, 1568][Math.floor(rand(0, 5))]
    partials(ctx, out, t, g, f, [1, 2.01, 3.02, 4.2], rand(1.5, 2.5))
  },
}

/** A low thump with some harmonics, so that small speakers play it too. */
function thump(ctx: Ctx, out: AudioNode, t: number, freq: number, g: number) {
  const o = osc(ctx, 'triangle', freq * 2.2, t, t + 0.5)
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.08)
  const a = gain(ctx, 0)
  envelope(a.gain, t, g, 0.005, 0.35)
  o.connect(a).connect(out)
}

// ------------------------------------------------------------------ a whole ambience

/** One ambience playing: its layers, its reverb, and the events it schedules ahead of time. */
export class Ambience {
  readonly out: GainNode
  private sources: AudioScheduledSourceNode[] = []
  private dry: GainNode
  private wet: GainNode
  private until: number
  private nextEvents: number[]
  private nextBeat: number

  constructor(
    private ctx: Ctx,
    dest: AudioNode,
    private preset: Preset,
    when: number,
  ) {
    this.out = gain(ctx, 0)
    this.out.connect(dest)
    this.dry = gain(ctx, preset.level)
    this.dry.connect(this.out)
    const conv = ctx.createConvolver()
    conv.buffer = impulse(ctx, preset.reverb.seconds, preset.reverb.damping)
    this.wet = gain(ctx, preset.level * preset.reverb.send)
    this.wet.connect(conv).connect(this.out)
    const bus = gain(ctx, 1)
    bus.connect(this.dry)
    bus.connect(this.wet)
    for (const d of preset.drones) drone(ctx, bus, d, this.sources, when)
    for (const n of preset.noises) noise(ctx, bus, n, this.sources, when)
    this.until = when
    this.nextEvents = preset.events.map((e) => when + this.wait(e) * rand(0.2, 1))
    this.nextBeat = when + 0.5
  }

  private wait(e: EventDef): number {
    return e.perMinute > 0 ? (-Math.log(1 - Math.random()) * 60) / e.perMinute : Infinity
  }

  /** Schedules the events and pulses that fall before `to` (seconds of the audio clock). */
  schedule(to: number) {
    if (to <= this.until) return
    const { ctx, preset } = this
    preset.events.forEach((e, i) => {
      while (this.nextEvents[i] < to) {
        const t = Math.max(this.nextEvents[i], ctx.currentTime)
        const pan = ctx.createStereoPanner()
        pan.pan.value = rand(-0.8, 0.8)
        const wet = e.wet ?? 0.5
        const toDry = gain(ctx, 1 - wet * 0.6)
        const toWet = gain(ctx, wet / Math.max(preset.reverb.send, 0.05))
        pan.connect(toDry).connect(this.dry)
        pan.connect(toWet).connect(this.wet)
        VOICES[e.kind](ctx, pan, t, e.gain * rand(0.6, 1))
        this.nextEvents[i] += this.wait(e)
      }
    })
    const p = preset.pulse
    if (p) {
      const beat = 60 / p.bpm
      while (this.nextBeat < to) {
        p.pattern.forEach((off, i) => thump(ctx, this.dry, this.nextBeat + off * beat, p.freq, p.gain * (i === 0 ? 1 : 0.7)))
        this.nextBeat += beat * rand(0.97, 1.03)
      }
    }
    this.until = to
  }

  /** Stops every source at `at` (the fade out is done by the caller on `out`). */
  stop(at: number) {
    for (const s of this.sources) {
      try {
        s.stop(at)
      } catch {
        // already stopped
      }
    }
  }

  disconnect() {
    this.out.disconnect()
  }
}

// ------------------------------------------------------------------ cues

export function cue(ctx: Ctx, out: AudioNode, kind: 'score' | 'death' | 'victory', t: number) {
  if (kind === 'score') {
    partials(ctx, out, t, 0.12, 880, [1, 2.76, 5.4], 2.5)
    partials(ctx, out, t + 0.18, 0.1, 1318.5, [1, 2.76, 5.4], 3)
  } else if (kind === 'death') {
    const o = osc(ctx, 'sawtooth', 220, t, t + 5)
    o.frequency.exponentialRampToValueAtTime(27.5, t + 4)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1200, t)
    lp.frequency.exponentialRampToValueAtTime(120, t + 4)
    const a = gain(ctx, 0)
    a.gain.setValueAtTime(0, t)
    a.gain.linearRampToValueAtTime(0.22, t + 0.15)
    a.gain.exponentialRampToValueAtTime(0.0001, t + 4.8)
    o.connect(lp).connect(a).connect(out)
    VOICES.rumble(ctx, out, t, 0.4)
  } else {
    ;[220, 277.2, 329.6, 440, 554.4].forEach((f, i) => {
      const a = gain(ctx, 0)
      a.gain.setValueAtTime(0, t)
      a.gain.linearRampToValueAtTime(0.06, t + 1.5 + i * 0.2)
      a.gain.exponentialRampToValueAtTime(0.0001, t + 9)
      osc(ctx, 'triangle', f, t, t + 9.2).connect(a).connect(out)
    })
    partials(ctx, out, t, 0.12, 440, [1, 2.76, 5.4, 8.93], 6)
  }
}
