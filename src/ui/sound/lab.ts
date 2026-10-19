// Sound lab, for development only (npm run dev, then /sound-lab.html): plays each ambience,
// tunes its settings by ear, measures the levels, and copies the values back as JSON.
import { AMBIENCES, OVERLAYS, PLACES, type PlaceId, type Preset } from './presets'
import { soundtrack } from './soundtrack'
import { Ambience } from './synth'

const ALL: Record<string, Preset> = { ...AMBIENCES, ...OVERLAYS }
const ORIGINAL = JSON.stringify(ALL)
const NAMES: Record<string, string> = {
  surface: 'Surface', house: 'Maison', cave: 'Cavernes', mine: 'Mine', water: 'Eau', sacred: 'Sacré', hades: 'Enfers', maze: 'Labyrinthe',
  garden: 'Jardin', fire: 'Feu', ocean: 'Océan', lake: 'Lac', shadow: 'Ombre', museum: 'Musée', magic: 'Magie', dungeon: 'Donjon',
  dark: 'Obscurité', danger: 'Danger',
}

const mood = { place: 'cave' as PlaceId, dark: false, danger: false }
let editing = 'cave'

soundtrack.fade = 0.8
soundtrack.setVolume(0.6)
soundtrack.setEnabled(true)
soundtrack.setMood(mood)
window.addEventListener('pointerdown', () => soundtrack.unlock(), { capture: true, once: true })

// ------------------------------------------------------------------ tiny DOM helper

type Child = Node | string | null | undefined | false
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener)
    else (el as unknown as Record<string, unknown>)[k] = v
  }
  for (const c of children) if (c) el.append(c)
  return el
}

const root = document.getElementById('lab')!

// ------------------------------------------------------------------ playback

const placeButtons = PLACES.map((p) =>
  h('button', {
    textContent: NAMES[p],
    onclick: () => {
      mood.place = p
      soundtrack.setMood(mood)
      editing = p
      editor.value = p
      renderParams()
      renderButtons()
    },
  }),
)
const toggles = (['dark', 'danger'] as const).map((id) => {
  const box = h('input', { type: 'checkbox', onchange: () => ((mood[id] = box.checked), soundtrack.setMood(mood)) })
  return h('label', {}, box, ` ${NAMES[id]}`)
})
function renderButtons() {
  placeButtons.forEach((b, i) => b.classList.toggle('on', PLACES[i] === mood.place))
}

const volume = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: '0.6', oninput: () => soundtrack.setVolume(Number(volume.value)) })

root.append(
  h(
    'section',
    {},
    h('h2', { textContent: 'Écouter' }),
    h('div', {}, ...placeButtons),
    h('div', {}, ...toggles, h('label', {}, 'Volume ', volume)),
    h(
      'div',
      { className: 'cues' },
      ...(['score', 'death', 'victory'] as const).map((k) => h('button', { textContent: { score: 'Point gagné', death: 'Mort', victory: 'Victoire' }[k], onclick: () => soundtrack.play(k) })),
    ),
  ),
)
renderButtons()

// ------------------------------------------------------------------ settings editor

const RANGES: Record<string, [number, number, number, boolean?]> = {
  level: [0, 4, 0.01], duck: [0, 1, 0.01], seconds: [0.2, 10, 0.1], damping: [0, 1, 0.01], send: [0, 1, 0.01],
  freq: [20, 5000, 0.01, true], cutoff: [40, 6000, 1, true], q: [0.1, 20, 0.1], sweep: [0, 2000, 1], sweepRate: [0, 10, 0.01],
  swell: [0, 1, 0.01], swellRate: [0, 10, 0.01], detune: [0, 50, 0.5], drift: [0, 100, 1], pan: [0, 1, 0.01],
  gain: [0, 1, 0.005], gust: [0, 1, 0.01], gustRate: [0, 2, 0.01], perMinute: [0, 30, 0.1], wet: [0, 1, 0.01], bpm: [20, 200, 1],
}
const CHOICES: Record<string, string[]> = {
  wave: ['sine', 'triangle', 'sawtooth', 'square'],
  color: ['white', 'pink', 'brown'],
  type: ['lowpass', 'bandpass', 'highpass'],
}

