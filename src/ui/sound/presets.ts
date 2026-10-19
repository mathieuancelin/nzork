// The ambiences of the soundtrack, as data. Each place of the games has one (see "ambience" in
// src/data/<game>/scenes.json); "dark" and "danger" play on top of it. The first eight come from
// Zork I; Zork II and Zork III add their gardens, volcano, seas, museum and dungeon. The values can be tuned by ear
// in the sound lab (npm run dev, then /sound-lab.html), which copies them back as JSON.

export type PlaceId =
  | 'surface' | 'house' | 'cave' | 'mine' | 'water' | 'sacred' | 'hades' | 'maze'
  | 'garden' | 'fire' | 'ocean' | 'lake' | 'shadow' | 'museum' | 'magic' | 'dungeon'
export type OverlayId = 'dark' | 'danger'
export type CueKind = 'score' | 'death' | 'victory'
export type NoiseColor = 'white' | 'pink' | 'brown'
export type EventKind = 'drip' | 'creak' | 'bell' | 'whisper' | 'rumble' | 'stone' | 'metal' | 'bird' | 'breath' | 'wave' | 'crackle' | 'chime'

export const PLACES: PlaceId[] = ['surface', 'house', 'cave', 'mine', 'water', 'sacred', 'hades', 'maze', 'garden', 'fire', 'ocean', 'lake', 'shadow', 'museum', 'magic', 'dungeon']

/** Detuned oscillators through a moving low-pass filter. */
export interface DroneDef {
  /** Fundamental, in Hz. */
  freq: number
  /** [frequency ratio, gain] of each partial. */
  partials: [number, number][]
  wave?: OscillatorType
  /** Detuning between the two oscillators of a partial, in cents (slow beating). */
  detune?: number
  cutoff: number
  q?: number
  /** Filter movement, in Hz, and its rate. */
  sweep?: number
  sweepRate?: number
  /** Volume movement, 0..1, and its rate (fast rates make a tremolo). */
  swell?: number
  swellRate?: number
  /** Slow pitch wandering, in cents. */
  drift?: number
  /** Slow stereo movement, 0..1. */
  pan?: number
}

/** Filtered noise: wind, water, rumble, breath of a choir. */
export interface NoiseDef {
  color: NoiseColor
  type: BiquadFilterType
  freq: number
  q?: number
  gain: number
  /** Gusts: volume movement, 0..1, and its rate. */
  gust?: number
  gustRate?: number
  sweep?: number
  sweepRate?: number
  pan?: number
}

/** A short sound played at random moments. */
export interface EventDef {
  kind: EventKind
  perMinute: number
  gain: number
  /** Share sent to the reverb, 0..1 (far away when high). */
  wet?: number
}

/** A regular beat: heartbeat, war drum. `pattern` is in beats, e.g. [0, 0.3] for lub-dub. */
export interface PulseDef {
  bpm: number
  freq: number
  gain: number
  pattern: number[]
}

export interface Preset {
  /** Overall level, to balance the ambiences with each other (each place is set to about −23 LUFS
   * with the lab's "Égaliser les lieux", before the player's volume). */
  level: number
  reverb: { seconds: number; damping: number; send: number }
  drones: DroneDef[]
  noises: NoiseDef[]
  events: EventDef[]
  pulse?: PulseDef
}

export interface Overlay extends Preset {
  /** Level left to the place's ambience while the overlay plays. */
  duck: number
}

