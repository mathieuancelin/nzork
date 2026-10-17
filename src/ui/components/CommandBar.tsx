// Text input (always available), yes/no buttons, end-of-game buttons.
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../store'
import { t } from '../i18n'

export function CommandBar() {
  const lang = useGame((s) => s.settings.lang)
  const waitingFor = useGame((s) => s.waitingFor)
  const over = useGame((s) => s.over)
  const history = useGame((s) => s.history)
  const submit = useGame((s) => s.submit)
  const undo = useGame((s) => s.undo)
  const canUndo = useGame((s) => s.canUndo)
  const newGame = useGame((s) => s.newGame)
  const openModal = useGame((s) => s.openModal)
  const modal = useGame((s) => s.modal)
  const [value, setValue] = useState('')
  const [cursor, setCursor] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!modal) input.current?.focus({ preventScroll: true })
  }, [modal, waitingFor])

  const send = (line: string) => {
    submit(line)
    setValue('')
    setCursor(null)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault()
      const c = cursor === null ? history.length - 1 : Math.max(0, cursor - 1)
      setCursor(c)
      setValue(history[c])
    } else if (e.key === 'ArrowDown' && cursor !== null) {
      e.preventDefault()
      const c = cursor + 1
      if (c >= history.length) {
        setCursor(null)
        setValue('')
      } else {
        setCursor(c)
        setValue(history[c])
      }
    }
  }

  return (
    <div>
      {over && (
        <div className="row" role="group" aria-label={t(lang, 'gameOver')}>
          {canUndo && (
            <button className="btn primary" onClick={undo}>
              ↶ {t(lang, 'undo')}
            </button>
          )}
          <button className="btn" onClick={() => openModal('saves', 'load')}>
            {t(lang, 'load')}
          </button>
          <button className="btn" onClick={newGame}>
            {t(lang, 'restart')}
          </button>
        </div>
      )}
      {waitingFor === 'yesno' && (
        <div className="row">
          <button className="btn primary" onClick={() => send(lang === 'fr' ? 'oui' : 'yes')}>
            {t(lang, 'yes')}
          </button>
          <button className="btn" onClick={() => send(lang === 'fr' ? 'non' : 'no')}>
            {t(lang, 'no')}
          </button>
        </div>
      )}
      <form
        className="command"
        onSubmit={(e) => {
          e.preventDefault()
          send(value)
        }}
      >
        <span className="prompt" aria-hidden="true">
          &gt;
        </span>
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={t(lang, 'placeholder')}
          aria-label={t(lang, 'placeholder')}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
        />
        <button className="btn" type="submit">
          {t(lang, 'send')}
        </button>
      </form>
    </div>
  )
}
