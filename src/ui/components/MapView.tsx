// The map that draws itself as you play: the rooms seen (a thumbnail of their illustration),
// the passages between them, short dashes for the exits not taken yet. Drag to move around;
// resting the pointer on a room (or touching it) shows its picture, to remember the place;
// a room can be walked to, after a confirmation.
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useGame } from '../store'
import { t } from '../i18n'
import { sceneManifest, sceneOfRoom } from '../scenes'
import zork1Map from '../../data/zork1/map.json'
import zork2Map from '../../data/zork2/map.json'
import zork3Map from '../../data/zork3/map.json'
import type { MapDir } from '../../engine/assist/map'
import type { GameId } from '../../engine/games'

const CELL = { x: 84, y: 60 }
const NODE = { w: 64, h: 36 }
/** Where each room sits on the grid (tools/map/layout.ts). */
const GRIDS: Record<GameId, Record<string, number[]>> = { zork1: zork1Map.rooms, zork2: zork2Map.rooms, zork3: zork3Map.rooms }
const STUB: Partial<Record<MapDir, [number, number]>> = {
  NORTH: [0, -1], SOUTH: [0, 1], EAST: [1, 0], WEST: [-1, 0], NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1], UP: [0.6, -1], DOWN: [-0.6, 1],
}
/** How long the mouse rests on a room before its picture shows. */
const HOVER_DELAY = 700
const PREVIEW = { w: 240, h: 165 }

const at = (game: GameId, room: string): [number, number] => {
  const [x, y] = GRIDS[game][room] ?? [0, 0]
  return [x * CELL.x, y * CELL.y]
}

/** The map, large and above everything (from the expand button of the map tab). */
export function MapOverlay() {
  const lang = useGame((s) => s.settings.lang)
  const close = useGame((s) => s.setMapLarge)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
  return (
    <div className="map-overlay" onClick={() => close(false)}>
      <div className="map-overlay-panel" role="dialog" aria-modal="true" aria-label={t(lang, 'map')} onClick={(e) => e.stopPropagation()}>
        <h2>{t(lang, 'map')}</h2>
        <MapView large />
      </div>
    </div>
  )
}

