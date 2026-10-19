// The map: every room placed, only visited rooms shown, a way between them.
import { describe, it, expect } from 'vitest'
import { Game } from '../src/engine/game'
import { World } from '../src/engine/assist/world'
import { allRooms, mapOf, pathTo, visitedRooms } from '../src/engine/assist/map'
import mapData from '../src/data/zork1/map.json'
import { loadStory } from './helpers/plain'
import { playWalkthrough } from './helpers/walkthrough'

const newGame = () => {
  const game = new Game({ story: loadStory(), lang: 'en', seed: 1234 })
  game.start()
  return game
}

describe('map', () => {
  it('places every room on its own cell', () => {
    const rooms = allRooms(new World(newGame()))
    const grid = mapData.rooms as Record<string, number[]>
    expect(rooms.length).toBe(110)
    for (const r of rooms) expect(grid[r], r).toBeDefined()
    expect(new Set(Object.values(grid).map((p) => p.join(','))).size).toBe(Object.keys(grid).length)
  })

  it('shows only what was visited, with the exits not taken yet', () => {
    const game = newGame()
    const map = mapOf(game, visitedRooms(game))
    expect(map.rooms).toEqual(['WEST-OF-HOUSE'])
    expect(map.links).toEqual([])
    expect(map.stubs.map((s) => s.dir).sort()).toEqual(['NORTH', 'SOUTH', 'WEST'])
  })

  it('finds a way back through visited rooms and open exits', () => {
    const game = newGame()
    for (const c of ['north', 'east', 'open window', 'enter', 'west']) game.send(c)
    const steps = pathTo(game, visitedRooms(game), 'WEST-OF-HOUSE')
    expect(steps?.map((s) => s.dir)).toEqual(['EAST', 'EAST', 'NORTH', 'WEST'])
    // never through a room that was not visited
    expect(pathTo(game, visitedRooms(game), 'SOUTH-OF-HOUSE')).toBeNull()
  })

  it('remembers the maze, which the game forgets', () => {
    const run = playWalkthrough(new URL('./walkthrough/zork1/en.txt', import.meta.url), 'en', 1234)
    const game = newGame()
    const remembered = new Set<string>()
    for (const c of run.commands) {
      game.send(c)
      const st = game.status()
      if (st.lit) remembered.add(st.roomId)
      if (st.roomId === 'MAZE-1') break
    }
    expect(game.status().roomId).toBe('MAZE-1')
    expect(visitedRooms(game).has('MAZE-1')).toBe(false)
    expect(visitedRooms(game, remembered).has('MAZE-1')).toBe(true)
  })
})
