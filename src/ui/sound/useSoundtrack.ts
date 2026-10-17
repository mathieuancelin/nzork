// Drives the soundtrack from the game state and the settings.
import { useEffect } from 'react'
import { useGame } from '../store'
import { soundtrack } from './soundtrack'

export function useSoundtrack() {
  const mood = useGame((s) => s.mood)
  const cue = useGame((s) => s.cue)
  const enabled = useGame((s) => s.settings.sound)
  const volume = useGame((s) => s.settings.volume)

  // browsers only allow sound after a gesture: start on the first click or key
  useEffect(() => {
    const forget = () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
    const unlock = () => {
      soundtrack.unlock()
      forget()
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return forget
  }, [])

  useEffect(() => soundtrack.setVolume(volume), [volume])
  useEffect(() => soundtrack.setEnabled(enabled), [enabled])
  useEffect(() => {
    if (mood) soundtrack.setMood(mood)
  }, [mood])
  useEffect(() => {
    if (cue) soundtrack.play(cue.kind)
  }, [cue])
}
