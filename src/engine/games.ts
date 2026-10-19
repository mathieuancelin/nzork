// The three games of the trilogy: what the engine and the interface need to know about each.
// Every game is the original story file, run untouched; its files live in story/<id>/ (story
// file, license, symbol table) and i18n/fr/<id>/ (French catalog).

export const GAME_IDS = ['zork1', 'zork2', 'zork3'] as const
export type GameId = (typeof GAME_IDS)[number]

export interface GameInfo {
  id: GameId
  /** Zork I, II or III. */
  number: 1 | 2 | 3
  /** "Zork II" */
  title: string
  /** As the historical sources credit them. */
  authors: string
  /** French and English subtitles. */
  subtitle: { fr: string; en: string }
  /** Name of the story file in story/<id>/. */
  file: string
  /** Release of the story file, as the game prints it. */
  release: string
  /** Year of the first Infocom release. */
  year: number
  /** Points of a perfect game. */
  maxScore: number
  /** The historical sources (git submodule vendor/<id>). */
  sources: string
  /** Whether the French translation exists (otherwise the game plays in English). */
  french: boolean
}

export const GAMES: Record<GameId, GameInfo> = {
  zork1: {
    id: 'zork1',
    number: 1,
    title: 'Zork I',
    authors: 'Marc Blank, Dave Lebling, Bruce Daniels, Tim Anderson',
    subtitle: { fr: 'Le Grand Empire Souterrain', en: 'The Great Underground Empire' },
    file: 'zork1.z3',
    release: 'Release 119 / Serial number 880429',
    year: 1980,
    maxScore: 350,
    sources: 'https://github.com/historicalsource/zork1',
    french: true,
  },
  zork2: {
    id: 'zork2',
    number: 2,
    title: 'Zork II',
    authors: 'Marc Blank, Dave Lebling, Bruce Daniels, Tim Anderson',
    subtitle: { fr: 'Le Sorcier de Frobozz', en: 'The Wizard of Frobozz' },
    file: 'zork2.z3',
    release: 'Release 63 / Serial number 860811',
    year: 1981,
    maxScore: 400,
    sources: 'https://github.com/historicalsource/zork2',
    french: true,
  },
  zork3: {
    id: 'zork3',
    number: 3,
    title: 'Zork III',
    authors: 'Marc Blank, Dave Lebling, Bruce Daniels, Tim Anderson',
    subtitle: { fr: 'Le Maître du Donjon', en: 'The Dungeon Master' },
    file: 'zork3.z3',
    release: 'Release 25 / Serial number 860811',
    year: 1982,
    maxScore: 7,
    sources: 'https://github.com/historicalsource/zork3',
    french: false,
  },
}

export const isGameId = (s: unknown): s is GameId => typeof s === 'string' && (GAME_IDS as readonly string[]).includes(s)
