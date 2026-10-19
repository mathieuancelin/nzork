// Local review page for the generated candidates:  npm run images:review  → http://localhost:5180
// One tab per game (/?game=zork2), each with its scenes and its object icons (&kind=items). One
// foldable block per image: the prompt, the current image, the candidates (raw and pixelized).
// Choosing a candidate publishes it in public/scenes/ (or public/items/), folds the block and
// opens the next one still to choose, without reloading the page.
import { createServer } from 'node:http'
import { copyFileSync, existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { KINDS, candidates, ensureDir, kinds, loadPrompts, readManifest, writeManifest, type Kind, type KindName } from './lib/common'
import { loadPalette, pixelize, pixelizeItem } from './lib/pixel'
import { GAMES, GAME_IDS, isGameId } from '../../src/engine/games'

const PORT = Number(process.env.PORT ?? 5180)
// candidates, approved and published images are shared by the games
const ALLOWED = Object.values(KINDS).flatMap((k) => [k.out, k.public, k.approved].map((d) => resolve(d)))
const kindOf = (name: string | null | undefined, game?: string | null): Kind => kinds(isGameId(game) ? game : 'zork1')[(name === 'items' ? 'items' : 'scenes') as KindName]
const pixelizeFor = (kind: Kind) => (kind.name === 'items' ? pixelizeItem : pixelize)

function safe(path: string): string | null {
  const p = resolve(path)
  return ALLOWED.some((d) => p.startsWith(d + '/')) && existsSync(p) ? p : null
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const fileUrl = (p: string) => `/file?path=${encodeURIComponent(p)}`

/** The candidate that was approved (same bytes as the approved copy). */
function chosenCandidate(kind: Kind, id: string, cands: string[]): string | null {
  const approved = join(kind.approved, `${id}.png`)
  if (!existsSync(approved)) return null
  const size = statSync(approved).size
  const bytes = readFileSync(approved)
  return cands.find((c) => statSync(c).size === size && readFileSync(c).equals(bytes)) ?? null
}

/** "12 / 69": the images of a game already chosen, out of all its prompts. */
function tally(kind: Kind): string {
  const ids = Object.keys(loadPrompts(kind).entries)
  const done = readManifest(kind)
  return `${ids.filter((id) => done.has(id)).length} / ${ids.length}`
}

function page(kind: Kind): string {
  const items = kind.name === 'items'
  const gameArg = kind.game === 'zork1' ? '' : `--game ${kind.game} `
  const prompts = loadPrompts(kind)
  const done = readManifest(kind)
  const ids = Object.keys(prompts.entries).sort((a, b) => Number(!!prompts.entries[b].keystone) - Number(!!prompts.entries[a].keystone))
  const now = Date.now()
  // only the first block still to choose is open: the others open one after the other
  const firstPending = ids.find((id) => !done.has(id) && candidates(id, kind).length)
  const blocks = ids
    .map((id) => {
      const s = prompts.entries[id]
      const cands = candidates(id, kind)
      const isDone = done.has(id)
      const chosen = isDone ? chosenCandidate(kind, id, cands) : null
      const finalUrl = `${fileUrl(join(kind.public, id + '.png'))}&t=${now}`
      return `<details class="scene" id="${id}" data-done="${isDone}" data-count="${cands.length}"${id === firstPending ? ' open' : ''}>
  <summary>
    <span class="chev">▸</span>
    <img class="thumb" ${isDone ? `src="${finalUrl}"` : ''} alt="">
    <span class="name">${esc(id)}</span>
    ${s.keystone ? `<span class="key">${items ? 'objet clé' : 'scène clé'}</span>` : ''}
    <span class="status"></span>
  </summary>
  <div class="body">
    <details class="prompt"><summary>Prompt</summary><p>${esc(s.prompt)}</p></details>
    ${isDone ? `<p class="current">Image actuelle : <img class="final" src="${finalUrl}" alt=""></p>` : ''}
    <div class="grid">${cands
      .map(
        (c) => `<figure${c === chosen ? ' class="chosen"' : ''} data-path="${encodeURIComponent(c)}">
        <img src="${fileUrl(c)}" loading="lazy" alt="">
        <img class="px" src="/preview?kind=${kind.name}&path=${encodeURIComponent(c)}" loading="lazy" title="Aperçu après post-traitement" alt="">
        <figcaption>
          <button class="choose">${c === chosen ? '✓ Choisie' : 'Choisir'}</button>
          <button class="del">Supprimer</button>
        </figcaption></figure>`,
      )
      .join('')}</div>
    ${cands.length ? '' : `<p class="none">Aucun candidat : npm run images:generate -- ${gameArg}${items ? '--items ' : ''}--ids ${id}</p>`}
  </div>
</details>`
    })
    .join('\n')

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Atelier des illustrations</title>
<style>
body{background:#0c0a07;color:#eadfc4;font:15px ui-monospace,Menlo,monospace;margin:0}
header{position:sticky;top:0;z-index:5;background:#15120d;border-bottom:1px solid #3b3226;padding:10px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:14px}
h1{color:#f4c96b;font-size:20px;margin:0}
.progress{flex:1;min-width:200px;display:flex;align-items:center;gap:10px}
.bar{flex:1;height:8px;background:#2b241c;border-radius:4px;overflow:hidden}.bar i{display:block;height:100%;background:#8fc47f;width:0}
main{padding:10px 20px 60px}
.palette{color:#a39679;font-size:13px;margin:6px 0 12px}
details.scene{border:1px solid #3b3226;border-radius:8px;margin:8px 0;background:#110e0a;scroll-margin-top:64px}
details.scene>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:8px 12px}
details.scene>summary::-webkit-details-marker{display:none}
.chev{color:#a39679;transition:transform .15s} details[open]>summary .chev{transform:rotate(90deg)}
.thumb{width:96px;height:54px;object-fit:cover;image-rendering:pixelated;border-radius:3px;background:#1d1912;flex-shrink:0}
.thumb:not([src]){visibility:hidden}
.name{color:#f4c96b;font-size:16px}
.key{background:#e3a83c;color:#000;padding:1px 6px;border-radius:4px;font-size:12px}
.status{margin-left:auto;font-size:13px;color:#a39679}
details[data-done="true"] .status{color:#8fc47f}
details[data-done="true"]{border-color:#2f4a24}
.body{padding:0 12px 12px}
.prompt summary{cursor:pointer;color:#a39679} .prompt p{max-width:900px;line-height:1.5}
.current img{max-width:480px;width:100%;image-rendering:pixelated;display:block;margin-top:6px;border-radius:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-top:8px}
figure{margin:0;background:#15120d;border:1px solid #3b3226;border-radius:8px;padding:6px}
figure.chosen{border:2px solid #8fc47f}
figure img{width:100%;display:block;border-radius:4px} img.px{image-rendering:pixelated;margin-top:4px}
figcaption{display:flex;gap:8px;margin-top:6px}
button{background:#1d1912;color:#eadfc4;border:1px solid #e3a83c;border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit}
button:disabled{opacity:.5;cursor:wait}
button.del{border-color:#d9685f;color:#d9685f}
figure.chosen button.choose{border-color:#8fc47f;color:#8fc47f}
.none{color:#6f6552}
body.hide-done details[data-done="true"]{display:none}
nav a{color:#a39679;text-decoration:none;padding:4px 10px;border:1px solid #3b3226;border-radius:6px}nav a.on{color:#f4c96b;border-color:#e3a83c}nav small{color:#6f6552}
.items .grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.items .thumb{width:54px;height:54px;object-fit:contain}
.items img.px,.items .current img{width:192px;max-width:192px;background:repeating-conic-gradient(#2b241c 0 25%,#1d1912 0 50%) 0 0/16px 16px;border-radius:4px}
label{cursor:pointer;color:#a39679}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1d1912;border:1px solid #e3a83c;border-radius:8px;padding:8px 14px;display:none}
</style></head><body class="${kind.name}">
<header>
  <h1>Atelier des illustrations</h1>
  <nav>${GAME_IDS.map((g) => `<a href="/?game=${g}${items ? '&kind=items' : ''}" class="${g === kind.game ? 'on' : ''}">${GAMES[g].title} <small>${tally(kinds(g)[kind.name])}</small></a>`).join(' ')}</nav>
  <nav><a href="/?game=${kind.game}" class="${items ? '' : 'on'}">Scènes <small>${tally(kinds(kind.game).scenes)}</small></a> <a href="/?game=${kind.game}&kind=items" class="${items ? 'on' : ''}">Objets <small>${tally(kinds(kind.game).items)}</small></a></nav>
  <div class="progress"><span id="count"></span><div class="bar"><i id="bar"></i></div></div>
  <label><input type="checkbox" id="hide"> Masquer ${items ? 'les objets choisis' : 'les scènes choisies'}</label>
  <button id="next">${items ? 'Objet suivant à choisir' : 'Scène suivante à choisir'} ↓</button>
</header>
<main>
<p class="palette">Palette : ${loadPalette().length} couleurs. Chaque candidat montre l'image brute puis l'aperçu pixelisé (${items ? 'icône 48×48 détourée, agrandie ×4' : '480×270'}, palette commune). Choisir une image la publie, replie le bloc et ouvre le suivant.</p>
${blocks || `<p class="none">Aucun prompt pour ${GAMES[kind.game].title} : voir ${esc(kind.prompts)}</p>`}
</main>
<div class="toast" id="toast"></div>
<script>
const scenes = [...document.querySelectorAll('details.scene')]
const PUBLIC = ${JSON.stringify(kind.public)}
const KIND = ${JSON.stringify(kind.name)}
const GAME = ${JSON.stringify(kind.game)}

function status(d) {
  const n = d.querySelectorAll('figure').length
  const s = d.querySelector('.status')
  if (d.dataset.done === 'true') s.textContent = '✓ choisie'
  else s.textContent = n ? n + ' candidat' + (n > 1 ? 's' : '') + ' à départager' : 'aucun candidat'
}

function progress() {
  const done = scenes.filter((d) => d.dataset.done === 'true').length
  document.getElementById('count').textContent = done + ' / ' + scenes.length + ' choisies'
  document.getElementById('bar').style.width = (100 * done / scenes.length) + '%'
}

function nextPending(after) {
  const start = after ? scenes.indexOf(after) + 1 : 0
  const order = [...scenes.slice(start), ...scenes.slice(0, start)]
  return order.find((d) => d.dataset.done !== 'true' && d.querySelector('figure'))
}

function goTo(d) {
  if (!d) { toast('Tout ce qui a des candidats est choisi.'); return }
  d.open = true
  d.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function toast(text) {
  const t = document.getElementById('toast')
  t.textContent = text
  t.style.display = 'block'
  clearTimeout(t._h)
  t._h = setTimeout(() => (t.style.display = 'none'), 2500)
}

async function post(kind, id, path) {
  const r = await fetch('/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, path, kind: KIND, game: GAME }) })
  if (!r.ok) throw new Error(await r.text())
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button.choose, button.del')
  if (!btn) return
  const fig = btn.closest('figure')
  const d = btn.closest('details.scene')
  const path = decodeURIComponent(fig.dataset.path)
  btn.disabled = true
  try {
    if (btn.classList.contains('del')) {
      await post('reject', d.id, path)
      fig.remove()
      status(d)
      return
    }
    await post('approve', d.id, path)
    const url = '/file?path=' + encodeURIComponent(PUBLIC + '/' + d.id + '.png') + '&t=' + Date.now()
    d.querySelector('.thumb').src = url
    d.querySelectorAll('figure').forEach((f) => {
      f.classList.toggle('chosen', f === fig)
      f.querySelector('button.choose').textContent = f === fig ? '✓ Choisie' : 'Choisir'
    })
    let cur = d.querySelector('.current')
    if (!cur) {
      cur = document.createElement('p')
      cur.className = 'current'
      d.querySelector('.prompt').after(cur)
    }
    cur.innerHTML = 'Image actuelle : <img src="' + url + '" alt="">'
    d.dataset.done = 'true'
    d.open = false
    status(d)
    progress()
    goTo(nextPending(d))
  } catch (err) {
    toast('Erreur : ' + err.message)
  } finally {
    btn.disabled = false
  }
})

document.getElementById('next').onclick = () => goTo(nextPending(null))
const hide = document.getElementById('hide')
try { hide.checked = localStorage.getItem('atelier-hide') === '1' } catch {}
document.body.classList.toggle('hide-done', hide.checked)
hide.onchange = () => {
  document.body.classList.toggle('hide-done', hide.checked)
  try { localStorage.setItem('atelier-hide', hide.checked ? '1' : '0') } catch {}
}
scenes.forEach(status)
progress()
</script></body></html>`
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(page(kindOf(url.searchParams.get('kind'), url.searchParams.get('game'))))
    }
    if (url.pathname === '/file' || url.pathname === '/preview') {
      const p = safe(url.searchParams.get('path') ?? '')
      if (!p) return res.writeHead(404).end()
      const body = url.pathname === '/file' ? readFileSync(p) : await pixelizeFor(kindOf(url.searchParams.get('kind')))(readFileSync(p), loadPalette())
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' })
      return res.end(body)
    }
    if (req.method === 'POST' && (url.pathname === '/approve' || url.pathname === '/reject')) {
      let raw = ''
      for await (const chunk of req) raw += chunk
      const { id, path, kind: kindName, game } = JSON.parse(raw) as { id: string; path: string; kind?: string; game?: string }
      const kind = kindOf(kindName, game)
      const p = safe(path)
      if (!p || !/^[a-z0-9-]+$/.test(id)) return res.writeHead(400).end('bad request')
      if (url.pathname === '/reject') {
        unlinkSync(p)
        return res.writeHead(200).end('ok')
      }
      copyFileSync(p, join(ensureDir(kind.approved), `${id}.png`))
      ensureDir(kind.public)
      writeFileSync(join(kind.public, `${id}.png`), await pixelizeFor(kind)(readFileSync(p), loadPalette()))
      const manifest = readManifest(kind)
      manifest.add(id)
      writeManifest(manifest, kind)
      if (loadPrompts(kind).entries[id]?.keystone) copyFileSync(p, join(ensureDir(kind.references), `${id}.png`))
      return res.writeHead(200).end('ok')
    }
    res.writeHead(404).end()
  } catch (e) {
    res.writeHead(500).end(String(e))
  }
}).listen(PORT, () => console.log(`Atelier des illustrations : http://localhost:${PORT}`))
