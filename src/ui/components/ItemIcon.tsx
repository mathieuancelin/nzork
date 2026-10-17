// The picture of an object, or a pixel glyph of its kind while pictures are not generated.
import { useEffect, useState, type ReactElement } from 'react'
import type { ItemKind } from '../../engine/assist/items'
import { itemImageId, itemManifest } from '../items'

// 12×12 glyphs: '#' full, '+' half-tone
const GLYPHS: Record<ItemKind | 'unknown', string[]> = {
  treasure: [
    '............',
    '...######...',
    '..#+#++#+#..',
    '.#++#++#++#.',
    '############',
    '.#+#++++#+#.',
    '..#+#++#+#..',
    '...#+##+#...',
    '....#++#....',
    '.....##.....',
    '............',
    '............',
  ],
  light: [
    '.....##.....',
    '....#..#....',
    '...######...',
    '...#.++.#...',
    '...#+##+#...',
    '...#+##+#...',
    '...#.++.#...',
    '...######...',
    '....####....',
    '...######...',
    '............',
    '............',
  ],
  weapon: [
    '..........##',
    '.........#+#',
    '........#+#.',
    '.......#+#..',
    '......#+#...',
    '.....#+#....',
    '..#.#+#.....',
    '...#+#......',
    '...##.......',
    '..#..#......',
    '.#..........',
    '#...........',
  ],
  paper: [
    '............',
    '..########..',
    '..#++++++#..',
    '..#.####.#..',
    '..#......#..',
    '..#.####.#..',
    '..#......#..',
    '..#.###..#..',
    '..#......#..',
    '..########..',
    '............',
    '............',
  ],
  food: [
    '......#.....',
    '.....#......',
    '...##.##....',
    '..#+++++#...',
    '.#+++++++#..',
    '.#+++++++#..',
    '.#+++++++#..',
    '..#+++++#...',
    '...#####....',
    '............',
    '............',
    '............',
  ],
  container: [
    '....#..#....',
    '.....##.....',
    '....####....',
    '...#....#...',
    '..#......#..',
    '.#..++++..#.',
    '.#.++++++.#.',
    '.#..++++..#.',
    '..#......#..',
    '...######...',
    '............',
    '............',
  ],
  tool: [
    '##..........',
    '#.#.........',
    '.#.#........',
    '..#.#.......',
    '...#+#......',
    '....#+#.....',
    '.....#+#....',
    '......#+#...',
    '.......#+#..',
    '........#+#.',
    '.........###',
    '............',
  ],
  thing: [
    '............',
    '..########..',
    '.#+++++++##.',
    '##########+#',
    '#........#+#',
    '#........#+#',
    '#........#+#',
    '#........#+#',
    '#........##.',
    '##########..',
    '............',
    '............',
  ],
  unknown: [
    '............',
    '....####....',
    '...#....#...',
    '...#....#...',
    '........#...',
    '.......#....',
    '......#.....',
    '......#.....',
    '............',
    '......#.....',
    '............',
    '............',
  ],
}

const rendered = new Map<string, ReactElement[]>()

function glyph(kind: ItemKind | 'unknown'): ReactElement[] {
  let rects = rendered.get(kind)
  if (!rects) {
    rects = []
    GLYPHS[kind].forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c !== '.') rects!.push(<rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} opacity={c === '+' ? 0.4 : 1} />)
      }),
    )
    rendered.set(kind, rects)
  }
  return rects
}

function useItemManifest(): Set<string> | null {
  const [available, setAvailable] = useState<Set<string> | null>(null)
  useEffect(() => {
    let live = true
    itemManifest().then((m) => live && setAvailable(m))
    return () => {
      live = false
    }
  }, [])
  return available
}

export function ItemIcon({ id, kind, lit }: { id: string | null; kind: ItemKind | 'unknown'; lit?: boolean }) {
  const available = useItemManifest()
  const image = id ? itemImageId(id) : null
  const cls = `item-icon k-${kind} ${lit ? 'lit' : ''}`
  if (image && available?.has(image)) return <img className={cls} src={`${import.meta.env.BASE_URL}items/${image}.png`} alt="" />
  return (
    <svg className={cls} viewBox="0 0 12 12" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      {glyph(kind)}
    </svg>
  )
}
