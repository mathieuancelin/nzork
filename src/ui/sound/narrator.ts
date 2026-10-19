// Storyteller mode: the browser's speech synthesis reads the game's answers aloud, in the
// language of the game, while the soundtrack steps back. Voices depend on the system; the best
// local one is picked unless the player chose another.

export interface VoiceChoice {
  uri: string
  name: string
}

const GOOD = /premium|enhanced|natural|neural|siri|google/i

class Narrator {
  private enabled = false
  private lang = 'fr'
  private rate = 1
  private voiceUri = ''
  private unlocked = false
  /** Called with true while speaking (to lower the music). */
  onSpeaking: (speaking: boolean) => void = () => {}

  private get synth(): SpeechSynthesis | null {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  }

  get available(): boolean {
    return !!this.synth
  }

  configure(o: { enabled: boolean; lang: string; rate: number; voice: string }) {
    this.enabled = o.enabled
    this.lang = o.lang
    this.rate = o.rate
    this.voiceUri = o.voice
    if (!o.enabled) this.stop()
  }

  /** Voices for a language, best first. */
  voices(lang: string): VoiceChoice[] {
    const all = this.synth?.getVoices() ?? []
    return all
      .filter((v) => v.lang.toLowerCase().startsWith(lang))
      .sort((a, b) => Number(GOOD.test(b.name)) - Number(GOOD.test(a.name)) || Number(b.localService) - Number(a.localService))
      .map((v) => ({ uri: v.voiceURI, name: v.name }))
  }

  /** Mobile browsers only speak after a gesture: to call from one. */
  unlock() {
    const synth = this.synth
    if (this.unlocked || !synth) return
    this.unlocked = true
    synth.speak(new SpeechSynthesisUtterance(''))
  }

  /** Reads a text after what is already being read. */
  say(text: string) {
    const synth = this.synth
    if (!this.enabled || !synth) return
    const all = synth.getVoices()
    const voice = all.find((v) => v.voiceURI === this.voiceUri) ?? all.find((v) => v.voiceURI === this.voices(this.lang)[0]?.uri)
    // long utterances get cut by some browsers: one per paragraph or sentence group
    for (const part of chunks(clean(text))) {
      const u = new SpeechSynthesisUtterance(part)
      u.lang = this.lang === 'fr' ? 'fr-FR' : 'en-US'
      if (voice) u.voice = voice
      u.rate = this.rate
      u.onstart = () => this.onSpeaking(true)
      u.onend = u.onerror = () => {
        if (!synth.speaking && !synth.pending) this.onSpeaking(false)
      }
      synth.speak(u)
    }
  }

  stop() {
    this.synth?.cancel()
    this.onSpeaking(false)
  }
}

/** What reads badly: decorations and runs of symbols. */
function clean(text: string): string {
  return text
    .replace(/[*=_~#<>|]{2,}/g, ' ')
    .replace(/[«»"]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
}

function chunks(text: string, max = 220): string[] {
  const out: string[] = []
  for (const para of text.split(/\n+/)) {
    let cur = ''
    for (const sentence of para.match(/[^.!?…]+[.!?…]*\s*/g) ?? [para]) {
      if (cur && (cur + sentence).length > max) {
        out.push(cur.trim())
        cur = ''
      }
      cur += sentence
    }
    if (cur.trim()) out.push(cur.trim())
  }
  return out
}

export const narrator = new Narrator()
