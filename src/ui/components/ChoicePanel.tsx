// Clickable choices of the noob modes; in hyper noob mode the guide's suggestion is circled.
import { useState } from 'react'
import { useGame } from '../store'
import { t } from '../i18n'
import type { Choice } from '../../engine/assist/assist'

export function ChoicePanel() {
  const assist = useGame((s) => s.assist)
  const lang = useGame((s) => s.settings.lang)
  const mode = useGame((s) => s.settings.mode)
  const over = useGame((s) => s.over)
  const play = useGame((s) => s.playChoice)
  const [why, setWhy] = useState(false)
  if (mode === 'classic' || !assist || over) return null

  const hintId = mode === 'hypernoob' ? assist.hint?.id : undefined
  const group = (g: Choice['group'][]) => assist.choices.filter((c) => g.includes(c.group))
  const btn = (c: Choice) => (
    <button
      key={c.id}
      className={`choice ${c.group === 'move' ? 'move' : ''} ${c.id === hintId ? 'hint' : ''}`}
      onClick={() => {
        setWhy(false)
        play(c)
      }}
    >
      {c.label}
    </button>
  )
  const moves = group(['move'])
  const actions = group(['action', 'object'])
  const inventory = group(['inventory'])
  const examine = group(['examine'])
  const meta = group(['meta'])
  const hintChoice = assist.choices.find((c) => c.id === hintId)

  return (
    <div className="choices">
      {hintChoice && assist.hint && (
        <div>
          <button className="link" onClick={() => setWhy(!why)}>
            {t(lang, 'why')}
          </button>
          {why && <div className="why">{assist.hint.why}</div>}
        </div>
      )}
      {moves.length > 0 && (
        <div className="choice-group">
          <h3>{t(lang, 'goTo')}</h3>
          <div className="choice-list">{moves.map(btn)}</div>
        </div>
      )}
      {actions.length > 0 && (
        <div className="choice-group">
          <h3>{t(lang, 'actions')}</h3>
          <div className="choice-list">{actions.map(btn)}</div>
        </div>
      )}
      {inventory.length > 0 && (
        <div className="choice-group">
          <h3>{t(lang, 'inventory')}</h3>
          <div className="choice-list">{inventory.map(btn)}</div>
        </div>
      )}
      {examine.length > 0 && (
        <details className="examine" open={examine.some((c) => c.id === hintId)}>
          <summary>{lang === 'fr' ? 'Examiner…' : 'Examine…'}</summary>
          <div className="choice-list">{examine.map(btn)}</div>
        </details>
      )}
      <div className="choice-list">{meta.map(btn)}</div>
    </div>
  )
}
