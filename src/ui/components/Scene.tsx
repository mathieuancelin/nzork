// The illustration of the current room (or a placeholder while images are not generated),
// under the light that shows it: underground, the lantern's halo narrows as its batteries run
// down and flickers when they are nearly dead; a flame gives a warm, unsteady light. A few
// motes of dust or ripples of water move on top.
import { useEffect, useState, type CSSProperties } from 'react'
import { useGame } from '../store'
import { sceneManifest, type SceneInfo } from '../scenes'
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

const DUSTY = new Set<PlaceId>(['house', 'cave', 'mine', 'maze', 'hades', 'sacred'])

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
    </section>
  )
}
