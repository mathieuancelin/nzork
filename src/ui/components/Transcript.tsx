// The scrolling text of the game, with an optional typewriter effect on the last answer.
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../store'
import type { TranscriptEntry } from '../saves'

export function Transcript() {
  const entries = useGame((s) => s.transcript)
  const typewriter = useGame((s) => s.settings.typewriter)
  const titles = useGame((s) => s.titles)
  const ref = useRef<HTMLDivElement>(null)
  const last = entries[entries.length - 1]
  const [revealed, setRevealed] = useState<number>(Infinity)
  const animatedId = useRef<number>(-1)

  // typewriter on the newest game answer
  useEffect(() => {
    if (!last || last.kind !== 'out' || !typewriter || animatedId.current === last.id) {
      setRevealed(Infinity)
      return
    }
    animatedId.current = last.id
    let n = 0
    setRevealed(0)
    const total = last.text.length
    const speed = Math.max(3, Math.ceil(total / 90))
    let raf = 0
    const tick = () => {
      n += speed
      setRevealed(n)
      if (n < total) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [last, typewriter])

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries, revealed])

  return (
    <section className="transcript" ref={ref} aria-live="polite" onClick={() => setRevealed(Infinity)}>
      {entries.map((e) => (
        <Entry key={e.id} entry={e} limit={e === last ? revealed : Infinity} titles={titles} />
      ))}
    </section>
  )
}

function Entry({ entry, limit, titles }: { entry: TranscriptEntry; limit: number; titles: Set<string> }) {
  const text = limit === Infinity ? entry.text : entry.text.slice(0, limit)
  if (entry.kind !== 'out') return <p className={`entry ${entry.kind}`}>{text}</p>
  const lines = text.split('\n')
  return (
    <p className="entry out">
      {lines.map((line, i) => (
        <span key={i}>
          {titles.has(line.trim()) ? <span className="room-title">{line}</span> : line}
          {i < lines.length - 1 && !titles.has(line.trim()) ? '\n' : ''}
        </span>
      ))}
      {limit !== Infinity && limit < entry.text.length && <span className="caret" />}
    </p>
  )
}
