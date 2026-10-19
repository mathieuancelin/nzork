// What the soundtrack should play, read from the game state.
import type { Game } from '../../engine/game'
import { World } from '../../engine/assist/world'
import { ambienceFor } from '../scenes'
import type { CueKind, PlaceId } from './presets'

export interface Mood {
  place: PlaceId
  /** No light: the grue is near. */
  dark: boolean
  /** A villain is in the room: the troll, the thief or the cyclops (the dragon, Cerberus or the Wizard in Zork II). */
  danger: boolean
  score: number
  deaths: number
  won: boolean
}

export function moodFor(game: Game): Mood {
  const w = new World(game)
  const st = game.status()
  return {
    // a dead adventurer wanders as a spirit
    place: w.flag('DEAD') ? 'hades' : ambienceFor(game.id, st.roomId),
    dark: !st.lit,
    danger: threatened(w, w.here()),
    score: st.score,
    deaths: w.global('DEATHS'),
    won: w.flag('WON-FLAG'),
  }
}

function threatened(w: World, here: string): boolean {
  if (w.id === 'zork2') {
    if (w.loc('DRAGON') === here) return true
    if (w.loc('CERBERUS') === here && !w.flag('CERBERUS-LEASHED')) return true
    // the Wizard shows up now and then to cast a spell
    return w.loc('WIZARD') === here && !w.attr('WIZARD', 'INVISIBLE')
  }
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
