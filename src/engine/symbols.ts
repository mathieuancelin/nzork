// Symbol tables of the games (story/<id>/symbols.json, built by tools/symbols/build.ts): the
// ZIL names of the machine's routines, objects, attributes, properties and globals.
import type { GameId } from './games'
import zork1 from './story/zork1/symbols.json'
import zork2 from './story/zork2/symbols.json'
import zork3 from './story/zork3/symbols.json'

export interface GameSymbols {
  routines: Record<string, number>
  objects: Record<string, number>
  attributes: Record<string, number>
  properties: Record<string, number>
  globals: Record<string, number>
  actions: Record<string, number>
  /** Object number → the English words that name it ("brass lantern"). */
  words: Record<string, string>
}

const SYMBOLS: Record<GameId, GameSymbols> = { zork1, zork2, zork3 }

export function symbolsOf(id: GameId): GameSymbols {
  return SYMBOLS[id]
}

/** Reverse lookups of a symbol table, computed once. */
export interface SymbolIndex {
  objectName: Map<number, string>
  routineName: Map<number, string>
}

const indexes = new WeakMap<GameSymbols, SymbolIndex>()

export function indexOf(s: GameSymbols): SymbolIndex {
  let i = indexes.get(s)
  if (!i) {
    i = {
      objectName: new Map(Object.entries(s.objects).map(([n, o]) => [o, n])),
      routineName: new Map(Object.entries(s.routines).map(([n, a]) => [a, n])),
    }
    indexes.set(s, i)
  }
  return i
}
