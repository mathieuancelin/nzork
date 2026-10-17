import { describe, it, expect } from 'vitest'
import { playWalkthrough } from './helpers/walkthrough'
import { playPlain } from './helpers/plain'
import { dfrotzTranscript, flatten, HAS_DFROTZ } from '../tools/oracle/dfrotz'
import { firstDiff } from '../tools/oracle/firstdiff'

const EN = new URL('./walkthrough/en.txt', import.meta.url)

describe('full game (English)', () => {
  const run = playWalkthrough(EN, 'en', 1234)

  it('wins with 350 points', () => {
    expect(run.status.score).toBe(350)
    expect(run.transcript).toContain('Master Adventurer')
  })

  it.skipIf(!HAS_DFROTZ)('is identical to the original interpreter (dfrotz), word for word', () => {
    const ours = flatten(playPlain(run.commands, 1234))
    const ref = flatten(dfrotzTranscript(run.commands, 1234))
    expect(firstDiff(ours, ref)).toBeNull()
  })
})

describe('full game (French)', () => {
  const FR = new URL('./walkthrough/fr.txt', import.meta.url)
  const run = playWalkthrough(FR, 'fr', 1234)

  it('wins with 350 points with French commands', () => {
    expect(run.status.score).toBe(350)
    expect(run.status.roomId).toBe('STONE-BARROW')
  })

  it('takes the same path as the English game', () => {
    const en = playWalkthrough(EN, 'en', 1234)
    expect(run.status.moves).toBe(en.status.moves)
  })

  it('shows no English text', () => {
    const lines = run.transcript.split('\n').filter((l) => !l.startsWith('>'))
    const english = lines.filter((l) => /\b(the|You|There|is|are|with|here|your)\b/.test(l) && !/Infocom|ZORK|Release|Copyright|trademark/.test(l))
    expect(english).toEqual([])
  })
})
