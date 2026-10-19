// Saves and settings survive the renaming of the project (zork-next → zork-in-your-browser).
import { describe, it, expect } from 'vitest'

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
    store.setItem('zork-in-your-browser:pref:sideTab', JSON.stringify('treasures'))
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