export const AMBIENCES: Record<PlaceId, Preset> = {
  // around the house and in the forest: wind, far birds, an uneasy low note
  surface: {
    level: 0.32,
    reverb: { seconds: 2.2, damping: 0.6, send: 0.25 },
    drones: [{ freq: 55, wave: 'triangle', partials: [[1, 0.5], [2, 0.25], [3.01, 0.12], [2.12, 0.06]], detune: 5, cutoff: 600, sweep: 150, sweepRate: 0.03, swell: 0.5, swellRate: 0.05 }],
    noises: [{ color: 'pink', type: 'bandpass', freq: 500, q: 0.6, gain: 0.35, gust: 0.7, gustRate: 0.09, sweep: 250, sweepRate: 0.04, pan: 0.5 }],
    events: [
      { kind: 'bird', perMinute: 2, gain: 0.05, wet: 0.5 },
      { kind: 'creak', perMinute: 0.6, gain: 0.04, wet: 0.3 },
    ],
  },
  // inside the white house: muffled room tone, the wind outside, old wood
  house: {
    level: 0.48,
    reverb: { seconds: 0.9, damping: 0.7, send: 0.3 },
    drones: [{ freq: 73.4, wave: 'sawtooth', partials: [[1, 0.4], [1.5, 0.2], [2, 0.15]], detune: 7, cutoff: 260, sweep: 60, sweepRate: 0.05, swell: 0.4 }],
    noises: [
      { color: 'brown', type: 'lowpass', freq: 300, gain: 0.25, gust: 0.3 },
      { color: 'pink', type: 'bandpass', freq: 700, q: 0.8, gain: 0.08, gust: 0.8, gustRate: 0.06 },
    ],
    events: [{ kind: 'creak', perMinute: 3, gain: 0.09, wet: 0.3 }],
  },
  // the Great Underground Empire: deep drone, drops of water, far rumbles
  cave: {
    level: 0.24,
    reverb: { seconds: 5, damping: 0.5, send: 0.5 },
    drones: [{ freq: 41.2, wave: 'sawtooth', partials: [[1, 0.5], [1.5, 0.25], [2, 0.2], [2.97, 0.1]], detune: 8, cutoff: 220, sweep: 90, sweepRate: 0.03, swell: 0.5, swellRate: 0.04, pan: 0.4 }],
    noises: [{ color: 'brown', type: 'lowpass', freq: 160, gain: 0.4, gust: 0.5, gustRate: 0.05 }],
    events: [
      { kind: 'drip', perMinute: 9, gain: 0.14, wet: 0.8 },
      { kind: 'rumble', perMinute: 0.8, gain: 0.25, wet: 0.4 },
      { kind: 'stone', perMinute: 1, gain: 0.08, wet: 0.7 },
    ],
  },
  // the coal mine: tritone, creaking timbers, metal far away
  mine: {
    level: 0.38,
    reverb: { seconds: 2.4, damping: 0.6, send: 0.35 },
    drones: [{ freq: 46.25, wave: 'sawtooth', partials: [[1, 0.5], [1.414, 0.2], [2, 0.2], [2.83, 0.08]], detune: 10, cutoff: 240, sweep: 80, sweepRate: 0.04, swell: 0.4 }],
    noises: [{ color: 'brown', type: 'bandpass', freq: 260, q: 0.7, gain: 0.3, gust: 0.5 }],
    events: [
      { kind: 'creak', perMinute: 3, gain: 0.1, wet: 0.3 },
      { kind: 'metal', perMinute: 1.5, gain: 0.06, wet: 0.5 },
      { kind: 'drip', perMinute: 3, gain: 0.1, wet: 0.7 },
      { kind: 'stone', perMinute: 2, gain: 0.08, wet: 0.5 },
    ],
  },
  // river, dam, reservoir: rushing water
  water: {
    level: 0.32,
    reverb: { seconds: 3.5, damping: 0.5, send: 0.4 },
    drones: [{ freq: 49, wave: 'triangle', partials: [[1, 0.4], [1.5, 0.2], [2, 0.2], [3, 0.08]], detune: 6, cutoff: 500, sweep: 120, sweepRate: 0.03, swell: 0.4 }],
    noises: [
      { color: 'pink', type: 'lowpass', freq: 900, gain: 0.45, gust: 0.35, gustRate: 0.11 },
      { color: 'white', type: 'bandpass', freq: 2400, q: 0.6, gain: 0.08, gust: 0.6, gustRate: 0.17 },
    ],
    events: [{ kind: 'drip', perMinute: 5, gain: 0.1, wet: 0.7 }],
  },
  // temple, Egypt, dome: a shimmering pad and bells in a huge space
  sacred: {
    level: 0.28,
    reverb: { seconds: 7, damping: 0.4, send: 0.6 },
    drones: [{ freq: 55, wave: 'triangle', partials: [[1, 0.35], [1.2, 0.18], [1.5, 0.22], [2, 0.2], [2.4, 0.1], [3, 0.08]], detune: 4, cutoff: 1400, sweep: 400, sweepRate: 0.02, swell: 0.6, swellRate: 0.03, pan: 0.6 }],
    noises: [{ color: 'pink', type: 'bandpass', freq: 1100, q: 3, gain: 0.05, gust: 0.8, gustRate: 0.04 }],
    events: [
      { kind: 'bell', perMinute: 1.2, gain: 0.1, wet: 0.9 },
      { kind: 'drip', perMinute: 2, gain: 0.07, wet: 0.9 },
    ],
  },
  // the entrance to Hades and the Land of the Dead: dissonance, moans, whispers
  hades: {
    level: 0.38,
    reverb: { seconds: 6, damping: 0.5, send: 0.55 },
    drones: [{ freq: 36.7, wave: 'sawtooth', partials: [[1, 0.5], [1.06, 0.3], [1.414, 0.2], [2, 0.15], [2.12, 0.12]], detune: 12, cutoff: 300, sweep: 150, sweepRate: 0.05, swell: 0.6, swellRate: 0.06, drift: 20 }],
    noises: [{ color: 'pink', type: 'bandpass', freq: 450, q: 2.5, gain: 0.2, gust: 0.8, gustRate: 0.07, sweep: 250, sweepRate: 0.05 }],
    events: [
      { kind: 'whisper', perMinute: 5, gain: 0.12, wet: 0.6 },
      { kind: 'rumble', perMinute: 1.5, gain: 0.25, wet: 0.4 },
      { kind: 'bell', perMinute: 0.4, gain: 0.05, wet: 1 },
    ],
  },
  // the maze: a drone that keeps drifting out of tune and wandering around you
  maze: {
    level: 0.25,
    reverb: { seconds: 4, damping: 0.5, send: 0.45 },
    drones: [{ freq: 43.65, wave: 'sawtooth', partials: [[1, 0.5], [1.5, 0.25], [2.02, 0.2], [1.33, 0.1]], detune: 9, cutoff: 230, sweep: 100, sweepRate: 0.07, swell: 0.5, drift: 35, pan: 0.9 }],
    noises: [{ color: 'brown', type: 'lowpass', freq: 180, gain: 0.3, gust: 0.5 }],
    events: [
      { kind: 'whisper', perMinute: 1.5, gain: 0.08, wet: 0.7 },
      { kind: 'drip', perMinute: 4, gain: 0.1, wet: 0.8 },
      { kind: 'stone', perMinute: 1, gain: 0.07, wet: 0.6 },
    ],
  },
  // the gardens of Zork II: a soft breeze, birds close by, a warm and almost peaceful chord
  garden: {
    level: 0.34,
    reverb: { seconds: 2, damping: 0.6, send: 0.25 },
    drones: [{ freq: 65.4, wave: 'triangle', partials: [[1, 0.4], [1.25, 0.15], [1.5, 0.2], [2, 0.15]], detune: 4, cutoff: 900, sweep: 200, sweepRate: 0.03, swell: 0.5, swellRate: 0.05 }],
    noises: [{ color: 'pink', type: 'bandpass', freq: 650, q: 0.6, gain: 0.22, gust: 0.6, gustRate: 0.08, sweep: 250, sweepRate: 0.05, pan: 0.5 }],
    events: [
      { kind: 'bird', perMinute: 6, gain: 0.06, wet: 0.35 },
      { kind: 'creak', perMinute: 0.4, gain: 0.03, wet: 0.4 },
    ],
  },
  // the volcano of Zork II and the flaming pit of Zork III: the roar of the heat, crackling fire
  fire: {
    level: 0.36,
    reverb: { seconds: 3, damping: 0.5, send: 0.35 },
    drones: [{ freq: 38.9, wave: 'sawtooth', partials: [[1, 0.5], [1.5, 0.25], [2, 0.2], [2.5, 0.08]], detune: 10, cutoff: 260, sweep: 120, sweepRate: 0.06, swell: 0.6, swellRate: 0.07 }],
    noises: [
      { color: 'brown', type: 'lowpass', freq: 220, gain: 0.45, gust: 0.6, gustRate: 0.09 },
      { color: 'pink', type: 'bandpass', freq: 1800, q: 1, gain: 0.05, gust: 0.9, gustRate: 0.3 },
    ],
    events: [
      { kind: 'crackle', perMinute: 14, gain: 0.12, wet: 0.2 },
      { kind: 'rumble', perMinute: 1.5, gain: 0.3, wet: 0.4 },
    ],
  },
  // the Flathead Ocean: heavy surf breaking on the beach, the wind from the sea, a gull
  ocean: {
    level: 0.35,
    reverb: { seconds: 3, damping: 0.55, send: 0.35 },
    drones: [{ freq: 49, wave: 'triangle', partials: [[1, 0.35], [1.5, 0.2], [2, 0.18], [3, 0.06]], detune: 6, cutoff: 450, sweep: 120, sweepRate: 0.02, swell: 0.5, swellRate: 0.04 }],
    noises: [
      { color: 'pink', type: 'lowpass', freq: 700, gain: 0.35, gust: 0.8, gustRate: 0.1, pan: 0.6 },
      { color: 'white', type: 'bandpass', freq: 3000, q: 0.5, gain: 0.05, gust: 0.8, gustRate: 0.13 },
    ],
    events: [
      { kind: 'wave', perMinute: 5, gain: 0.3, wet: 0.3 },
      { kind: 'bird', perMinute: 0.8, gain: 0.04, wet: 0.6 },
    ],
  },
  // the icy lake of Zork III: still water lapping at the shore, drops, a cold shimmer
  lake: {
    level: 0.33,
    reverb: { seconds: 4, damping: 0.5, send: 0.45 },
    drones: [{ freq: 55, wave: 'triangle', partials: [[1, 0.35], [2, 0.2], [3, 0.1], [4.01, 0.05]], detune: 3, cutoff: 1200, sweep: 300, sweepRate: 0.02, swell: 0.6, swellRate: 0.03 }],
    noises: [{ color: 'pink', type: 'lowpass', freq: 500, gain: 0.2, gust: 0.5, gustRate: 0.07 }],
    events: [
      { kind: 'wave', perMinute: 8, gain: 0.1, wet: 0.5 },
      { kind: 'drip', perMinute: 6, gain: 0.1, wet: 0.8 },
    ],
  },
  // the Land of Shadow: mist blowing over the hills, footsteps nearby, someone whispering
  shadow: {
    level: 0.3,
    reverb: { seconds: 6, damping: 0.5, send: 0.5 },
    drones: [{ freq: 41.2, wave: 'sawtooth', partials: [[1, 0.45], [1.19, 0.2], [1.5, 0.18], [2, 0.12]], detune: 10, cutoff: 280, sweep: 120, sweepRate: 0.04, swell: 0.6, swellRate: 0.05, drift: 15, pan: 0.7 }],
    noises: [{ color: 'pink', type: 'bandpass', freq: 380, q: 1.5, gain: 0.25, gust: 0.8, gustRate: 0.05, sweep: 200, sweepRate: 0.04, pan: 0.8 }],
    events: [
      { kind: 'whisper', perMinute: 2, gain: 0.08, wet: 0.7 },
      { kind: 'stone', perMinute: 1.5, gain: 0.06, wet: 0.6 },
    ],
  },
  // the Royal Museum of Zork III and the Bank of Zork: a vast and empty hall, far footsteps
  museum: {
    level: 0.34,
    reverb: { seconds: 5.5, damping: 0.35, send: 0.45 },
    drones: [{ freq: 61.7, wave: 'triangle', partials: [[1, 0.3], [1.5, 0.2], [2, 0.18], [3, 0.08], [4, 0.04]], detune: 3, cutoff: 700, sweep: 150, sweepRate: 0.02, swell: 0.4, swellRate: 0.03 }],
    noises: [
      { color: 'brown', type: 'lowpass', freq: 250, gain: 0.18, gust: 0.2 },
      { color: 'pink', type: 'bandpass', freq: 900, q: 2, gain: 0.03, gust: 0.5, gustRate: 0.04 },
    ],
    events: [
      { kind: 'stone', perMinute: 1.5, gain: 0.05, wet: 0.8 },
      { kind: 'metal', perMinute: 0.8, gain: 0.04, wet: 0.9 },
    ],
  },
  // the Wizard's house of Zork II and the magic table of Zork III: glassy chimes in the air
  magic: {
    level: 0.3,
    reverb: { seconds: 5, damping: 0.4, send: 0.55 },
    drones: [{ freq: 82.4, wave: 'triangle', partials: [[1, 0.3], [1.5, 0.2], [2, 0.2], [2.5, 0.1], [3, 0.1], [4, 0.06]], detune: 6, cutoff: 2000, sweep: 800, sweepRate: 0.03, swell: 0.6, swellRate: 0.05, pan: 0.7 }],
    noises: [{ color: 'pink', type: 'bandpass', freq: 2500, q: 4, gain: 0.04, gust: 0.9, gustRate: 0.06 }],
    events: [
      { kind: 'chime', perMinute: 4, gain: 0.07, wet: 0.8 },
      { kind: 'whisper', perMinute: 1, gain: 0.05, wet: 0.8 },
      { kind: 'bell', perMinute: 0.5, gain: 0.05, wet: 0.9 },
    ],
  },
  // the Dungeon of Zork III: cold stone corridors, chains, drops, the fire of the pit far away
  dungeon: {
    level: 0.33,
    reverb: { seconds: 3.5, damping: 0.55, send: 0.4 },
    drones: [{ freq: 43.65, wave: 'sawtooth', partials: [[1, 0.5], [1.2, 0.2], [1.5, 0.2], [2, 0.15]], detune: 8, cutoff: 240, sweep: 80, sweepRate: 0.03, swell: 0.5 }],
    noises: [{ color: 'brown', type: 'lowpass', freq: 180, gain: 0.35, gust: 0.4 }],
    events: [
      { kind: 'drip', perMinute: 4, gain: 0.1, wet: 0.8 },
      { kind: 'metal', perMinute: 1.2, gain: 0.06, wet: 0.6 },
      { kind: 'crackle', perMinute: 3, gain: 0.04, wet: 0.6 },
    ],
  },
}

