import { useGame } from '../store'
import { t } from '../i18n'

export function StatusBar() {
  const status = useGame((s) => s.status)
  const lang = useGame((s) => s.settings.lang)
  const canUndo = useGame((s) => s.canUndo)
  const undoAllowed = useGame((s) => s.settings.undo)
  const undo = useGame((s) => s.undo)
  const openModal = useGame((s) => s.openModal)
  return (
    <header className="statusbar">
      <span className="brand">ZORK I</span>
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
      <button className="icon-btn" onClick={() => openModal('menu')} aria-label={t(lang, 'menu')} title={t(lang, 'menu')}>
        ☰
      </button>
    </header>
  )
}
