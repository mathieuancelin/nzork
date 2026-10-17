import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { useGame } from './store'
import { StatusBar } from './components/StatusBar'
import { Scene } from './components/Scene'
import { Transcript } from './components/Transcript'
import { CommandBar } from './components/CommandBar'
import { ChoicePanel } from './components/ChoicePanel'
import { Modals } from './components/Modals'
import { t } from './i18n'

function App() {
  const ready = useGame((s) => s.ready)
  const init = useGame((s) => s.init)
  const settings = useGame((s) => s.settings)
  const toast = useGame((s) => s.toast)
  const undo = useGame((s) => s.undo)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    document.documentElement.dataset.font = settings.fontSize
    document.documentElement.lang = settings.lang
  }, [settings.fontSize, settings.lang])

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

  const withChoices = settings.mode !== 'classic'
  return (
    <div className={`app ${settings.crt ? 'crt' : ''} ${withChoices ? 'with-choices' : ''}`}>
      <StatusBar />
      <div className="layout">
        <div className="main">
          <Scene />
          <Transcript />
          <section className="controls">
            <CommandBar />
          </section>
        </div>
        {withChoices && (
          <aside className="side">
            <ChoicePanel />
          </aside>
        )}
      </div>
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
