// Application state (zustand). The Game instance lives outside React state.
import { create } from 'zustand'
import type { Game, Lang, Status } from '../engine/game'
import { createGame, loadStory } from './engine'
import { AUTOSAVE, SLOT_COUNT, allSlots, deleteSlot, readPref, readSlot, writePref, writeSlot, type SlotData, type TranscriptEntry } from './saves'
import { computeAssist, type Assist, type Choice } from '../engine/assist/assist'
import { t } from './i18n'
import { sceneFor, roomTitles, type SceneInfo } from './scenes'

export type Mode = 'classic' | 'noob' | 'hypernoob'
export type Modal = null | 'menu' | 'saves' | 'settings' | 'help' | 'about' | 'welcome'

export interface Settings {
  lang: Lang
  mode: Mode
  crt: boolean
  typewriter: boolean
  fontSize: 's' | 'm' | 'l'
  undo: boolean
  images: boolean
}

const DEFAULT_SETTINGS: Settings = {
  lang: 'fr',
  mode: 'classic',
  crt: true,
  typewriter: true,
  fontSize: 'm',
  undo: true,
  images: true,
}

interface State {
  ready: boolean
  settings: Settings
  transcript: TranscriptEntry[]
  status: Status | null
  scene: SceneInfo | null
  titles: Set<string>
  waitingFor: 'command' | 'yesno' | 'other'
  over: boolean
  modal: Modal
  savesTab: 'save' | 'load'
  slots: (SlotData | null)[]
  autosave: SlotData | null
  canUndo: boolean
  assist: Assist | null
  history: string[]
  toast: string | null

  init(): Promise<void>
  newGame(): void
  submit(line: string): void
  playChoice(choice: Choice): void
  undo(): void
  saveTo(slot: number, name?: string): void
  loadFrom(slot: number | typeof AUTOSAVE): void
  removeSlot(slot: number): void
  refreshSlots(): void
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void
  openModal(m: Modal, tab?: 'save' | 'load'): void
  showToast(text: string): void
}

let game: Game | null = null
let initStarted = false
let story: Uint8Array | null = null
let nextId = 1
/** Transcript length before each command, to undo the screen as well. */
let turnMarks: number[] = []

const entry = (kind: TranscriptEntry['kind'], text: string): TranscriptEntry => ({ id: nextId++, kind, text })

const MAX_TRANSCRIPT = 400

