// The illustration of the current room (or a placeholder while images are not generated),
// under the light that shows it: underground, the lantern's halo narrows as its batteries run
// down and flickers when they are nearly dead; a flame gives a warm, unsteady light. A few
// motes of dust or ripples of water move on top. The characters on stage show in portrait in a
// corner of the scene, fading in when they arrive and out when they leave.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGame } from '../store'
import { sceneManifest, type SceneInfo } from '../scenes'
import { portraitManifest } from '../portraits'
import { t } from '../i18n'
import type { PlaceId } from '../sound/presets'

/** Below this share of its life, the lantern flickers. */
const FAILING = 0.12

function haloStyle(s: SceneInfo): CSSProperties {
  // 1 for a new lantern or a flame, down to 0.3 for a dying lantern
  const k = s.light === 'flame' ? 0.8 : 0.3 + 0.7 * s.strength
  const clear = Math.round(16 + 36 * k)
  const edge = Math.round(clear + 20 + 22 * k)
  const dark = 0.55 + 0.4 * (1 - k)
  return { background: `radial-gradient(ellipse 78% 100% at 50% 62%, transparent ${clear}%, rgba(8,5,2,${(dark * 0.6).toFixed(2)}) ${edge}%, rgba(3,2,1,${dark.toFixed(2)}) 100%)` }
}

// dust in the air (embers over the fire, sparkles in the magic places: see styles.css)
const DUSTY = new Set<PlaceId>(['house', 'cave', 'mine', 'maze', 'hades', 'sacred', 'museum', 'dungeon', 'shadow', 'fire', 'magic'])

/** Motes of dust drifting slowly, always at the same places for a given scene. */
function Motes({ seed }: { seed: string }) {
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const rand = () => ((h = (h * 1103515245 + 12345) >>> 0) % 1000) / 1000
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="mote"
          style={
            {
              left: `${rand() * 100}%`,
              top: `${20 + rand() * 70}%`,
              '--dx': `${(rand() - 0.5) * 60}px`,
              '--dy': `${-10 - rand() * 40}px`,
              animationDuration: `${9 + rand() * 9}s`,
              animationDelay: `${-rand() * 18}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  )
}

interface Shown {
  /** The character (its base portrait), stable across its states. */
  key: string
  img: string
  name: [string, string]
}

/** How long a portrait takes to fade out (see .portrait.leaving in styles.css). */
const FADE_OUT_MS = 700

/** The characters on stage that have a portrait, framed in a corner of the scene. */
function Portraits() {
  const portraits = useGame((s) => s.portraits)
  const lang = useGame((s) => s.settings.lang)
  const [available, setAvailable] = useState<Set<string> | null>(null)
  const [leaving, setLeaving] = useState<Shown[]>([])
  const last = useRef<Shown[]>([])

  useEffect(() => {
    portraitManifest().then(setAvailable)
  }, [])

  const shown: Shown[] = available
    ? portraits.flatMap((p) => {
        const img = available.has(p.id) ? p.id : available.has(p.base) ? p.base : null
        return img ? [{ key: p.base, img, name: p.name }] : []
      })
    : []
  const signature = shown.map((p) => p.img).join()

  // the characters who just left fade out (once per change of the portraits on stage)
  useEffect(() => {
    const gone = last.current.filter((p) => !shown.some((q) => q.key === p.key))
    last.current = shown
    if (!gone.length) return
    setLeaving((l) => [...l.filter((x) => !gone.some((g) => g.key === x.key)), ...gone])
    setTimeout(() => setLeaving((l) => l.filter((x) => !gone.includes(x))), FADE_OUT_MS)
  }, [signature])

  const back = leaving.filter((p) => !shown.some((q) => q.key === p.key))
  if (!shown.length && !back.length) return null
  const name = (p: Shown) => p.name[lang === 'fr' ? 0 : 1]
  return (
    <div className="portraits">
      {[...shown.map((p) => ({ p, out: false })), ...back.map((p) => ({ p, out: true }))].map(({ p, out }) => (
        <figure key={p.key} className={`portrait ${out ? 'leaving' : ''}`} aria-hidden={out}>
          <img src={`${import.meta.env.BASE_URL}portraits/${p.img}.png`} alt={name(p)} title={name(p)} />
          <figcaption>{name(p)}</figcaption>
        </figure>
      ))}
    </div>
  )
}

export function Scene() {
  const status = useGame((s) => s.status)
  const scene = useGame((s) => s.scene)
  const lang = useGame((s) => s.settings.lang)
  const show = useGame((s) => s.settings.images)
  const [available, setAvailable] = useState<Set<string> | null>(null)

  useEffect(() => {
    sceneManifest().then(setAvailable)
  }, [])

  if (!show || !status || !scene) return null
  if (!status.lit) {
    return (
      <section className="scene" aria-label={t(lang, 'dark')}>
        <div className="scene-dark">
          <div className="grue-eyes" aria-hidden="true">
            <span />
            <span />
          </div>
        </div>
      </section>
    )
  }
  const id = available?.has(scene.id) ? scene.id : available?.has(scene.base) ? scene.base : null
  const failing = scene.light === 'lamp' && scene.strength < FAILING
  return (
    <section className={`scene light-${scene.light} ${failing ? 'failing' : ''}`} aria-label={status.room}>
      {id ? (
        <img src={`${import.meta.env.BASE_URL}scenes/${id}.png`} alt={status.room} />
      ) : (
        <div className="scene-placeholder" style={{ ['--sky' as string]: scene.sky, ['--ground' as string]: scene.ground }}>
          {status.room}
        </div>
      )}
      <div className={`fx fx-${scene.ambience}`} aria-hidden="true">
        {DUSTY.has(scene.ambience) && <Motes seed={scene.base} />}
      </div>
      {scene.light !== 'day' && <div className="halo" style={haloStyle(scene)} aria-hidden="true" />}
      <Portraits />
    </section>
  )
}
