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
}

const PREFIX = 'zork-next:slot:'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
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
  return JSON.stringify({ format: 'zork-next-saves', version: 1, slots }, null, 1)
}

export function importAll(json: string): number {
  const data = JSON.parse(json) as { format?: string; slots?: Record<string, SlotData> }
  if (data.format !== 'zork-next-saves' || !data.slots) throw new Error('Fichier de sauvegarde invalide')
  let n = 0
  for (const [id, slot] of Object.entries(data.slots)) {
    if (slot?.save?.snapshot && writeSlot(id, slot)) n++
  }
  return n
}

/** Settings and small preferences. */
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem('zork-next:pref:' + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    storage()?.setItem('zork-next:pref:' + key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}
