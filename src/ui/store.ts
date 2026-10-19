// Application state (zustand). The Game instance lives outside React state.
import { create } from 'zustand'
import type { Game, Lang, Status } from '../engine/game'
import { isGameId, type GameId } from '../engine/games'
import { createGame, loadGameData, type GameData } from './engine'
import { AUTOSAVE, SLOT_COUNT, allSlots, deleteSlot, gamePref, readPref, readSlot, writePref, writeSlot, type SlotData, type TranscriptEntry } from './saves'
import { computeAssist, type Assist, type Choice } from '../engine/assist/assist'
import { hasGuide } from '../engine/assist/guide'
import { inventoryOf, treasuresOf, type Item, type Treasures } from '../engine/assist/items'
import { mapOf, pathTo, visitedRooms, type MapState } from '../engine/assist/map'
import { hintsFor, type HintQuestion } from '../engine/assist/hints'
import { documentsOf, type GameDocument } from '../engine/assist/documents'
import { Labeler } from '../engine/assist/labels'
import { World, DIR_COMMAND } from '../engine/assist/world'
import { t } from './i18n'
import { sceneFor, roomTitles, type SceneInfo } from './scenes'
import { moodFor, turnCue, type Mood } from './sound/mood'
import type { CueKind } from './sound/presets'

export type Mode = 'classic' | 'noob' | 'hypernoob'
export type Modal = null | 'menu' | 'saves' | 'settings' | 'help' | 'about' | 'welcome' | 'hints' | 'documents' | 'games'
export type SideTab = 'actions' | 'map' | 'inventory' | 'treasures'

export interface Settings {
  lang: Lang
  mode: Mode
  crt: boolean
  typewriter: boolean
  fontSize: 's' | 'm' | 'l'
  undo: boolean
  images: boolean
  sound: boolean
  /** Soundtrack volume, 0..1. */
  volume: number
  /** Side panel (choices, inventory, treasures). */
  sidebar: boolean
  /** Treasure tracker tab. */
  treasures: boolean
  /** Storyteller: the answers of the game read aloud. */
  narrator: boolean
  narratorRate: number
  /** Chosen voice (voiceURI), or '' for the best one available. */
  narratorVoice: string
}

const DEFAULT_SETTINGS: Settings = {
  lang: 'fr',
  mode: 'classic',
  crt: true,
  typewriter: true,
  fontSize: 'm',
  undo: true,
  images: true,
  sound: true,
  volume: 0.6,
  sidebar: true,
  treasures: true,
  narrator: false,
  narratorRate: 1,
  narratorVoice: '',
}

interface State {
  ready: boolean
  /** The game being played: Zork I, II or III. */
  gameId: GameId
  /** Downloading another game. */
  switching: boolean
  settings: Settings
  transcript: TranscriptEntry[]
  status: Status | null
  scene: SceneInfo | null
  /** What the soundtrack plays. */
  mood: Mood | null
  /** Last short sound to play (score, death, victory). */
  cue: { id: number; kind: CueKind } | null
  /** What the side panel shows: inventory and treasures. */
  side: { items: Item[]; treasures: Treasures; map: MapState } | null
  /** Walking automatically to a room chosen on the map. */
  traveling: boolean
  /** The map shown large, above everything. */
  mapLarge: boolean
  /** InvisiClues: how many hints of each question were revealed. */
  revealed: Record<string, number>
  sideTab: SideTab
  /** On small screens, the side panel can fold down to its tabs. */
  sideCollapsed: boolean
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
  /** Plays another game of the trilogy (its autosave, or a new game). */
  switchGame(id: GameId): Promise<void>
  newGame(): void
  submit(line: string): void
  playChoice(choice: Choice): void
  undo(): void
  saveTo(slot: number, name?: string): void
  /** Loads a save of the current game; false when there is none (or it cannot be read). */
  loadFrom(slot: number | typeof AUTOSAVE): boolean
  removeSlot(slot: number): void
  refreshSlots(): void
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void
  openModal(m: Modal, tab?: 'save' | 'load'): void
  showToast(text: string): void
  setSideTab(tab: SideTab): void
  setSideCollapsed(collapsed: boolean): void
  travelTo(room: string): void
  setMapLarge(on: boolean): void
  /** The hint questions that make sense now (places seen). */
  hints(): HintQuestion[]
  reveal(id: string): void
  /** The documents of the game ("feelies"), found or still to find. */
  documents(): GameDocument[]
}

let game: Game | null = null
let initStarted = false
/** Story file and catalog of the current game. */
let data: GameData | null = null
let nextId = 1
/** Transcript length before each command, to undo the screen as well. */
let turnMarks: number[] = []

const entry = (kind: TranscriptEntry['kind'], text: string): TranscriptEntry => ({ id: nextId++, kind, text })

