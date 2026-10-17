// The illustration of the current room (or a placeholder while images are not generated).
import { useEffect, useState } from 'react'
import { useGame } from '../store'
import { sceneManifest } from '../scenes'
import { t } from '../i18n'

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
  return (
    <section className="scene" aria-label={status.room}>
      {id ? (
        <img src={`${import.meta.env.BASE_URL}scenes/${id}.png`} alt={status.room} />
      ) : (
        <div className="scene-placeholder" style={{ ['--sky' as string]: scene.sky, ['--ground' as string]: scene.ground }}>
          {status.room}
        </div>
      )}
    </section>
  )
}
