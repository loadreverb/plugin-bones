import { describe, expect, test } from 'bun:test'
import type { OpeningSlice, WallSlice } from '../src/core/types'
import { generateVisualBones } from '../src/pl-visual/engine'
import { masonryWallParts } from '../src/pl-visual/masonry'
import { PL_PRESETS, type PlWallTechnology } from '../src/pl-visual/presets'
import golden from './fixtures/pl-demo-house.json'

/** PBV-03 — metric masonry course engine. Visual illustration only. */

const LEVEL = 'level_test'
const EPS = 1e-6

const mkWall = (over: Partial<WallSlice> = {}): WallSlice => ({
  id: 'w1',
  start: [0, 0],
  end: [3, 0],
  length: 3,
  dir: [1, 0],
  thickness: 0.25,
  height: 2.8,
  exterior: true,
  openings: [],
  curved: false,
  ...over,
})

const mkOpening = (over: Partial<OpeningSlice> = {}): OpeningSlice => ({
  id: 'op1',
  kind: 'door',
  u: 1.5,
  width: 0.9,
  height: 2.05,
  sillHeight: 0,
  roughWidth: 1.0,
  roughHeight: 2.15,
  ...over,
})

const tech = (id: string): Extract<PlWallTechnology, { family: 'masonry' }> => {
  const t = PL_PRESETS.wallTechnologies.find((x) => x.id === id)
  if (!t || t.family !== 'masonry') throw new Error(`no masonry tech ${id}`)
  return t
}

/** Wall-local rect of an axis-aligned-wall piece (position.x == u-center). */
const rectOf = (p: { position: [number, number, number]; dims: [number, number, number] }): readonly [number, number, number, number] =>
  [p.position[0] - p.dims[0] / 2, p.position[1] - p.dims[1] / 2,
   p.position[0] + p.dims[0] / 2, p.position[1] + p.dims[1] / 2]

const overlaps = (a: readonly [number, number, number, number], b: readonly [number, number, number, number]) =>
  a[0] < b[2] - 1e-6 && a[2] > b[0] + 1e-6 && a[1] < b[3] - 1e-6 && a[3] > b[1] + 1e-6

describe('PBV-03 · one engine, three metric modules', () => {
  test('ceramic/aac/silicate produce distinct layouts for the same wall', () => {
    const wall = mkWall({ openings: [mkOpening()] })
    const counts = ['ceramic', 'aac', 'silicate'].map(
      (id) => masonryWallParts(wall, LEVEL, id, tech(id)).parts.length,
    )
    expect(counts[0]).toBeGreaterThan(0)
    expect(new Set(counts).size).toBe(3)

    const ceramic = masonryWallParts(wall, LEVEL, 'ceramic', tech('ceramic')).parts
    const aac = masonryWallParts(wall, LEVEL, 'aac', tech('aac')).parts
    // block heights follow the preset module heights (bottom course, full height)
    expect(ceramic[0]!.dims[1]).toBeCloseTo(0.238, 6)
    expect(aac[0]!.dims[1]).toBeCloseTo(0.24, 6)
    // module lengths differ → first-course widths differ
    expect(ceramic[0]!.dims[0]).toBeCloseTo(0.25, 6)
    expect(aac[0]!.dims[0]).toBeCloseTo(0.6, 6)
  })

  test('material IDs follow the preset', () => {
    const parts = masonryWallParts(mkWall(), LEVEL, 'silicate', tech('silicate')).parts
    for (const p of parts) expect(p.materialId).toBe('silicate_gray')
  })
})