const MAX_TRANSCRIPT = 400

/** Rooms seen, remembered by the interface: the game forgets the maze rooms on purpose. */
let remembered = new Set<string>()
/** Set while walking to a room chosen on the map; any command of the player stops it. */
let travel: ReturnType<typeof setTimeout> | null = null

const sideOf = (g: Game) => {
  const st = g.status()
  if (st.lit) remembered.add(st.roomId)
  return { items: inventoryOf(g), treasures: treasuresOf(g), map: mapOf(g, visitedRooms(g, remembered)) }
}

export const useGame = create<State>((set, get) => {
  const persistAuto = () => {
    if (!game) return
    const s = get()
    const slot: SlotData = { name: t(s.settings.lang, 'autosave'), date: new Date().toISOString(), save: game.save(''), transcript: s.transcript.slice(-60), visited: [...remembered] }
    writeSlot(AUTOSAVE, slot, game.id)
    set({ autosave: slot })
  }

  const refreshAssist = () => {
    const s = get()
    if (!game || s.settings.mode === 'classic' || s.over || s.waitingFor !== 'command') {
      set({ assist: null })
      return
    }
    // the guide only knows Zork I: elsewhere hyper noob shows the choices without circling one
    set({ assist: computeAssist(game, s.settings.mode === 'hypernoob' && hasGuide(game.id)) })
  }

  /** Plays one clickable choice (or one step of a walk on the map). */
  const play = (choice: Choice) => {
    if (!game) return
    turnMarks.push(get().transcript.length)
    if (turnMarks.length > 60) turnMarks.shift()
    set((st) => ({ transcript: [...st.transcript, entry('in', choice.label)] }))
    const turn = game.sendCanonical(choice.command)
    afterTurn(turn.text)
  }

  const stopTravel = () => {
    if (travel) clearTimeout(travel)
    travel = null
    if (get().traveling) set({ traveling: false })
  }

  const afterTurn = (text: string) => {
    if (!game) return
    const g = game
    const st = g.status()
    const over = g.state === 'quit' || g.inputRoutineName() === 'FINISH'
    const mood = moodFor(g)
    const cue = turnCue(get().mood, mood, over && !get().over)
    set((s) => ({
      transcript: [...s.transcript, ...(text ? [entry('out', text)] : [])].slice(-MAX_TRANSCRIPT),
      status: st,
      scene: sceneFor(g),
      side: sideOf(g),
      mood,
      ...(cue ? { cue: { id: nextId++, kind: cue } } : {}),
      waitingFor: g.state === 'quit' ? 'other' : turnWaiting(g),
      over,
      canUndo: s.settings.undo && g.canUndo(),
    }))
    persistAuto()
    refreshAssist()
  }

  const initialGame = ((g: unknown): GameId => (isGameId(g) ? g : 'zork1'))(readPref<string>('game', 'zork1'))

  /** Shows a game: its autosave, or a new game (with the welcome screen when asked). */
  const open = (welcome: boolean) => {
    const id = data!.id
    const auto = readSlot(AUTOSAVE, id)
    set({ slots: allSlots(id), autosave: auto, revealed: readPref<Record<string, number>>(gamePref(id, 'hints'), {}) })
    if (auto && get().loadFrom(AUTOSAVE)) return
    get().newGame()
    if (welcome) set({ modal: 'welcome' })
  }

  return {
    ready: false,
    gameId: initialGame,
    switching: false,
    settings: { ...DEFAULT_SETTINGS, ...readPref<Partial<Settings>>('settings', {}) },
    transcript: [],
    status: null,
    scene: null,
    mood: null,
    cue: null,
    side: null,
    traveling: false,
    mapLarge: false,
    revealed: readPref<Record<string, number>>(gamePref(initialGame, 'hints'), {}),
    sideTab: readPref<SideTab>('sideTab', 'actions'),
    sideCollapsed: readPref<boolean>('sideCollapsed', false),
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
      data = await loadGameData(get().gameId)
      open(true)
      set({ ready: true })
    },

    async switchGame(id) {
      if (get().switching) return
      if (id === get().gameId && data) return
      stopTravel()
      set({ switching: true })
      try {
        data = await loadGameData(id)
      } catch {
        set({ switching: false })
        get().showToast(t(get().settings.lang, 'loadGameFailed'))
        return
      }
      // the game being left is already in its autosave (written at every turn)
      writePref('game', id)
      set({ gameId: id, switching: false, mood: null })
      open(false)
    },

    newGame() {
      if (!data) return
      const { settings } = get()
      stopTravel()
      game = createGame(data, settings.lang)
      turnMarks = []
      remembered = new Set()
      writePref(gamePref(data.id, 'hints'), {})
      set({ revealed: {} })
      set({ transcript: [], over: false, titles: roomTitles(game) })
      const turn = game.start()
      set({ transcript: [entry('out', turn.text)] })
      afterTurn('')
    },

    submit(raw) {
      const line = raw.trim()
      const s = get()
      if (!game) return
      stopTravel()
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
      stopTravel()
      play(choice)
    },

    undo() {
      const s = get()
      if (!game || !s.settings.undo) return
      stopTravel()
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
        side: sideOf(game!),
        mood: moodFor(game!),
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
        visited: [...remembered],
      }
      if (!writeSlot(slot, data, game.id)) {
        get().showToast(t(s.settings.lang, 'saveFailed'))
        return
      }
      set({ slots: allSlots(game.id), modal: null })
      get().showToast(t(s.settings.lang, 'saved', slot))
    },

    loadFrom(slot) {
      if (!data) return false
      const saved = readSlot(slot, data.id)
      if (!saved) return false
      const lang = get().settings.lang
      stopTravel()
      const g = createGame(data, lang)
      try {
        g.load(saved.save)
      } catch {
        // a snapshot of another game (an imported file put in the wrong place)
        get().showToast(t(lang, 'wrongGame'))
        return false
      }
      game = g
      remembered = new Set(saved.visited ?? [])
      set({ titles: roomTitles(game) })
      turnMarks = []
      nextId = Math.max(nextId, ...saved.transcript.map((e) => e.id + 1))
      set({
        transcript: [...saved.transcript, ...(slot === AUTOSAVE ? [] : [entry('sys', t(lang, 'loaded', saved.name))])],
        status: game.status(),
        scene: sceneFor(game),
        side: sideOf(game),
        mood: moodFor(game),
        waitingFor: turnWaiting(game),
        over: false,
        modal: null,
        canUndo: false,
      })
      refreshAssist()
      return true
    },

    removeSlot(slot) {
      const id = get().gameId
      deleteSlot(slot, id)
      set({ slots: allSlots(id) })
    },

    refreshSlots() {
      const id = get().gameId
      set({ slots: allSlots(id), autosave: readSlot(AUTOSAVE, id) })
    },

    setSetting(key, value) {
      const settings = { ...get().settings, [key]: value }
      writePref('settings', settings)
      set({ settings })
      if (key === 'lang' && game && data) {
        // the game state does not depend on the language: switch on the fly
        const snap = game.save('')
        game = createGame(data, value as Lang)
        game.load(snap)
        set({ status: game.status(), titles: roomTitles(game), side: sideOf(game) })
        persistAuto()
      }
      if (key === 'mode' || key === 'lang') refreshAssist()
      if (key === 'undo') set({ canUndo: !!value && !!game?.canUndo() })
    },

    openModal(m, tab) {
      if (m === 'saves') get().refreshSlots()
      set({ modal: m, ...(tab ? { savesTab: tab } : {}) })
    },

    setSideTab(tab) {
      writePref('sideTab', tab)
      set({ sideTab: tab })
      get().setSideCollapsed(false)
    },

    travelTo(room) {
      if (!game || travel) return
      const lang = get().settings.lang
      const steps = pathTo(game, visitedRooms(game, remembered), room)
      if (!steps?.length) {
        if (steps === null) get().showToast(t(lang, 'noPath'))
        return
      }
      const labels = new Labeler(game)
      set({ traveling: true })
      // one move at a time, so that the player sees the way; anything unexpected stops the walk
      const next = () => {
        travel = null
        const s = get()
        const step = steps.shift()
        if (!game || !step || s.over || s.waitingFor !== 'command') return stopTravel()
        if (s.mood?.danger) {
          get().showToast(t(lang, 'travelDanger'))
          return stopTravel()
        }
        const w = new World(game)
        if (!w.roomLit(step.to) && !w.carriesLight()) {
          get().showToast(t(lang, 'travelDark'))
          return stopTravel()
        }
        play({ id: `travel-${step.dir}`, label: labels.dir(step.dir), command: DIR_COMMAND[step.dir], group: 'move' })
        if (game.status().roomId !== step.to || !steps.length) return stopTravel()
        travel = setTimeout(next, 450)
      }
      next()
    },

    setMapLarge(on) {
      set({ mapLarge: on })
    },

    hints() {
      return game ? hintsFor(game, visitedRooms(game, remembered)) : []
    },

    documents() {
      return game ? documentsOf(game, visitedRooms(game, remembered)) : []
    },

    reveal(id) {
      const revealed = { ...get().revealed, [id]: (get().revealed[id] ?? 0) + 1 }
      writePref(gamePref(get().gameId, 'hints'), revealed)
      set({ revealed })
    },

    setSideCollapsed(collapsed) {
      writePref('sideCollapsed', collapsed)
      set({ sideCollapsed: collapsed })
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
