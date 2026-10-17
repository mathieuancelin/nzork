import { describe, it, expect } from 'vitest'
import { frenchCleanup } from '../src/engine/i18n/cleanup'
import { finishText, ARTICLE_MARK, PRONOUN_MARK } from '../src/engine/i18n/grammar'

describe('French text clean-up', () => {
  it('turns orphan questions around', () => {
    expect(frenchCleanup('Que voulez-vous mettre le prospectus dans?')).toBe('Dans quoi voulez-vous mettre le prospectus ?')
    expect(frenchCleanup('Que voulez-vous attaquer le troll avec ?')).toBe('Avec quoi voulez-vous attaquer le troll ?')
  })
  it('contracts only real articles', () => {
    expect(finishText(`Le contenu de ${ARTICLE_MARK}le sac.`)).toBe('Le contenu du sac.')
    expect(finishText(`Vous pensez à ${ARTICLE_MARK}les trésors.`)).toBe('Vous pensez aux trésors.')
    expect(finishText(`impossible de ${PRONOUN_MARK}le déplacer`)).toBe('impossible de le déplacer')
    expect(finishText(`vous tentez de ${PRONOUN_MARK}la ouvrir`)).toBe("vous tentez de l'ouvrir")
  })
  it('spaces punctuation once per run', () => {
    expect(frenchCleanup('Quoi??!?')).toBe('Quoi ??!?')
    expect(frenchCleanup('Bonjour!')).toBe('Bonjour !')
  })
  it('removes the English serial comma', () => {
    expect(frenchCleanup('le bouton bleu, le bouton rouge, ou le bouton jaune ?')).toBe('le bouton bleu, le bouton rouge ou le bouton jaune ?')
    expect(frenchCleanup('une épée, une lampe, et un sac')).toBe('une épée, une lampe et un sac')
  })
})
