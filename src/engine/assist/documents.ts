// The documents of the game, to collect like the "feelies" of the Infocom boxes: what is
// written on the leaflet, the guidebook, the label of the boat… Each one appears once it has
// been found (taken, or its place visited), and reads in the language of the game.
import type { Game, GameId } from '../game'
import { capitalize } from '../i18n/grammar'
import { World } from './world'

/** How each document looks on screen. */
export type PaperStyle = 'leaflet' | 'manual' | 'booklet' | 'label' | 'matchbook' | 'book' | 'parchment' | 'tube' | 'stone' | 'door' | 'wood'

type DocumentDef = { obj: string; style: PaperStyle; room?: string }

const DOCUMENTS: Record<GameId, DocumentDef[]> = {
  zork1: [
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
  ],
  zork2: [
    { obj: 'NEWSPAPER', style: 'leaflet' },
    { obj: 'MATCH', style: 'matchbook' },
    { obj: 'BAT', style: 'wood' },
    { obj: 'BALLOON-LABEL', style: 'label' },
    { obj: 'CARD', style: 'manual' },
    { obj: 'BANK-BROCHURE', style: 'booklet' },
    { obj: 'ROBOT-LABEL', style: 'label' },
    { obj: 'REPELLENT', style: 'tube' },
    { obj: 'WHITE-BOOK', style: 'book' },
    { obj: 'PURPLE-BOOK', style: 'book' },
    { obj: 'DEGREE', style: 'parchment' },
    { obj: 'WARNING-LABEL', style: 'manual', room: 'TROPHY-ROOM' },
    { obj: 'CRYPT', style: 'stone', room: 'CRYPT-ROOM' },
  ],
  zork3: [
    { obj: 'WARNING-NOTE', style: 'leaflet' },
    { obj: 'REPELLENT', style: 'tube' },
    { obj: 'ROYAL-SEAL', style: 'stone', room: 'WIDE-HALL' },
    { obj: 'LORE-BOOK', style: 'book' },
  ],
}

/** Whether the game has documents to collect. */
export const hasDocuments = (game: GameId) => DOCUMENTS[game].length > 0

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
  const TEXT = game.symbols.properties.TEXT
  return DOCUMENTS[game.id].map(({ obj, style, room }) => {
    const found = room ? seen.has(room) : w.attr(obj, 'TOUCHBIT')
    if (!found) return { id: obj, style, found }
    const n = w.obj(obj)
    return { id: obj, style, found, name: capitalize(game.presenter.noun(n).nom), text: game.presenter.textAt(w.vm.unpack(w.vm.getProp(n, TEXT))).trim() }
  })
}
