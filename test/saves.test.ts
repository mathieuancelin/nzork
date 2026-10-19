// Saves and settings survive the renamings of the project (zork-next → zork-in-your-browser →
// zork-in-the-browser), and each game of the trilogy keeps its own saves.
import { describe, it, expect, vi } from 'vitest'

class MemoryStorage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v))
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
  keys() {
    return [...this.data.keys()]
  }
}

describe('saves after the renaming', () => {
  it('moves the old saves and settings to the new names, and still imports old files', async () => {
    const store = new MemoryStorage()
    const slot = { name: 'Old game', date: '2026-10-17T00:00:00Z', save: { snapshot: {} }, transcript: [] }
    store.setItem('zork-next:slot:auto', JSON.stringify(slot))
    store.setItem('zork-next:slot:3', JSON.stringify({ ...slot, name: 'Slot 3' }))
    store.setItem('zork-next:pref:settings', JSON.stringify({ lang: 'en' }))
    // a newer value is never overwritten by an old one
    store.setItem('zork-next:pref:sideTab', JSON.stringify('inventory'))
    store.setItem('zork-in-the-browser:pref:sideTab', JSON.stringify('treasures'))
    ;(globalThis as { window?: unknown }).window = { localStorage: store }
    const saves = await import('../src/ui/saves')

    expect(saves.readSlot('auto')?.name).toBe('Old game')
    expect(saves.readSlot(3)?.name).toBe('Slot 3')
    expect(saves.readPref('settings', {})).toEqual({ lang: 'en' })
    expect(saves.readPref('sideTab', 'actions')).toBe('treasures')
    expect(store.keys().some((k) => k.startsWith('zork-next:'))).toBe(false)

    const old = JSON.stringify({ format: 'zork-next-saves', version: 1, slots: { '5': slot } })
    expect(saves.importAll(old)).toBe(1)
    expect(saves.readSlot(5)?.name).toBe('Old game')
    delete (globalThis as { window?: unknown }).window
  })
})

describe('saves after the second renaming', () => {
  it('moves the saves of zork-in-your-browser too, newer values first, and imports its files', async () => {
    const store = new MemoryStorage()
    const slot = { name: 'Your browser game', date: '2026-10-19T00:00:00Z', save: { snapshot: {} }, transcript: [] }
    store.setItem('zork-in-your-browser:slot:auto', JSON.stringify(slot))
    store.setItem('zork-in-your-browser:zork3:slot:2', JSON.stringify({ ...slot, name: 'Zork III slot' }))
    store.setItem('zork-in-your-browser:pref:zork2:hints', JSON.stringify({ riddle: 2 }))
    // the older name, still there, never wins over the newer one
    store.setItem('zork-next:slot:auto', JSON.stringify({ ...slot, name: 'Older game' }))
    ;(globalThis as { window?: unknown }).window = { localStorage: store }
    vi.resetModules()
    const saves = await import('../src/ui/saves')

    expect(saves.readSlot('auto')?.name).toBe('Your browser game')
    expect(saves.readSlot(2, 'zork3')?.name).toBe('Zork III slot')
    expect(saves.readPref('zork2:hints', {})).toEqual({ riddle: 2 })
    expect(store.keys().every((k) => k.startsWith('zork-in-the-browser:'))).toBe(true)

    const file = JSON.stringify({ format: 'zork-in-your-browser-saves', version: 2, slots: { '4': slot }, games: { zork2: { '1': { ...slot, name: 'Zork II file' } } } })
    expect(saves.importAll(file)).toBe(2)
    expect(saves.readSlot(1, 'zork2')?.name).toBe('Zork II file')
    expect(JSON.parse(saves.exportAll()).format).toBe('zork-in-the-browser-saves')
    delete (globalThis as { window?: unknown }).window
  })
})

describe('saves of each game', () => {
  it('keeps Zork I where it was and the other games apart, in the files too', async () => {
    const store = new MemoryStorage()
    ;(globalThis as { window?: unknown }).window = { localStorage: store }
    const saves = await import('../src/ui/saves')
    const slot = (name: string, game?: string) => ({ name, date: '2026-10-19T00:00:00Z', save: { game, snapshot: {} }, transcript: [] }) as never
    saves.writeSlot(2, slot('Zork I game'))
    saves.writeSlot(2, slot('Zork II game', 'zork2'), 'zork2')
    saves.writeSlot('auto', slot('Zork II auto', 'zork2'), 'zork2')
    expect(store.getItem('zork-in-the-browser:slot:2')).toContain('Zork I game')
    expect(store.getItem('zork-in-the-browser:zork2:slot:2')).toContain('Zork II game')
    expect(saves.readSlot(2)?.name).toBe('Zork I game')
    expect(saves.readSlot(2, 'zork2')?.name).toBe('Zork II game')
    expect(saves.readSlot(2, 'zork3')).toBeNull()
    expect(saves.gamePref('zork1', 'hints')).toBe('hints')
    expect(saves.gamePref('zork2', 'hints')).toBe('zork2:hints')

    const file = JSON.parse(saves.exportAll())
    expect(file.version).toBe(2)
    expect(Object.keys(file.slots)).toEqual(['2'])
    expect(Object.keys(file.games.zork2).sort()).toEqual(['2', 'auto'])

    for (const k of store.keys()) store.removeItem(k)
    expect(saves.importAll(JSON.stringify(file))).toBe(3)
    expect(saves.readSlot(2)?.name).toBe('Zork I game')
    expect(saves.readSlot('auto', 'zork2')?.name).toBe('Zork II auto')
    // a snapshot always goes back to its own game, wherever the file put it
    expect(saves.importAll(JSON.stringify({ format: 'zork-in-the-browser-saves', version: 1, slots: { '7': slot('Stray', 'zork2') } }))).toBe(1)
    expect(saves.readSlot(7)).toBeNull()
    expect(saves.readSlot(7, 'zork2')?.name).toBe('Stray')
    delete (globalThis as { window?: unknown }).window
  })
})