describe('PBV-03 · openings are voids', () => {
  const wall = mkWall({
    openings: [
      mkOpening({ id: 'door', kind: 'door', u: 0.8 }),
      mkOpening({
        id: 'win', kind: 'window', u: 2.3, width: 1.2, height: 1.2,
        sillHeight: 0.9, roughWidth: 1.3, roughHeight: 1.3,
      }),
    ],
  })
  const voids = wall.openings.map((o) => [
    o.u - o.roughWidth / 2, o.sillHeight, o.u + o.roughWidth / 2, o.sillHeight + o.roughHeight,
  ] as const)
  const parts = masonryWallParts(wall, LEVEL, 'ceramic', tech('ceramic')).parts

  test('no block intersects any rough-opening void beyond epsilon', () => {
    expect(parts.length).toBeGreaterThan(20)
    for (const p of parts) {
      if (p.role === 'lintel') continue // lintel sits ABOVE the void by construction
      for (const v of voids) expect(overlaps(rectOf(p), v)).toBe(false)
    }
  })

  test('blocks exist on both sides of each opening (courses continue)', () => {
    const left = parts.filter((p) => p.role === 'masonry-unit' && p.position[0] < 0.3)
    const mid = parts.filter(
      (p) => p.role === 'masonry-unit' && p.position[0] > 1.0 && p.position[0] < 1.6,
    )
    expect(left.length).toBeGreaterThan(0)
    expect(mid.length).toBeGreaterThan(0)
  })

  test('visual lintel fills exactly the door void band, one course high', () => {
    const lintel = parts.find((p) => p.role === 'lintel' && p.position[0] < 1.5)
    expect(lintel).toBeDefined()
    const L = lintel!
    expect(L.dims[0]).toBeCloseTo(1.0, 6)
    expect(L.dims[1]).toBeCloseTo(0.238, 6)
    expect(L.position[1] - L.dims[1] / 2).toBeCloseTo(2.15, 6)
    expect(L.materialId).toBe('concrete_raw')
  })

  test('opening reaching wall top: lintel omitted with a warning', () => {
    const low = mkWall({ height: 2.25, openings: [mkOpening()] })
    const r = masonryWallParts(low, LEVEL, 'ceramic', tech('ceramic'))
    expect(r.parts.filter((p) => p.role === 'lintel')).toHaveLength(0)
    expect(r.warnings.join('\n')).toContain('lintel omitted')
  })
})

describe('PBV-03 · geometry + determinism', () => {
  test('3 m wall: bottom course starts at u=0, top course clipped to height', () => {
    const r = masonryWallParts(mkWall(), LEVEL, 'ceramic', tech('ceramic'))
    const first = r.parts[0]!
    expect(first.position[0] - first.dims[0] / 2).toBeCloseTo(0, 6)
    expect(first.position[1] - first.dims[1] / 2).toBeCloseTo(0, 6)
    const maxTop = Math.max(...r.parts.map((p) => p.position[1] + p.dims[1] / 2))
    expect(maxTop).toBeLessThanOrEqual(2.8 + EPS)
    expect(maxTop).toBeGreaterThan(2.8 - 0.24 - EPS) // last course reached the top
  })

  test('wall rotated 90°: pieces map onto the rotated axis', () => {
    const vertical = mkWall({ start: [1, 2], end: [1, 5], length: 3, dir: [0, 1] })
    const r = masonryWallParts(vertical, LEVEL, 'ceramic', tech('ceramic'))
    expect(r.parts.length).toBeGreaterThan(0)
    for (const p of r.parts) {
      expect(p.position[0]).toBeCloseTo(1, 6) // x constant along the wall line
      expect(p.position[2]).toBeGreaterThanOrEqual(2 - EPS)
      expect(p.position[2]).toBeLessThanOrEqual(5 + EPS)
      expect(p.rotation[1]).toBeCloseTo(-Math.PI / 2, 6) // atan2(-dz, dx) = atan2(-1, 0)
    }
  })

  test('same inputs → byte-identical sorted output', () => {
    const wall = mkWall({ openings: [mkOpening()] })
    const a = masonryWallParts(wall, LEVEL, 'ceramic', tech('ceramic'))
    const b = masonryWallParts(wall, LEVEL, 'ceramic', tech('ceramic'))
    const key = (r: typeof a) => JSON.stringify([...r.parts].sort((x, y) => x.id < y.id ? -1 : 1))
    expect(key(a)).toBe(key(b))
  })

  test('preset/host thickness mismatch >3 cm warns and keeps HOST depth', () => {
    const thick = mkWall({ thickness: 0.3 })
    const r = masonryWallParts(thick, LEVEL, 'ceramic', tech('ceramic'))
    expect(r.warnings.join('\n')).toContain('thickness')
    for (const p of r.parts) expect(p.dims[2]).toBeCloseTo(0.3, 6)
  })

  test('bad preset dims are rejected', () => {
    const bad = { ...tech('ceramic'), module: { ...tech('ceramic').module, length: 0 } }
    expect(() => masonryWallParts(mkWall(), LEVEL, 'ceramic', bad)).toThrow(/invalid masonry preset/)
  })

  test('curved walls are skipped with an explicit limitation warning', () => {
    const r = masonryWallParts(mkWall({ curved: true }), LEVEL, 'ceramic', tech('ceramic'))
    expect(r.parts).toHaveLength(0)
    expect(r.warnings.join('\n')).toContain('curved')
  })
})