export const useGame = create<State>((set, get) => {
  const persistAuto = () => {
    if (!game) return
    const s = get()
    const data: SlotData = { name: t(s.settings.lang, 'autosave'), date: new Date().toISOString(), save: game.save(''), transcript: s.transcript.slice(-60) }
    writeSlot(AUTOSAVE, data)
    set({ autosave: data })
  }

  const refreshAssist = () => {
    const s = get()
    if (!game || s.settings.mode === 'classic' || s.over || s.waitingFor !== 'command') {
      set({ assist: null })
      return
    }
    set({ assist: computeAssist(game, s.settings.mode === 'hypernoob') })
  }

  const afterTurn = (text: string) => {
    if (!game) return
    const g = game
    const st = g.status()
    const over = g.state === 'quit' || g.inputRoutineName() === 'FINISH'
    set((s) => ({
      transcript: [...s.transcript, ...(text ? [entry('out', text)] : [])].slice(-MAX_TRANSCRIPT),
      status: st,
      scene: sceneFor(g),
      waitingFor: g.state === 'quit' ? 'other' : turnWaiting(g),
      over,
      canUndo: s.settings.undo && g.canUndo(),
    }))
    persistAuto()
    refreshAssist()
  }

  return {
    ready: false,
    settings: { ...DEFAULT_SETTINGS, ...readPref<Partial<Settings>>('settings', {}) },
    transcript: [],
    status: null,
    scene: null,
    titles: new Set(),
    waitingFor: 'command',
    over: false,
    modal: null,
    savesTab: 'save',
    slots: [],
    autosave: null,
    canUndo: false,
    assist: null,
    history: [],
    toast: null,

    async init() {
      // React's StrictMode runs effects twice in development: initialise only once
      if (initStarted) return
      initStarted = true
      story = await loadStory()
      const auto = readSlot(AUTOSAVE)
      set({ slots: allSlots(), autosave: auto })
      if (auto) {
        get().loadFrom(AUTOSAVE)
        set({ ready: true })
      } else {
        get().newGame()
        set({ ready: true, modal: 'welcome' })
      }
    },

    newGame() {
      if (!story) return
      const { settings } = get()
      game = createGame(story, settings.lang)
      turnMarks = []
      set({ transcript: [], over: false, titles: roomTitles(game) })
      const turn = game.start()
      set({ transcript: [entry('out', turn.text)] })
      afterTurn('')
    },

    submit(raw) {
      const line = raw.trim()
      const s = get()
      if (!game) return
      const lang = s.settings.lang
      set({ history: [...s.history.filter((h) => h !== line), line].slice(-50) })
      // commands handled by the interface rather than by the game
      const meta = metaCommand(line, lang)
      if (meta === 'save') return get().openModal('saves', 'save')
      if (meta === 'load') return get().openModal('saves', 'load')
      if (meta === 'undo') return get().undo()
      if (meta === 'restart') {
        if (window.confirm(t(lang, 'confirmRestart'))) get().newGame()
        return
      }
      if (meta === 'help') return get().openModal('help')
      turnMarks.push(get().transcript.length)
      if (turnMarks.length > 60) turnMarks.shift()
      set((st) => ({ transcript: [...st.transcript, entry('in', line)] }))
      const turn = game.send(line)
      afterTurn(turn.text)
    },

    playChoice(choice) {
      if (!game) return
      turnMarks.push(get().transcript.length)
      if (turnMarks.length > 60) turnMarks.shift()
      set((st) => ({ transcript: [...st.transcript, entry('in', choice.label)] }))
      const turn = game.sendCanonical(choice.command)
      afterTurn(turn.text)
    },

    undo() {
      const s = get()
      if (!game || !s.settings.undo) return
      const status = game.undo()
      if (!status) {
        get().showToast(t(s.settings.lang, 'nothingToUndo'))
        return
      }
      const mark = turnMarks.pop()
      set((st) => ({
        transcript: [...(mark !== undefined ? st.transcript.slice(0, mark) : st.transcript), entry('sys', t(st.settings.lang, 'undone'))],
        status,
        scene: sceneFor(game!),
        over: false,
        waitingFor: 'command',
        canUndo: game!.canUndo(),
      }))
      persistAuto()
      refreshAssist()
    },

    saveTo(slot, name) {
      if (!game) return
      const s = get()
      const st = game.status()
      const data: SlotData = {
        name: name || `${st.room} — ${st.score} pts`,
        date: new Date().toISOString(),
        save: game.save(''),
        transcript: s.transcript.slice(-60),
      }
      if (!writeSlot(slot, data)) {
        get().showToast(t(s.settings.lang, 'saveFailed'))
        return
      }
      set({ slots: allSlots(), modal: null })
      get().showToast(t(s.settings.lang, 'saved', slot))
    },

    loadFrom(slot) {
      if (!story) return
      const data = readSlot(slot)
      if (!data) return
      const lang = get().settings.lang
      game = createGame(story, lang)
      game.load(data.save)
      set({ titles: roomTitles(game) })
      turnMarks = []
      nextId = Math.max(nextId, ...data.transcript.map((e) => e.id + 1))
      set({
        transcript: [...data.transcript, ...(slot === AUTOSAVE ? [] : [entry('sys', t(lang, 'loaded', data.name))])],
        status: game.status(),
        scene: sceneFor(game),
        waitingFor: turnWaiting(game),
        over: false,
        modal: null,
        canUndo: false,
      })
      refreshAssist()
    },

    removeSlot(slot) {
      deleteSlot(slot)
      set({ slots: allSlots() })
    },

    refreshSlots() {
      set({ slots: allSlots(), autosave: readSlot(AUTOSAVE) })
    },

    setSetting(key, value) {
      const settings = { ...get().settings, [key]: value }
      writePref('settings', settings)
      set({ settings })
      if (key === 'lang' && game && story) {
        // the game state does not depend on the language: switch on the fly
        const snap = game.save('')
        game = createGame(story, value as Lang)
        game.load(snap)
        set({ status: game.status(), titles: roomTitles(game) })
        persistAuto()
      }
      if (key === 'mode' || key === 'lang') refreshAssist()
      if (key === 'undo') set({ canUndo: !!value && !!game?.canUndo() })
    },

    openModal(m, tab) {
      if (m === 'saves') get().refreshSlots()
      set({ modal: m, ...(tab ? { savesTab: tab } : {}) })
    },

    showToast(text) {
      set({ toast: text })
      setTimeout(() => {
        if (get().toast === text) set({ toast: null })
      }, 2500)
    },
  }
})

function turnWaiting(g: Game): 'command' | 'yesno' | 'other' {
  const r = g.inputRoutineName()
  return r === 'PARSER' || r === 'LOUD-ROOM-FCN' ? 'command' : r === 'YES?' ? 'yesno' : 'other'
}

type Meta = 'save' | 'load' | 'undo' | 'restart' | 'help' | null

function metaCommand(line: string, lang: Lang): Meta {
  const l = line
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
  const fr: Record<string, Meta> = {
    sauvegarder: 'save', sauver: 'save', sauvegarde: 'save', enregistrer: 'save',
    charger: 'load', restaurer: 'load', charge: 'load',
    annuler: 'undo', annule: 'undo', 'retour arriere': 'undo',
    recommencer: 'restart', recommence: 'restart', redemarrer: 'restart',
    aide: 'help', '?': 'help',
  }
  const en: Record<string, Meta> = { save: 'save', restore: 'load', load: 'load', undo: 'undo', restart: 'restart', help: 'help', '?': 'help' }
  return (lang === 'fr' ? fr : en)[l] ?? null
}

export { SLOT_COUNT }
