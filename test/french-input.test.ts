import { describe, it, expect } from 'vitest'
import { frenchGame } from './helpers/french'

const g = frenchGame()
g.start()
const en = (line: string) => g.explain(line)!.join(' ')

describe('French commands → English words', () => {
  const cases: [string, string][] = [
    ['ouvre la boîte aux lettres', 'open mailbox'],
    ['ouvrir la petite boite aux lettres', 'open small mailbox'],
    ['lis le prospectus', 'read leaflet'],
    ['prends la lanterne en laiton', 'take brass lantern'],
    ["prends l'épée", 'take sword'],
    ['prends l epee', 'take sword'],
    ['nord', 'north'],
    ['n', 'north'],
    ['va au nord-est', 'ne'],
    ['aller vers le sud', 'south'],
    ['monte', 'up'],
    ['descendre', 'down'],
    ['regarde', 'look'],
    ['regarde sous le tapis', 'look under rug'],
    ['examine le tapis', 'examine rug'],
    ['x tapis', 'examine rug'],
    ['mets la lanterne dans la boîte', 'put lantern in box'],
    ['pose la lanterne', 'drop lantern'],
    ['tue le troll avec l\'épée', 'kill troll with sword'],
    ['attaque le troll avec mon épée', 'attack troll with sword'],
    ['donne la lanterne au troll', 'give lantern to troll'],
    ['prends tout', 'take all'],
    ['prends tout sauf la lanterne', 'take all except lantern'],
    ['prends la lanterne et l\'épée', 'take lantern and sword'],
    ['prends la lanterne puis va au nord', 'take lantern . north'],
    ['ouvre-la', 'open it'],
    ['i', 'inventory'],
    ['inventaire', 'inventory'],
    ['attends', 'wait'],
    ['allume la lanterne', 'light lantern'],
    ['éteins la lanterne', 'extinguish lantern'],
    ['ulysse', 'odysseus'],
    ['dis écho', 'say echo'],
    ['je prends la lanterne', 'take lantern'],
    ['accoste', 'land'],
    ["mets le bateau à l'eau", 'launch'],
    ["mettre à l'eau", 'launch'],
  ]
  for (const [fr, expected] of cases) {
    it(`${fr} → ${expected}`, () => expect(en(fr)).toBe(expected))
  }
})

describe('French commands of Zork III', () => {
  const g3 = frenchGame(1, 'zork3')
  g3.start()
  const cases: [string, string][] = [
    ['vaporise le répulsif sur moi', 'spray repellent on me'],
    ['règle le cadran sur 776', 'turn dial to 776'],
    ['mets le capuchon', 'wear hood'],
    ["mets l'anneau sous le siège", 'put ring under seat'],
    ['jette la lanterne du haut de la falaise', 'throw lantern off cliff'],
    ['descends la falaise', 'climb down cliff'],
    ['maître, tourne le cadran sur 1', 'master , turn dial to 1'],
    ['dis « frotz ozmoo »', 'say " frotz ozmoo "'],
    ['salue le marin', 'hello sailor'],
  ]
  for (const [fr, expected] of cases) {
    it(`${fr} → ${expected}`, () => expect(g3.explain(fr)!.join(' ')).toBe(expected))
  }
})

describe('French game', () => {
  it('plays the opening', () => {
    const game = frenchGame()
    game.start()
    expect(game.send('ouvre la boîte aux lettres').text).toContain('prospectus')
    expect(game.send('nord').status.roomId).toBe('NORTH-OF-HOUSE')
    expect(game.send('est').status.roomId).toBe('EAST-OF-HOUSE')
    game.send('ouvre la fenêtre')
    expect(game.send('entre').status.roomId).toBe('KITCHEN')
    game.send('ouest')
    expect(game.send('prends la lanterne').text).toMatch(/Pris/)
  })

  it('echoes unknown words in French', () => {
    const game = frenchGame()
    game.start()
    expect(game.send('prends le schtroumpf').text).toContain('schtroumpf')
  })
})