describe('PBV-03 · golden house through generateVisualBones', () => {
  const nodes = golden.nodes as Record<string, Record<string, unknown>>
  const CERAMIC = { technology: 'ceramic', foundation: 'raft', floor: 'concrete_slab' } as const
  const result = generateVisualBones(nodes, CERAMIC)

  test('all four walls coursed at S2 with unique IDs and correct material', () => {
    expect(result.parts.length).toBeGreaterThan(100)
    expect(new Set(result.parts.map((p) => p.id)).size).toBe(result.parts.length)
    expect(new Set(result.parts.map((p) => p.sourceId))).toEqual(
      new Set(['wall_pl_south', 'wall_pl_east', 'wall_pl_north', 'wall_pl_west']),
    )
    for (const p of result.parts) {
      expect(p.stage).toBe('S2')
      expect(p.levelId).toBe('level_pl1')
      if (p.role === 'masonry-unit') expect(p.materialId).toBe('ceramic_red')
      expect(p.sequence).toBeGreaterThanOrEqual(2000)
    }
    expect(result.summary.stageCounts.S2).toBe(result.parts.length)
  })

  test('no piece inside the golden door/window voids (world-space check)', () => {
    // wall-local u of a piece = dot(position.xz − wall.start, wall.dir)
    const walls = [
      { id: 'wall_pl_south', start: [-3.418307, -3.649038] as const, dir: [0.984808, 0.173648] as const,
        voids: [[1.5, 0, 2.5, 2.15]] as const }, // door u=2.0, rough 1.0×2.15
      { id: 'wall_pl_east', start: [4.460289, -2.259851] as const, dir: [-0.173648, 0.984808] as const,
        voids: [[0.85, 0.9, 2.15, 2.2], [3.85, 0.9, 5.15, 2.2]] as const }, // windows
    ]
    for (const w of walls) {
      for (const p of result.parts.filter((x) => x.sourceId === w.id && x.role === 'masonry-unit')) {
        const u =
          (p.position[0] - w.start[0]) * w.dir[0] + (p.position[2] - w.start[1]) * w.dir[1]
        const y0 = p.position[1] - p.dims[1] / 2
        const y1 = p.position[1] + p.dims[1] / 2
        for (const v of w.voids) {
          const sep =
            u + p.dims[0] / 2 <= v[0] + 1e-6 ||
            u - p.dims[0] / 2 >= v[2] - 1e-6 ||
            y1 <= v[1] + 1e-6 ||
            y0 >= v[3] - 1e-6
          expect(sep).toBe(true)
        }
      }
    }
  })

  test('engine-level determinism incl. shuffled node key order', () => {
    const keys = Object.keys(nodes)
    const shuffled = [...keys].reverse()
    const perm: Record<string, Record<string, unknown>> = {}
    for (const k of shuffled) perm[k] = nodes[k]!
    const a = JSON.stringify(generateVisualBones(nodes, CERAMIC))
    const b = JSON.stringify(generateVisualBones(perm, CERAMIC))
    expect(a).toBe(b)
    expect(a).toBe(JSON.stringify(generateVisualBones(nodes, CERAMIC)))
  })
})
