// Plays the soundtrack: one ambience per place, overlays for darkness and danger, short cues,
// with slow crossfades. The AudioContext only starts after a user gesture (browsers block
// sound before) and sleeps while the tab is hidden or the sound is turned off.
import { AMBIENCES, OVERLAYS, type CueKind, type OverlayId, type Preset } from './presets'
import { Ambience, cue, impulse } from './synth'
import type { Mood } from './mood'

type Place = Pick<Mood, 'place' | 'dark' | 'danger'>

/** Seconds of events scheduled in advance. */
const LOOKAHEAD = 1.5

interface Playing {
  key: string
  amb: Ambience
  target: number
}

export class Soundtrack {
  private ctx: AudioContext | null = null
  private mix: GainNode | null = null
  private master: GainNode | null = null
  private cues: GainNode | null = null
  private enabled = false
  private unlocked = false
  private volume = 0.5
  private mood: Place | null = null
  private place: Playing | null = null
  private overlays: Partial<Record<OverlayId, Playing>> = {}
  /** Bumped by the sound lab to rebuild the ambiences after their settings changed. */
  private generation = 0
  /** Seconds of crossfade between ambiences (shorter in the sound lab). */
  fade = 3.5

  setEnabled(on: boolean) {
    this.enabled = on
    this.sync()
  }

  /** 0..1, on a perceptual curve. */
  setVolume(v: number) {
    this.volume = v
    if (this.master && this.ctx && this.wanted()) this.master.gain.setTargetAtTime(this.gainFor(v), this.ctx.currentTime, 0.1)
  }

  setMood(m: Place) {
    this.mood = { place: m.place, dark: m.dark, danger: m.danger }
    this.sync()
  }

  /** To call from a user gesture (click, key). */
  unlock() {
    if (this.unlocked) return
    this.unlocked = true
    this.sync()
  }

  play(kind: CueKind) {
    if (!this.ctx || !this.cues || !this.wanted()) return
    const t = this.ctx.currentTime + 0.05
    cue(this.ctx, this.cues, kind, t)
    if (kind !== 'score' && this.mix) {
      // let the cue through
      const g = this.mix.gain
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(0.25, t + 0.4)
      g.linearRampToValueAtTime(1, t + 6)
    }
  }

  /** Steps back while the storyteller speaks. */
  duck(on: boolean) {
    if (!this.mix || !this.ctx) return
    const g = this.mix.gain
    const now = this.ctx.currentTime
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(on ? 0.35 : 1, now + 0.6)
  }

  /** Rebuilds what plays (after the presets were edited). */
  refresh() {
    this.generation++
    this.sync()
  }

  private gainFor(v: number) {
    return 0.9 * v * v
  }

  private wanted() {
    return this.enabled && this.unlocked && !!this.mood && !document.hidden
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext()
    // ambiences → high-pass (no useless sub-bass) → limiter → volume
    this.mix = ctx.createGain()
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 28
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 6
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.mix.connect(hp).connect(limiter).connect(this.master).connect(ctx.destination)
    // cues get their own reverb
    this.cues = ctx.createGain()
    const verb = ctx.createConvolver()
    verb.buffer = impulse(ctx, 3, 0.5)
    const send = ctx.createGain()
    send.gain.value = 0.5
    this.cues.connect(limiter)
    this.cues.connect(send).connect(verb).connect(limiter)
    document.addEventListener('visibilitychange', () => this.sync())
    setInterval(() => this.tick(), 250)
    this.ctx = ctx
    return ctx
  }

  private tick() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const to = ctx.currentTime + LOOKAHEAD
    for (const p of [this.place, ...Object.values(this.overlays)]) p?.amb.schedule(to)
  }

  private sync() {
    if (!this.wanted()) {
      const ctx = this.ctx
      if (ctx && this.master && ctx.state === 'running') {
        this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
        setTimeout(() => {
          if (!this.wanted() && ctx.state === 'running') ctx.suspend()
        }, 500)
      }
      return
    }
    const ctx = this.ensure()
    if (ctx.state !== 'running') ctx.resume()
    this.master!.gain.setTargetAtTime(this.gainFor(this.volume), ctx.currentTime, 0.3)
    const m = this.mood!
    const duck = Math.min(m.dark ? OVERLAYS.dark.duck : 1, m.danger ? OVERLAYS.danger.duck : 1)
    this.place = this.swap(this.place, m.place, AMBIENCES[m.place], duck)
    for (const id of ['dark', 'danger'] as const) {
      this.overlays[id] = m[id] ? this.swap(this.overlays[id] ?? null, id, OVERLAYS[id], 1) : this.release(this.overlays[id])
    }
  }

  /** Keeps what plays if it is the same ambience (adjusting its level), else crossfades. */
  private swap(cur: Playing | null, name: string, preset: Preset, target: number): Playing {
    const ctx = this.ctx!
    const now = ctx.currentTime
    const key = `${name}:${this.generation}`
    if (cur && cur.key === key) {
      if (cur.target !== target) {
        this.ramp(cur.amb.out.gain, target, now, this.fade / 2)
        cur.target = target
      }
      return cur
    }
    this.release(cur)
    const amb = new Ambience(ctx, this.mix!, preset, now)
    this.ramp(amb.out.gain, target, now, this.fade)
    amb.schedule(now + LOOKAHEAD)
    return { key, amb, target }
  }

  private release(p: Playing | null | undefined): undefined {
    if (!p || !this.ctx) return undefined
    const now = this.ctx.currentTime
    this.ramp(p.amb.out.gain, 0, now, this.fade)
    p.amb.stop(now + this.fade + 0.1)
    setTimeout(() => p.amb.disconnect(), (this.fade + 1) * 1000)
    return undefined
  }

  private ramp(p: AudioParam, to: number, now: number, seconds: number) {
    p.cancelScheduledValues(now)
    p.setValueAtTime(p.value, now)
    p.linearRampToValueAtTime(to, now + seconds)
  }
}

export const soundtrack = new Soundtrack()
