// Menu, save slots, settings, help and about dialogs.
import { useEffect, useRef, useState } from 'react'
import { useGame, type Mode } from '../store'
import { t } from '../i18n'
import { AUTOSAVE, SLOT_COUNT, exportAll, importAll } from '../saves'

function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  const close = useGame((s) => s.openModal)
  const lang = useGame((s) => s.settings.lang)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
  return (
    <div className="backdrop" onClick={() => close(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={() => close(null)}>
            {t(lang, 'close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Modals() {
  const modal = useGame((s) => s.modal)
  if (modal === 'menu') return <MenuModal />
  if (modal === 'saves') return <SavesModal />
  if (modal === 'settings') return <SettingsModal />
  if (modal === 'help') return <HelpModal />
  if (modal === 'about') return <AboutModal />
  if (modal === 'welcome') return <WelcomeModal />
  return null
}

function WelcomeModal() {
  const settings = useGame((s) => s.settings)
  const set = useGame((s) => s.setSetting)
  const close = useGame((s) => s.openModal)
  const lang = settings.lang
  const modes: [Mode, string, string][] = [
    ['classic', t(lang, 'modeClassic'), t(lang, 'modeClassicHint')],
    ['noob', t(lang, 'modeNoob'), t(lang, 'modeNoobHint')],
    ['hypernoob', t(lang, 'modeHyper'), t(lang, 'modeHyperHint')],
  ]
  return (
    <Modal title={lang === 'fr' ? 'Bienvenue dans Zork' : 'Welcome to Zork'}>
      <p>
        {lang === 'fr'
          ? 'Vous vous tenez devant une maison blanche, à l’orée du Grand Empire Souterrain. Trésors, énigmes et un grue qui rôde dans le noir vous attendent. Comment voulez-vous jouer ?'
          : 'You stand before a white house, at the edge of the Great Underground Empire. Treasures, puzzles and a lurking grue await. How do you want to play?'}
      </p>
      {modes.map(([m, label, hint]) => (
        <button
          key={m}
          className={`option ${settings.mode === m ? 'selected' : ''}`}
          style={{ width: '100%', textAlign: 'left', background: 'transparent' }}
          onClick={() => {
            set('mode', m)
            close(null)
          }}
        >
          <span>
            {label}
            <small>{hint}</small>
          </span>
        </button>
      ))}
      <p style={{ color: 'var(--muted)', fontSize: '0.9em' }}>
        {lang === 'fr' ? 'Vous pourrez changer de mode à tout moment dans le menu ☰ > Réglages.' : 'You can change the mode anytime in the ☰ menu > Settings.'}
      </p>
    </Modal>
  )
}

function MenuModal() {
  const lang = useGame((s) => s.settings.lang)
  const open = useGame((s) => s.openModal)
  const newGame = useGame((s) => s.newGame)
  return (
    <Modal title={t(lang, 'menu')}>
      <div className="menu-list">
        <button
          className="btn"
          onClick={() => {
            if (window.confirm(t(lang, 'confirmRestart'))) {
              newGame()
              open(null)
            }
          }}
        >
          {t(lang, 'newGame')}
        </button>
        <button className="btn" onClick={() => open('saves', 'save')}>
          {t(lang, 'save')}
        </button>
        <button className="btn" onClick={() => open('saves', 'load')}>
          {t(lang, 'load')}
        </button>
        <button className="btn" onClick={() => open('settings')}>
          {t(lang, 'settings')}
        </button>
        <button className="btn" onClick={() => open('help')}>
          {t(lang, 'help')}
        </button>
        <button className="btn" onClick={() => open('about')}>
          {t(lang, 'about')}
        </button>
      </div>
    </Modal>
  )
}

function formatDate(iso: string, lang: string) {
  try {
    return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function SavesModal() {
  const lang = useGame((s) => s.settings.lang)
  const tab = useGame((s) => s.savesTab)
  const slots = useGame((s) => s.slots)
  const autosave = useGame((s) => s.autosave)
  const saveTo = useGame((s) => s.saveTo)
  const loadFrom = useGame((s) => s.loadFrom)
  const removeSlot = useGame((s) => s.removeSlot)
  const refresh = useGame((s) => s.refreshSlots)
  const open = useGame((s) => s.openModal)
  const toast = useGame((s) => s.showToast)
  const status = useGame((s) => s.status)
  const file = useRef<HTMLInputElement>(null)
  const [names, setNames] = useState<Record<number, string>>({})

  const doExport = () => {
    const blob = new Blob([exportAll()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'zork-sauvegardes.zork.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doImport = async (f: File) => {
    try {
      const n = importAll(await f.text())
      refresh()
      toast(t(lang, 'imported', n))
    } catch {
      toast(t(lang, 'importFailed'))
    }
  }

  return (
    <Modal title={tab === 'save' ? t(lang, 'save') : t(lang, 'load')}>
      <div className="tabs" role="tablist">
        <button className="btn" role="tab" aria-selected={tab === 'save'} onClick={() => open('saves', 'save')}>
          {t(lang, 'save')}
        </button>
        <button className="btn" role="tab" aria-selected={tab === 'load'} onClick={() => open('saves', 'load')}>
          {t(lang, 'load')}
        </button>
      </div>
      {tab === 'load' && autosave && (
        <div className="slot">
          <span className="num">A</span>
          <div className="info">
            <div className="name">{t(lang, 'autosave')}</div>
            <div className="meta">
              {autosave.save.status.room} · {autosave.save.status.score} pts · {formatDate(autosave.date, lang)}
            </div>
          </div>
          <button className="btn primary" onClick={() => loadFrom(AUTOSAVE)}>
            {t(lang, 'loadThis')}
          </button>
        </div>
      )}
      {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((n) => {
        const slot = slots[n - 1]
        return (
          <div key={n} className={`slot ${slot ? '' : 'empty'}`}>
            <span className="num">{n}</span>
            <div className="info">
              {tab === 'save' ? (
                <input
                  className="name"
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', outline: 'none' }}
                  aria-label={t(lang, 'rename')}
                  placeholder={slot?.name ?? `${status?.room ?? ''} — ${status?.score ?? 0} pts`}
                  value={names[n] ?? ''}
                  onChange={(e) => setNames({ ...names, [n]: e.target.value })}
                />
              ) : (
                <div className="name">{slot ? slot.name : t(lang, 'empty')}</div>
              )}
              {slot && (
                <div className="meta">
                  {slot.save.status.room} · {slot.save.status.score} pts · {slot.save.status.moves} {t(lang, 'moves').toLowerCase()} · {formatDate(slot.date, lang)}
                </div>
              )}
            </div>
            {tab === 'save' ? (
              <button className="btn primary" onClick={() => (!slot || window.confirm(t(lang, 'confirmOverwrite'))) && saveTo(n, names[n])}>
                {t(lang, 'saveHere')}
              </button>
            ) : (
              slot && (
                <>
                  <button className="btn primary" onClick={() => loadFrom(n)}>
                    {t(lang, 'loadThis')}
                  </button>
                  <button className="btn danger" onClick={() => window.confirm(t(lang, 'confirmDelete')) && removeSlot(n)} aria-label={t(lang, 'delete')}>
                    ✕
                  </button>
                </>
              )
            )}
          </div>
        )
      })}
      <div className="row">
        <button className="btn" onClick={doExport}>
          {t(lang, 'export')}
        </button>
        <button className="btn" onClick={() => file.current?.click()}>
          {t(lang, 'import')}
        </button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      </div>
    </Modal>
  )
}

function SettingsModal() {
  const settings = useGame((s) => s.settings)
  const set = useGame((s) => s.setSetting)
  const lang = settings.lang
  const modes: [Mode, string, string][] = [
    ['classic', t(lang, 'modeClassic'), t(lang, 'modeClassicHint')],
    ['noob', t(lang, 'modeNoob'), t(lang, 'modeNoobHint')],
    ['hypernoob', t(lang, 'modeHyper'), t(lang, 'modeHyperHint')],
  ]
  return (
    <Modal title={t(lang, 'settings')}>
      <h3>{t(lang, 'mode')}</h3>
      {modes.map(([m, label, hint]) => (
        <label key={m} className={`option ${settings.mode === m ? 'selected' : ''}`}>
          <input type="radio" name="mode" checked={settings.mode === m} onChange={() => set('mode', m)} />
          <span>
            {label}
            <small>{hint}</small>
          </span>
        </label>
      ))}
      <h3>{t(lang, 'settings')}</h3>
      <div className="setting">
        <span>{t(lang, 'language')}</span>
        <select value={settings.lang} onChange={(e) => set('lang', e.target.value as 'fr' | 'en')}>
          <option value="fr">Français</option>
          <option value="en">English (original)</option>
        </select>
      </div>
      <div className="setting">
        <span>{t(lang, 'fontSize')}</span>
        <select value={settings.fontSize} onChange={(e) => set('fontSize', e.target.value as 's' | 'm' | 'l')}>
          <option value="s">A−</option>
          <option value="m">A</option>
          <option value="l">A+</option>
        </select>
      </div>
      <Toggle label={t(lang, 'images')} value={settings.images} onChange={(v) => set('images', v)} />
      <Toggle label={t(lang, 'typewriter')} value={settings.typewriter} onChange={(v) => set('typewriter', v)} />
      <Toggle label={t(lang, 'crt')} value={settings.crt} onChange={(v) => set('crt', v)} />
      <Toggle label={t(lang, 'undoSetting')} value={settings.undo} onChange={(v) => set('undo', v)} />
    </Modal>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function HelpModal() {
  const lang = useGame((s) => s.settings.lang)
  if (lang === 'en') {
    return (
      <Modal title="Help">
        <p>Type commands such as <kbd>open mailbox</kbd>, <kbd>north</kbd> (or <kbd>n</kbd>), <kbd>take lamp</kbd>, <kbd>inventory</kbd> (<kbd>i</kbd>), <kbd>look</kbd> (<kbd>l</kbd>).</p>
        <p>The interface also understands <kbd>save</kbd>, <kbd>load</kbd>, <kbd>undo</kbd> (<kbd>Ctrl+Z</kbd>) and <kbd>restart</kbd>.</p>
        <p>In the Noob modes, click the suggested actions; in Hyper noob mode the right one is circled in gold.</p>
      </Modal>
    )
  }
  return (
    <Modal title="Aide">
      <p>
        Tapez des commandes en français, à l'impératif ou à l'infinitif : <kbd>ouvre la boîte aux lettres</kbd>, <kbd>prendre la lanterne</kbd>, <kbd>mets l'épée dans la vitrine</kbd>, <kbd>tue le troll avec l'épée</kbd>.
      </p>
      <h3>Se déplacer</h3>
      <p>
        <kbd>nord</kbd> (<kbd>n</kbd>), <kbd>sud</kbd> (<kbd>s</kbd>), <kbd>est</kbd> (<kbd>e</kbd>), <kbd>ouest</kbd> (<kbd>o</kbd>), <kbd>ne</kbd>, <kbd>no</kbd>, <kbd>se</kbd>, <kbd>so</kbd>, <kbd>monter</kbd> (<kbd>h</kbd>), <kbd>descendre</kbd> (<kbd>b</kbd>), <kbd>entrer</kbd>, <kbd>sortir</kbd>.
      </p>
      <h3>Raccourcis</h3>
      <p>
        <kbd>i</kbd> inventaire · <kbd>r</kbd> regarder · <kbd>x objet</kbd> examiner · <kbd>z</kbd> attendre · <kbd>g</kbd> encore · <kbd>prends tout</kbd> · <kbd>prends tout sauf l'épée</kbd> · <kbd>prends la lanterne puis va au nord</kbd>
      </p>
      <h3>L'interface</h3>
      <p>
        <kbd>sauvegarder</kbd>, <kbd>charger</kbd>, <kbd>annuler</kbd> (ou <kbd>Ctrl+Z</kbd>), <kbd>recommencer</kbd>, <kbd>aide</kbd>. La partie est enregistrée automatiquement à chaque coup.
      </p>
      <h3>Modes de jeu</h3>
      <p>
        En mode Noob, des actions à cliquer sont proposées à chaque tour. En mode Hyper noob, la bonne action est cerclée de doré et « Pourquoi ? » vous explique l'idée.
      </p>
    </Modal>
  )
}

function AboutModal() {
  const lang = useGame((s) => s.settings.lang)
  return (
    <Modal title={t(lang, 'about')}>
      <p>
        <b>Zork I : Le Grand Empire Souterrain</b> — Marc Blank, Dave Lebling, Bruce Daniels et Tim Anderson, Infocom, 1980. Sources publiées par Microsoft sous licence MIT (2025).
      </p>
      <p>
        Cette version fait tourner le jeu original (fichier <code>zork1.z3</code>, Release 119) dans une machine Z écrite en TypeScript, avec une traduction française, des modes d'aide et des illustrations.
      </p>
    </Modal>
  )
}
