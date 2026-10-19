// The "feelies": documents appear once found, and read in the language of the game.
import { describe, it, expect } from 'vitest'
import { documentsOf } from '../src/engine/assist/documents'
import { visitedRooms } from '../src/engine/assist/map'
import { frenchGame } from './helpers/french'

describe('documents', () => {
  it('reveals a document once taken (or its place seen), in French', () => {
    const game = frenchGame()
    game.start()
    const before = documentsOf(game, visitedRooms(game))
    expect(before.filter((d) => d.found)).toEqual([])
    expect(before.every((d) => d.text === undefined)).toBe(true)
    for (const c of ['ouvre la boîte aux lettres', 'prends le prospectus', 'n', 'e', 'ouvre la fenêtre', 'entre', 'o']) game.send(c)
    const found = documentsOf(game, visitedRooms(game)).filter((d) => d.found)
    expect(found.map((d) => d.id)).toEqual(['ADVERTISEMENT', 'WOODEN-DOOR'])
    expect(found[0].text).toContain('BIENVENUE DANS ZORK')
    expect(found[1].text).toContain('volontairement laissé blanc')
  })
})