let refreshTimer = 0
function changed() {
  clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => soundtrack.refresh(), 250)
}

function slider(obj: Record<string, unknown> | unknown[], key: string | number, label: string, range: [number, number, number, boolean?]): Node[] {
  const [min, max, step, log] = range
  const value = () => (obj as Record<string, number>)[key as string]
  const toPos = (v: number) => (log ? (Math.log(v / min) / Math.log(max / min)) * 1000 : v)
  const fromPos = (p: number) => (log ? min * Math.pow(max / min, p / 1000) : p)
  const num = h('input', { type: 'number', step: String(step), value: String(value()) })
  const range_ = h('input', { type: 'range', min: String(log ? 0 : min), max: String(log ? 1000 : max), step: log ? '1' : String(step), value: String(toPos(value())) })
  const set = (v: number) => {
    ;(obj as Record<string, number>)[key as string] = Math.round(v / step) * step
    changed()
  }
  range_.addEventListener('input', () => {
    set(fromPos(Number(range_.value)))
    num.value = String(value())
  })
  num.addEventListener('change', () => {
    set(Number(num.value))
    range_.value = String(toPos(value()))
  })
  return [h('span', { textContent: label }), range_, num]
}

function rows(obj: unknown, path: string): Node[] {
  const out: Node[] = []
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => out.push(...rows(v, `${path}[${i}]`)))
    return out
  }
  if (!obj || typeof obj !== 'object') return out
  const o = obj as Record<string, unknown>
  const scalars = Object.entries(o).filter(([, v]) => typeof v !== 'object')
  if (scalars.length) out.push(h('div', { className: 'group', textContent: path || 'général' }))
  for (const [k, v] of scalars) {
    if (typeof v === 'number' && RANGES[k]) out.push(...slider(o, k, k, RANGES[k]))
    else if (typeof v === 'string' && CHOICES[k]) {
      const sel = h('select', { onchange: () => ((o[k] = sel.value), changed()) }, ...CHOICES[k].map((c) => h('option', { value: c, textContent: c, selected: c === v })))
      out.push(h('span', { textContent: k }), sel, h('span'))
    } else out.push(h('span', { textContent: k }), h('span', { textContent: String(v) }), h('span'))
  }
  for (const [k, v] of Object.entries(o)) {
    if (k === 'partials') {
      out.push(h('div', { className: 'group', textContent: `${path}.partials (ratio : gain)` }))
      ;(v as [number, number][]).forEach((p) => out.push(...slider(p, 1, `× ${p[0]}`, [0, 1, 0.005])))
    } else if (k === 'pattern') {
      out.push(h('span', { textContent: 'pattern' }), h('span', { textContent: JSON.stringify(v) }), h('span'))
    } else if (v && typeof v === 'object') out.push(...rows(v, path ? `${path}.${k}` : k))
  }
  return out
}

const editor = h(
  'select',
  {
    onchange: () => {
      editing = editor.value
      renderParams()
    },
  },
  ...Object.keys(ALL).map((k) => h('option', { value: k, textContent: NAMES[k], selected: k === editing })),
)
const params = h('div', { className: 'params' })
function renderParams() {
  params.replaceChildren(...rows(ALL[editing], ''))
}
root.append(h('section', {}, h('h2', { textContent: 'Régler' }), h('label', {}, 'Ambiance ', editor), params))
renderParams()

// ------------------------------------------------------------------ levels

