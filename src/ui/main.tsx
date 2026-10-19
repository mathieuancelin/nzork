import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { useGame } from './store'
import { StatusBar } from './components/StatusBar'
import { Scene } from './components/Scene'
import { Transcript } from './components/Transcript'
import { CommandBar } from './components/CommandBar'
import { SidePanel } from './components/SidePanel'
import { MapOverlay } from './components/MapView'
import { Modals } from './components/Modals'
import { t } from './i18n'
import { useSoundtrack } from './sound/useSoundtrack'
import { useNarrator } from './sound/useNarrator'
import { GAMES } from '../engine/games'

function App() {
  const ready = useGame((s) => s.ready)
  const init = useGame((s) => s.init)
  const settings = useGame((s) => s.settings)
  const toast = useGame((s) => s.toast)
  const undo = useGame((s) => s.undo)
  const sideCollapsed = useGame((s) => s.sideCollapsed)
  const mapLarge = useGame((s) => s.mapLarge)
  const gameId = useGame((s) => s.gameId)
  useSoundtrack()
  useNarrator()

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    document.documentElement.dataset.font = settings.fontSize
    document.documentElement.lang = settings.lang
  }, [settings.fontSize, settings.lang])

  useEffect(() => {
    const g = GAMES[gameId]
    document.title = `${g.title} — ${g.subtitle[settings.lang]}`
  }, [gameId, settings.lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  if (!ready) return <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>{t(settings.lang, 'loading')}</div>

  const withSide = settings.sidebar
  return (
    <div className={`app ${settings.crt ? 'crt' : ''} ${withSide ? 'with-side' : ''} ${withSide && sideCollapsed ? 'side-collapsed' : ''} ${settings.mode !== 'classic' ? 'with-choices' : ''}`}>
      <StatusBar />
      <div className="layout">
        <div className="main">
          <Scene />
          <Transcript />
          <section className="controls">
            <CommandBar />
          </section>
        </div>
        {withSide && <SidePanel />}
      </div>
      {mapLarge && <MapOverlay />}
      <Modals />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

// offline support (production builds only: in development it would cache stale files)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
