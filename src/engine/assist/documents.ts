// The documents of the game, to collect like the "feelies" of the Infocom boxes: what is
// written on the leaflet, the guidebook, the label of the boat… Each one appears once it has
// been found (taken, or its place visited), and reads in the language of the game.
import type { Game } from '../game'
import { capitalize } from '../i18n/grammar'
import symbols from '../story/symbols.json'
import { World } from './world'

const TEXT = (symbols.properties as Record<string, number>).TEXT

/** How each document looks on screen. */
export type PaperStyle = 'leaflet' | 'manual' | 'booklet' | 'label' | 'matchbook' | 'book' | 'parchment' | 'tube' | 'stone' | 'door'

const DOCUMENTS: { obj: string; style: PaperStyle; room?: string }[] = [
  { obj: 'ADVERTISEMENT', style: 'leaflet' },
  { obj: 'WOODEN-DOOR', style: 'door', room: 'LIVING-ROOM' },
  { obj: 'OWNERS-MANUAL', style: 'manual' },
  { obj: 'GUIDE', style: 'booklet' },
  { obj: 'MATCH', style: 'matchbook' },
  { obj: 'TUBE', style: 'tube' },
  { obj: 'BOAT-LABEL', style: 'label' },
  { obj: 'ENGRAVINGS', style: 'stone', room: 'ENGRAVINGS-CAVE' },
  { obj: 'PRAYER', style: 'stone', room: 'NORTH-TEMPLE' },
  { obj: 'BOOK', style: 'book' },
  { obj: 'MAP', style: 'parchment' },
]

export interface GameDocument {
  /** ZIL name of the object, e.g. "ADVERTISEMENT". */
  id: string
  style: PaperStyle
  found: boolean
  /** Name and text, only once found. */
  name?: string
  text?: string
}

export function documentsOf(game: Game, seen: Set<string>): GameDocument[] {
  const w = new World(game)
  return DOCUMENTS.map(({ obj, style, room }) => {
    const found = room ? seen.has(room) : w.attr(obj, 'TOUCHBIT')
    if (!found) return { id: obj, style, found }
    const n = w.obj(obj)
    return { id: obj, style, found, name: capitalize(game.presenter.noun(n).nom), text: game.presenter.textAt(w.vm.unpack(w.vm.getProp(n, TEXT))).trim() }
  })
}