export function MapView({ large = false }: { large?: boolean }) {
  const map = useGame((s) => s.side?.map)
  const gameId = useGame((s) => s.gameId)
  const setLarge = useGame((s) => s.setMapLarge)
  const lang = useGame((s) => s.settings.lang)
  const traveling = useGame((s) => s.traveling)
  const travelTo = useGame((s) => s.travelTo)
  const [images, setImages] = useState<Set<string> | null>(null)
  const [zoom, setZoom] = useState(large ? 1.6 : 1)
  const [offset, setOffset] = useState<[number, number]>([0, 0])
  const [selected, setSelected] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [size, setSize] = useState({ w: 320, h: 260 })
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null)
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointer = useRef<string>('mouse')

  useEffect(() => {
    sceneManifest().then(setImages)
  }, [])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // back on the player whenever they move
  const here = map?.here
  useEffect(() => {
    setOffset([0, 0])
    setSelected(null)
    setPreview(null)
    setConfirming(false)
  }, [here])
  useEffect(
    () => () => {
      if (hover.current) clearTimeout(hover.current)
    },
    [],
  )

  if (!map) return null
  const [cx, cy] = at(gameId, map.here)
  const screen = (room: string): [number, number] => {
    const [x, y] = at(gameId, room)
    return [size.w / 2 + offset[0] + (x - cx) * zoom, size.h / 2 + offset[1] + (y - cy) * zoom]
  }
  const transform = `translate(${size.w / 2 + offset[0]} ${size.h / 2 + offset[1]}) scale(${zoom}) translate(${-cx} ${-cy})`

  const onDown = (e: PointerEvent) => {
    pointer.current = e.pointerType
    drag.current = { x: e.clientX, y: e.clientY, ox: offset[0], oy: offset[1], moved: false }
  }
  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 5) return
    if (!d.moved) (e.currentTarget as Element).setPointerCapture(e.pointerId)
    d.moved = true
    setPreview(null)
    setOffset([d.ox + dx, d.oy + dy])
  }
  const onUp = () => {
    // later than the click on a room, which must know whether this was a drag
    setTimeout(() => (drag.current = null))
  }
  const pick = (room: string) => {
    if (drag.current?.moved) return
    setSelected(room)
    setConfirming(false)
    // no hover on a touch screen: touching a room shows its picture
    if (pointer.current !== 'mouse') setPreview(preview === room ? null : room)
  }
  const enter = (e: PointerEvent, room: string) => {
    if (e.pointerType !== 'mouse') return
    if (hover.current) clearTimeout(hover.current)
    hover.current = setTimeout(() => setPreview(room), HOVER_DELAY)
  }
  const leave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    if (hover.current) clearTimeout(hover.current)
    setPreview(null)
  }

  const focus = selected ?? map.here
  return (
    <div className="map">
      <div className="map-view" ref={box}>
        <svg width={size.w} height={size.h} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <g transform={transform}>
            {map.links.map(([a, b]) => {
              const [x1, y1] = at(gameId, a)
              const [x2, y2] = at(gameId, b)
              return <line key={`${a}|${b}`} className="map-link" x1={x1} y1={y1} x2={x2} y2={y2} />
            })}
            {map.stubs.map(({ room, dir }) => {
              const v = STUB[dir]
              if (!v) return null
              const [x, y] = at(gameId, room)
              return <line key={`${room}-${dir}`} className="map-stub" x1={x} y1={y} x2={x + v[0] * CELL.x * 0.62} y2={y + v[1] * CELL.y * 0.62} />
            })}
            {map.rooms.map((room) => {
              const [x, y] = at(gameId, room)
              const scene = sceneOfRoom(gameId, room)
              const img = scene && images?.has(scene.id) ? `${import.meta.env.BASE_URL}scenes/${scene.id}.png` : null
              return (
                <g
                  key={room}
                  className={`map-room ${room === map.here ? 'here' : ''} ${room === selected ? 'selected' : ''}`}
                  transform={`translate(${x - NODE.w / 2} ${y - NODE.h / 2})`}
                  onClick={() => pick(room)}
                  onPointerEnter={(e) => enter(e, room)}
                  onPointerLeave={leave}
                >
                  <rect width={NODE.w} height={NODE.h} rx={3} fill={scene?.sky ?? '#2b241c'} />
                  {img && <image href={img} width={NODE.w} height={NODE.h} preserveAspectRatio="xMidYMid slice" imageRendering="pixelated" />}
                  <rect className="frame" width={NODE.w} height={NODE.h} rx={3} />
                </g>
              )
            })}
          </g>
        </svg>
        {preview && <Preview room={preview} name={map.names[preview]} at={screen(preview)} box={size} game={gameId} hasImage={!!images?.has(sceneOfRoom(gameId, preview)?.id ?? '')} />}
        <div className="map-tools">
          <button className="icon-btn" onClick={() => setZoom((z) => Math.min(1.8, z * 1.25))} aria-label={t(lang, 'zoomIn')} title={t(lang, 'zoomIn')}>
            +
          </button>
          <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.4, z / 1.25))} aria-label={t(lang, 'zoomOut')} title={t(lang, 'zoomOut')}>
            −
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              setOffset([0, 0])
              setSelected(null)
              setPreview(null)
            }}
            aria-label={t(lang, 'recenter')}
            title={t(lang, 'recenter')}
          >
            ⌖
          </button>
          {large ? (
            <button className="icon-btn" onClick={() => setLarge(false)} aria-label={t(lang, 'close')} title={t(lang, 'close')}>
              ✕
            </button>
          ) : (
            <button className="icon-btn" onClick={() => setLarge(true)} aria-label={t(lang, 'mapExpand')} title={t(lang, 'mapExpand')}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
                <path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="map-info">
        {focus === map.here ? (
          <>
            <span className="map-name">{map.names[focus]}</span>
            <span className="map-here">{t(lang, 'mapHere')}</span>
          </>
        ) : confirming ? (
          <>
            <span>{t(lang, 'goConfirm', map.names[focus])}</span>
            <button
              className="choice hint"
              disabled={traveling}
              onClick={() => {
                setConfirming(false)
                travelTo(focus)
              }}
            >
              {t(lang, 'yes')}
            </button>
            <button className="choice" onClick={() => setConfirming(false)}>
              {t(lang, 'no')}
            </button>
          </>
        ) : (
          <>
            <span className="map-name">{map.names[focus]}</span>
            <button className="choice" disabled={traveling} onClick={() => setConfirming(true)}>
              {t(lang, 'goThere')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** The picture of a room, floating next to it on the map. */
function Preview({ room, name, at: [x, y], box, game, hasImage }: { room: string; name: string; at: [number, number]; box: { w: number; h: number }; game: GameId; hasImage: boolean }) {
  const scene = sceneOfRoom(game, room)
  const w = Math.min(PREVIEW.w, box.w - 16)
  const left = Math.max(8, Math.min(box.w - w - 8, x - w / 2))
  // above the room when there is space for it, else below
  const above = y - NODE.h / 2 - PREVIEW.h - 8
  const top = above > 4 ? above : Math.min(box.h - PREVIEW.h - 4, y + NODE.h / 2 + 8)
  return (
    <div className="map-preview" style={{ left, top, width: w }} aria-hidden="true">
      {scene && hasImage ? (
        <img src={`${import.meta.env.BASE_URL}scenes/${scene.id}.png`} alt="" />
      ) : (
        <div className="scene-placeholder" style={{ ['--sky' as string]: scene?.sky, ['--ground' as string]: scene?.ground }} />
      )}
      <span>{name}</span>
    </div>
  )
}
