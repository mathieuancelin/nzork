import { describe, it, expect } from 'vitest'
import { playPlain } from './helpers/plain'
import { dfrotzTranscript, flatten, HAS_DFROTZ } from '../tools/oracle/dfrotz'

const cmds = ['open mailbox', 'read leaflet', 'drop leaflet', 'go north', 'e', 'open window', 'enter house', 'take lamp', 'w', 'move rug', 'open trap door', 'turn on lamp', 'down', 'i']

describe.skipIf(!HAS_DFROTZ)('Z-machine', () => {
  it('matches dfrotz on the opening', () => {
    const ours = flatten(playPlain(cmds, 1234))
    const ref = flatten(dfrotzTranscript(cmds, 1234))
    expect(ours).toBe(ref)
  })
})
