// Save slots in the browser (localStorage), with export / import to a file. Each game has its
// own slots and autosave; Zork I keeps the keys it had before Zork II joined, so its saves stay
// where they were.
import type { SaveData } from '../engine/game'
import { GAME_IDS, isGameId, type GameId } from '../engine/games'

export const SLOT_COUNT = 10
export const AUTOSAVE = 'auto'

export interface TranscriptEntry {
  id: number
  kind: 'out' | 'in' | 'sys'
  text: string
}

export interface SlotData {
  name: string
  date: string // ISO
  save: SaveData
  transcript: TranscriptEntry[]
  /** Rooms seen, for the map (the game itself forgets the maze rooms). */
  visited?: string[]
}

const slotKey = (game: GameId, id: string | number) => (game === 'zork1' ? `zork-in-your-browser:slot:${id}` : `zork-in-your-browser:${game}:slot:${id}`)
/** Name of the project before it was renamed: its saves and settings are moved over once. */
const OLD_PREFIX = 'zork-next:'
const NEW_PREFIX = 'zork-in-your-browser:'

let migrated = false

function storage(): Storage | null {
  try {
    const s = window.localStorage
    if (!migrated) {
      migrated = true
      migrate(s)
    }
    return s
  } catch {
    return null
  }
}

function migrate(s: Storage): void {
  const old: string[] = []
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i)
    if (k?.startsWith(OLD_PREFIX)) old.push(k)
  }
  for (const k of old) {
    try {
      const key = NEW_PREFIX + k.slice(OLD_PREFIX.length)
      const value = s.getItem(k)
      if (value !== null && s.getItem(key) === null) s.setItem(key, value)
      s.removeItem(k)
    } catch {
      // storage full: keep the old copy rather than lose it
    }
  }
}

export function readSlot(id: string | number, game: GameId = 'zork1'): SlotData | null {
  try {
    const raw = storage()?.getItem(slotKey(game, id))
    return raw ? (JSON.parse(raw) as SlotData) : null
  } catch {
    return null
  }
}

export function writeSlot(id: string | number, data: SlotData, game: GameId = 'zork1'): boolean {
  try {
    storage()?.setItem(slotKey(game, id), JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function deleteSlot(id: string | number, game: GameId = 'zork1'): void {
  try {
    storage()?.removeItem(slotKey(game, id))
  } catch {
    /* ignore */
  }
}

export function allSlots(game: GameId = 'zork1'): (SlotData | null)[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => readSlot(i + 1, game))
}

function slotsOf(game: GameId): Record<string, SlotData> {
  const slots: Record<string, SlotData> = {}
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const s = readSlot(i, game)
    if (s) slots[String(i)] = s
  }
  const auto = readSlot(AUTOSAVE, game)
  if (auto) slots[AUTOSAVE] = auto
  return slots
}

/**
 * Every save of every game (slots and autosave) as one JSON document. Zork I's saves stay under
 * "slots", where the files of version 1 had them (an older copy of the site can still read them);
 * the other games are under "games".
 */
export function exportAll(): string {
  const games: Partial<Record<GameId, Record<string, SlotData>>> = {}
  for (const g of GAME_IDS) {
    if (g === 'zork1') continue
    const s = slotsOf(g)
    if (Object.keys(s).length) games[g] = s
  }
  return JSON.stringify({ format: 'zork-in-your-browser-saves', version: 2, slots: slotsOf('zork1'), games }, null, 1)
}

export function importAll(json: string): number {
  const data = JSON.parse(json) as { format?: string; slots?: Record<string, SlotData>; games?: Record<string, Record<string, SlotData>> }
  // files exported before the project was renamed are still accepted
  if ((data.format !== 'zork-in-your-browser-saves' && data.format !== 'zork-next-saves') || (!data.slots && !data.games)) throw new Error('Fichier de sauvegarde invalide')
  let n = 0
  const add = (game: GameId, slots: Record<string, SlotData>) => {
    for (const [id, slot] of Object.entries(slots)) {
      // a snapshot always goes back to its own game
      const g = slot?.save?.game ?? game
      if (slot?.save?.snapshot && isGameId(g) && writeSlot(id, slot, g)) n++
    }
  }
  add('zork1', data.slots ?? {})
  for (const [g, slots] of Object.entries(data.games ?? {})) if (isGameId(g)) add(g, slots)
  return n
}

/** Name of a preference that each game keeps for itself (Zork I keeps its older name). */
export const gamePref = (game: GameId, key: string) => (game === 'zork1' ? key : `${game}:${key}`)

/** Settings and small preferences. */
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem('zork-in-your-browser:pref:' + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    storage()?.setItem('zork-in-your-browser:pref:' + key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}
