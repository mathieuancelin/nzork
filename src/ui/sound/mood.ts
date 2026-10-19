// What the soundtrack should play, read from the game state.
import type { Game } from '../../engine/game'
import { World } from '../../engine/assist/world'
import { ambienceFor } from '../scenes'
import type { CueKind, PlaceId } from './presets'

export interface Mood {
  place: PlaceId
  /** No light: the grue is near. */
  dark: boolean
  /** A villain is in the room: the troll, the thief or the cyclops (the dragon, Cerberus or the Wizard in Zork II, the hooded figure in Zork III). */
  danger: boolean
  score: number
  deaths: number
  won: boolean
}

export function moodFor(game: Game): Mood {
  const w = new World(game)
  const st = game.status()
  // a global the game does not have (Zork III ends without WON-FLAG) reads as 0
  const g = (name: string) => (w.hasGlobal(name) ? w.global(name) : 0)
  return {
    // a dead adventurer wanders as a spirit
    place: g('DEAD') ? 'hades' : ambienceFor(game.id, st.roomId),
    dark: !st.lit,
    danger: threatened(w, w.here()),
    score: st.score,
    deaths: g('DEATHS'),
    // Zork III has no WON-FLAG: the game is won in the Treasury of Zork
    won: g('WON-FLAG') !== 0 || (game.id === 'zork3' && st.roomId === 'NIRVANA'),
  }
}

function threatened(w: World, here: string): boolean {
  if (w.id === 'zork2') {
    if (w.loc('DRAGON') === here) return true
    if (w.loc('CERBERUS') === here && !w.flag('CERBERUS-LEASHED')) return true
    // the Wizard shows up now and then to cast a spell
    return w.loc('WIZARD') === here && !w.attr('WIZARD', 'INVISIBLE')
  }
  // the hooded figure of the Land of Shadow, until it is defeated or unmasked
  if (w.id === 'zork3') return w.loc('SHADOW') === here && !w.flag('SHADOW-GONE')
  if (w.id !== 'zork1') return false
  if (w.loc('TROLL') === here && !w.flag('TROLL-FLAG')) return true
  // the thief wanders unseen until he shows himself
  if (w.loc('THIEF') === here && !w.attr('THIEF', 'INVISIBLE')) return true
  if (w.loc('CYCLOPS') === here && !w.flag('CYCLOPS-FLAG') && !w.flag('MAGIC-FLAG')) return true
  return false
}

/** The cue a turn deserves, comparing the mood before and after it. */
export function turnCue(before: Mood | null, after: Mood, over: boolean): CueKind | null {
  if (over) return after.won ? 'victory' : 'death'
  if (before && after.deaths > before.deaths) return 'death'
  if (before && after.score > before.score) return 'score'
  return null
}
