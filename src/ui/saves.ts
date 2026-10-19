// Save slots in the browser (localStorage), with export / import to a file.
import type { SaveData } from '../engine/game'

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

const PREFIX = 'zork-in-your-browser:slot:'
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

export function readSlot(id: string | number): SlotData | null {
  try {
    const raw = storage()?.getItem(PREFIX + id)
    return raw ? (JSON.parse(raw) as SlotData) : null
  } catch {
    return null
  }
}

export function writeSlot(id: string | number, data: SlotData): boolean {
  try {
    storage()?.setItem(PREFIX + id, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function deleteSlot(id: string | number): void {
  try {
    storage()?.removeItem(PREFIX + id)
  } catch {
    /* ignore */
  }
}

export function allSlots(): (SlotData | null)[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => readSlot(i + 1))
}

/** Every save (slots and autosave) as one JSON document. */
export function exportAll(): string {
  const slots: Record<string, SlotData> = {}
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const s = readSlot(i)
    if (s) slots[String(i)] = s
  }
  const auto = readSlot(AUTOSAVE)
  if (auto) slots[AUTOSAVE] = auto
  return JSON.stringify({ format: 'zork-in-your-browser-saves', version: 1, slots }, null, 1)
}

export function importAll(json: string): number {
  const data = JSON.parse(json) as { format?: string; slots?: Record<string, SlotData> }
  // files exported before the project was renamed are still accepted
  if ((data.format !== 'zork-in-your-browser-saves' && data.format !== 'zork-next-saves') || !data.slots) throw new Error('Fichier de sauvegarde invalide')
  let n = 0
  for (const [id, slot] of Object.entries(data.slots)) {
    if (slot?.save?.snapshot && writeSlot(id, slot)) n++
  }
  return n
}

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
