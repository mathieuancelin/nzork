// Zork II's InvisiClues: every question shows up along the full game, and is solved by its end.
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { hintsFor } from '../src/engine/assist/hints'
import { ZORK2 } from '../src/engine/assist/hints-zork2'
import { allRooms, visitedRooms } from '../src/engine/assist/map'
import { World } from '../src/engine/assist/world'
import { loadStory } from './helpers/plain'
import { frenchGame } from './helpers/french'
import { playWalkthrough } from './helpers/walkthrough'

const english = () => new Game({ game: 'zork2', story: loadStory('zork2'), lang: 'en', seed: 1234 })

describe('Zork II hints', () => {
  it('asks first about the barrow, in French', () => {
    const game = frenchGame(1234, 'zork2')
    game.start()
    const qs = hintsFor(game, visitedRooms(game))
    expect(qs.map((q) => q.id)).toEqual(['lamp'])
    expect(qs[0].question).toBe('Que faut-il emporter du tumulus ?')
    expect(qs[0].hints).toHaveLength(3)
    expect(qs[0].solved).toBe(false)
  })

  it('has three hints, from vague to explicit, for each question', () => {
    expect(new Set(ZORK2.map((q) => q.id)).size).toBe(ZORK2.length)
    for (const q of ZORK2) {
      expect(q.hints, q.id).toHaveLength(3)
      for (const [fr, en] of [q.q, ...q.hints]) expect(fr && en, q.id).toBeTruthy()
    }
  })

  it('names only rooms of the game', () => {
    const game = english()
    game.start()
    const rooms = new Set(allRooms(new World(game)))
    const source = readFileSync(new URL('../src/engine/assist/hints-zork2.ts', import.meta.url), 'utf8')
    const named = [
      ...[...source.matchAll(/saw\(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((r) => r[1])),
      ...[...source.matchAll(/seen\.has\('([^']+)'\)/g)].map((m) => m[1]),
    ]
    expect(named.length).toBeGreaterThan(20)
    expect(named.filter((r) => !rooms.has(r))).toEqual([])
  })

  it('shows every question along the full game, and ends with all of them solved', () => {
    const run = playWalkthrough(new URL('./walkthrough/zork2/en.txt', import.meta.url), 'en', 1234, 'zork2')
    const game = english()
    game.start()
    const remembered = new Set<string>()
    const shown = new Set<string>()
    for (const c of run.commands) {
      game.send(c)
      if (game.status().lit) remembered.add(game.status().roomId)
      for (const q of hintsFor(game, visitedRooms(game, remembered))) shown.add(q.id)
    }
    expect(ZORK2.map((q) => q.id).filter((id) => !shown.has(id))).toEqual([])
    const qs = hintsFor(game, visitedRooms(game, remembered))
    expect(qs.map((q) => q.id)).toEqual(ZORK2.map((q) => q.id))
    expect(qs.filter((q) => !q.solved).map((q) => q.id)).toEqual([])
  })
})