export const OVERLAYS: Record<OverlayId, Overlay> = {
  // no light: a beating sub-drone, a thin high tension, a heartbeat, and something breathing
  dark: {
    level: 0.31,
    duck: 0.35,
    reverb: { seconds: 3, damping: 0.7, send: 0.3 },
    drones: [
      { freq: 30.87, wave: 'sawtooth', partials: [[1, 0.5], [1.03, 0.4], [2, 0.2]], detune: 15, cutoff: 160, sweep: 50, sweepRate: 0.09, swell: 0.5, swellRate: 0.11 },
      { freq: 1760, wave: 'sine', partials: [[1, 0.012], [1.06, 0.012]], detune: 3, cutoff: 4000, swell: 0.9, swellRate: 0.05 },
    ],
    noises: [],
    events: [{ kind: 'breath', perMinute: 2.5, gain: 0.2, wet: 0.2 }],
    pulse: { bpm: 52, freq: 48, gain: 0.5, pattern: [0, 0.3] },
  },
  // a villain in the room: tremolo cluster and war drum
  danger: {
    level: 0.43,
    duck: 0.5,
    reverb: { seconds: 1.8, damping: 0.6, send: 0.3 },
    drones: [{ freq: 110, wave: 'sawtooth', partials: [[1, 0.15], [1.06, 0.12], [1.5, 0.08]], detune: 14, cutoff: 900, sweep: 300, sweepRate: 6, swell: 0.8, swellRate: 7 }],
    noises: [],
    events: [],
    pulse: { bpm: 100, freq: 55, gain: 0.6, pattern: [0, 0.5, 0.75] },
  },
}
