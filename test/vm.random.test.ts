import { describe, it, expect } from 'vitest'
import { playPlain } from './helpers/plain'
import { dfrotzTranscript, flatten, HAS_DFROTZ } from '../tools/oracle/dfrotz'
import { TROLL_FIGHT } from './fixtures-cmds'
import { firstDiff } from '../tools/oracle/firstdiff'

describe.skipIf(!HAS_DFROTZ)('Z-machine randomness', () => {
  for (const seed of [1234, 5000, 31337, 777]) {
    it(`matches dfrotz with seed ${seed}`, () => {
      expect(firstDiff(flatten(playPlain(TROLL_FIGHT, seed)), flatten(dfrotzTranscript(TROLL_FIGHT, seed)))).toBeNull()
    })
  }
})