/** Renders an ambience offline: loudness (≈ LUFS, K-weighted, ungated) and peak (dBFS). */
async function measure(preset: Preset, seconds = 12): Promise<{ lufs: number; peak: number }> {
  const sr = 44100
  const ctx = new OfflineAudioContext({ numberOfChannels: 4, length: sr * seconds, sampleRate: sr })
  ctx.destination.channelInterpretation = 'discrete'
  const amb = new Ambience(ctx, ctx.destination, preset, 0)
  amb.out.disconnect()
  amb.out.gain.value = 1
  amb.schedule(seconds)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 28
  const kHp = ctx.createBiquadFilter()
  kHp.type = 'highpass'
  kHp.frequency.value = 38
  kHp.Q.value = 0.5
  const kShelf = ctx.createBiquadFilter()
  kShelf.type = 'highshelf'
  kShelf.frequency.value = 1681
  kShelf.gain.value = 4
  const merger = ctx.createChannelMerger(4)
  const raw = ctx.createChannelSplitter(2)
  const weighted = ctx.createChannelSplitter(2)
  amb.out.connect(hp)
  hp.connect(raw)
  hp.connect(kHp).connect(kShelf).connect(weighted)
  weighted.connect(merger, 0, 0)
  weighted.connect(merger, 1, 1)
  raw.connect(merger, 0, 2)
  raw.connect(merger, 1, 3)
  merger.connect(ctx.destination)
  const buf = await ctx.startRendering()
  const from = sr * 2
  let sum = 0
  let peak = 0
  for (const ch of [0, 1]) {
    const d = buf.getChannelData(ch)
    for (let i = from; i < d.length; i++) sum += d[i] * d[i]
  }
  for (const ch of [2, 3]) {
    const d = buf.getChannelData(ch)
    for (let i = from; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]))
  }
  const ms = sum / (buf.length - from)
  return { lufs: -0.691 + 10 * Math.log10(ms || 1e-12), peak: 20 * Math.log10(peak || 1e-12) }
}

const TARGET = -23
const levels = h('table')
const levelsNote = h('p', { className: 'hint', textContent: `Cible : ${TARGET} LUFS pour les lieux (avant le volume du joueur).` })
async function measureAll(equalize: boolean) {
  levels.replaceChildren(h('tr', {}, h('th', { textContent: 'Ambiance' }), h('th', { textContent: '≈ LUFS' }), h('th', { textContent: 'Crête dBFS' }), h('th', { textContent: 'level' })))
  for (const [k, p] of Object.entries(ALL)) {
    let m = await measure(p)
    if (equalize && k in AMBIENCES) {
      p.level = Math.round(p.level * Math.pow(10, (TARGET - m.lufs) / 20) * 100) / 100
      m = await measure(p)
    }
    levels.append(h('tr', {}, h('td', { textContent: NAMES[k] }), h('td', { textContent: m.lufs.toFixed(1) }), h('td', { textContent: m.peak.toFixed(1) }), h('td', { textContent: String(p.level) })))
  }
  if (equalize) {
    renderParams()
    soundtrack.refresh()
  }
}
root.append(
  h(
    'section',
    {},
    h('h2', { textContent: 'Niveaux' }),
    h('button', { textContent: 'Mesurer', onclick: () => measureAll(false) }),
    h('button', { textContent: 'Égaliser les lieux', onclick: () => measureAll(true) }),
    levelsNote,
    levels,
  ),
)

// ------------------------------------------------------------------ export

const out = h('textarea', { readOnly: true })
function exportJson() {
  out.value = JSON.stringify({ AMBIENCES, OVERLAYS }, null, 1)
  navigator.clipboard?.writeText(out.value).catch(() => {})
}
root.append(
  h(
    'section',
    {},
    h('h2', { textContent: 'Exporter' }),
    h('button', { textContent: 'Copier les réglages', onclick: exportJson }),
    h('button', {
      textContent: 'Revenir aux réglages du code',
      onclick: () => {
        const orig = JSON.parse(ORIGINAL) as Record<string, Preset>
        for (const k of Object.keys(ALL)) Object.assign(ALL[k], orig[k])
        renderParams()
        soundtrack.refresh()
      },
    }),
    out,
  ),
)

// for automated checks from the browser console
Object.assign(window, { soundLab: { measure, measureAll, ALL } })
