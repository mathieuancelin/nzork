// The side panel: clickable choices (noob modes), inventory and treasure tracker, in tabs.
import { useState } from 'react'
import { useGame, type SideTab } from '../store'
import { t } from '../i18n'
import { ChoicePanel } from './ChoicePanel'
import { ItemIcon } from './ItemIcon'
import type { Item } from '../../engine/assist/items'

export function SidePanel() {
  const mode = useGame((s) => s.settings.mode)
  const lang = useGame((s) => s.settings.lang)
  const showTreasures = useGame((s) => s.settings.treasures)
  const side = useGame((s) => s.side)
  const tab = useGame((s) => s.sideTab)
  const setTab = useGame((s) => s.setSideTab)
  const collapsed = useGame((s) => s.sideCollapsed)
  const setCollapsed = useGame((s) => s.setSideCollapsed)
  // folding only exists on small screens, where the panel sits under the text
  const fold = () => window.matchMedia('(max-width: 900px)').matches && setCollapsed(!collapsed)

  const tabs: SideTab[] = [...(mode !== 'classic' ? (['actions'] as const) : []), 'inventory', ...(showTreasures ? (['treasures'] as const) : [])]
  const current = tabs.includes(tab) ? tab : tabs[0]
  const label = (k: SideTab) => {
    if (k === 'actions') return t(lang, 'actions')
    if (k === 'inventory') return `${t(lang, 'inventory')}${side?.items.length ? ` (${side.items.length})` : ''}`
    return `${t(lang, 'treasures')} ${side ? `${side.treasures.inCase}/${side.treasures.slots.length}` : ''}`
  }

  return (
    <aside className={`side ${collapsed ? 'collapsed' : ''}`}>
      <div className="tabs" role="tablist">
        {tabs.map((k) => (
          <button key={k} role="tab" aria-selected={k === current} className={`tab ${k === current ? 'on' : ''}`} onClick={() => (k === current ? fold() : setTab(k))}>
            {label(k)}
          </button>
        ))}
        <button className="tab fold" onClick={fold} aria-expanded={!collapsed} aria-label={t(lang, collapsed ? 'expandSide' : 'collapseSide')} title={t(lang, collapsed ? 'expandSide' : 'collapseSide')}>
          {collapsed ? '▴' : '▾'}
        </button>
      </div>
      <div className="tab-body" role="tabpanel">
        {current === 'actions' ? <ChoicePanel /> : current === 'inventory' ? <Inventory /> : <TreasureTracker />}
      </div>
    </aside>
  )
}

function Inventory() {
  const side = useGame((s) => s.side)
  const lang = useGame((s) => s.settings.lang)
  const mode = useGame((s) => s.settings.mode)
  const assist = useGame((s) => s.assist)
  const play = useGame((s) => s.playChoice)
  const [open, setOpen] = useState<number | null>(null)
  if (!side) return null
  if (!side.items.length) return <p className="empty">{t(lang, 'emptyHanded')}</p>
  const hintId = mode === 'hypernoob' ? assist?.hint?.id : undefined

  const row = (it: Item) => {
    // in the noob modes, an object opens the list of what can be done with it
    const actions = mode !== 'classic' && assist ? assist.choices.filter((c) => c.obj === it.obj) : []
    const hinted = actions.some((c) => c.id === hintId)
    const body = (
      <>
        <ItemIcon id={it.id} kind={it.kind} lit={it.lit} />
        <span className="item-name">{it.name}</span>
      </>
    )
    return (
      <li key={it.obj}>
        {actions.length ? (
          <button className={`item ${hinted ? 'hint' : ''}`} aria-expanded={open === it.obj} onClick={() => setOpen(open === it.obj ? null : it.obj)}>
            {body}
          </button>
        ) : (
          <div className="item">{body}</div>
        )}
        {open === it.obj && actions.length > 0 && (
          <div className="choice-list item-actions">
            {actions.map((c) => (
              <button key={c.id} className={`choice ${c.id === hintId ? 'hint' : ''}`} onClick={() => play(c)}>
                {c.label}
              </button>
            ))}
          </div>
        )}
        {it.contents.length > 0 && <ul className="inventory">{it.contents.map(row)}</ul>}
      </li>
    )
  }
  return <ul className="inventory">{side.items.map(row)}</ul>
}

function TreasureTracker() {
  const side = useGame((s) => s.side)
  const lang = useGame((s) => s.settings.lang)
  if (!side) return null
  const { slots, found, inCase } = side.treasures
  return (
    <div className="treasures">
      <p className="treasure-count">
        {t(lang, 'inCase', inCase, slots.length)} · {t(lang, 'foundCount', found)}
      </p>
      <ul className="treasure-grid">
        {slots.map((s, i) => (
          <li key={i} className={`slot ${s.state}`} title={s.state === 'unknown' ? t(lang, 'unknownTreasure') : s.name}>
            {s.state === 'unknown' ? <ItemIcon id={null} kind="unknown" /> : <ItemIcon id={s.id} kind="treasure" />}
            {s.state !== 'unknown' && <span>{s.name}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
