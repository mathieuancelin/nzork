import { useEffect, useState } from 'react'
import { useGame } from '../store'
import { t } from '../i18n'
import type { Lang } from '../../engine/game'
import { GAMES } from '../../engine/games'

export function StatusBar() {
  const status = useGame((s) => s.status)
  const gameId = useGame((s) => s.gameId)
  const lang = useGame((s) => s.settings.lang)
  const canUndo = useGame((s) => s.canUndo)
  const undoAllowed = useGame((s) => s.settings.undo)
  const undo = useGame((s) => s.undo)
  const openModal = useGame((s) => s.openModal)
  const sidebar = useGame((s) => s.settings.sidebar)
  const setSetting = useGame((s) => s.setSetting)
  const sideLabel = t(lang, sidebar ? 'hideSide' : 'showSide')
  return (
    <header className="statusbar">
      <button className="brand" onClick={() => openModal('games')} title={t(lang, 'chooseGame')}>
        {GAMES[gameId].title.toUpperCase()}
      </button>
      <span className="room" title={status?.room}>
        {status?.room ?? ''}
      </span>
      <span className="stat">
        {t(lang, 'score')} <b>{status?.score ?? 0}</b>
      </span>
      <span className="stat">
        {t(lang, 'moves')} <b>{status?.moves ?? 0}</b>
      </span>
      {undoAllowed && (
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title={t(lang, 'undoTitle')} aria-label={t(lang, 'undo')}>
          ↶
        </button>
      )}
      <button className="icon-btn" onClick={() => setSetting('sidebar', !sidebar)} aria-label={sideLabel} aria-pressed={sidebar} title={sideLabel}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
          <path d={sidebar ? 'M1 2h14v12H1zM10 2v12' : 'M1 2h14v12H1z'} />
        </svg>
      </button>
      <FullscreenButton lang={lang} />
      <button className="icon-btn" onClick={() => openModal('menu')} aria-label={t(lang, 'menu')} title={t(lang, 'menu')}>
        ☰
      </button>
    </header>
  )
}

/** Toggles the browser's full screen; hidden where the page cannot go full screen (iPhone). */
function FullscreenButton({ lang }: { lang: Lang }) {
  const [on, setOn] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    // also follows Esc and the browser's own controls
    const sync = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  if (!document.fullscreenEnabled) return null
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
  const label = t(lang, on ? 'exitFullscreen' : 'fullscreen')
  return (
    <button className="icon-btn" onClick={toggle} aria-label={label} aria-pressed={on} title={label}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
        <path d={on ? 'M6 1v5H1M10 1v5h5M15 10h-5v5M1 10h5v5' : 'M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5'} />
      </svg>
    </button>
  )
}
