// Drives the storyteller: reads each new answer of the game, stops when the player acts.
import { useEffect, useRef } from 'react'
import { useGame } from '../store'
import { narrator } from './narrator'
import { soundtrack } from './soundtrack'

export function useNarrator() {
  const ready = useGame((s) => s.ready)
  const transcript = useGame((s) => s.transcript)
  const traveling = useGame((s) => s.traveling)
  const enabled = useGame((s) => s.settings.narrator)
  const lang = useGame((s) => s.settings.lang)
  const rate = useGame((s) => s.settings.narratorRate)
  const voice = useGame((s) => s.settings.narratorVoice)
  const last = useRef<number | null>(null)

  useEffect(() => {
    narrator.onSpeaking = (speaking) => soundtrack.duck(speaking)
    const unlock = () => {
      narrator.unlock()
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
  }, [])

  useEffect(() => narrator.configure({ enabled, lang, rate, voice }), [enabled, lang, rate, voice])

  useEffect(() => {
    if (!ready) return
    const top = transcript.at(-1)?.id ?? 0
    // what is already on screen when the game loads is not read
    if (last.current === null) {
      last.current = top
      return
    }
    const fresh = transcript.filter((e) => e.id > last.current!)
    last.current = Math.max(last.current, top)
    if (!fresh.length) return
    // a new command interrupts the reading, except the steps of a walk on the map
    if (fresh.some((e) => e.kind === 'in') && !traveling) narrator.stop()
    for (const e of fresh) if (e.kind === 'out' && e.text.trim()) narrator.say(e.text)
  }, [transcript, ready, traveling])
}
