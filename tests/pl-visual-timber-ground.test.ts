import { describe, expect, test } from 'bun:test'
import type { OpeningSlice, WallSlice } from '../src/core/types'
import { generateVisualBones } from '../src/pl-visual/engine'
import { groundRoofParts } from '../src/pl-visual/ground-roof'
import { PL_PRESETS, type PlWallTechnology } from '../src/pl-visual/presets'
import { timberWallParts } from '../src/pl-visual/timber'
import golden from './fixtures/pl-demo-house.json'

/** PBV-04 (timber) + PBV-05 (foundations/floor/roof honesty). */

const LEVEL = 'level_test'

const mkWall = (over: Partial<WallSlice> = {}): WallSlice => ({
  id: 'tw',
  start: [0, 0],
  end: [6, 0],
  length: 6,
  dir: [1, 0],
  thickness: 0.15,
  height: 2.8,
  exterior: true,
  openings: [],
  curved: false,
  ...over,
})

const mkOpening = (over: Partial<OpeningSlice> = {}): OpeningSlice => ({
  id: 'd1',
  kind: 'door',
  u: 3.0,
  width: 0.9,
  height: 2.05,
  sillHeight: 0,
  roughWidth: 1.0,
  roughHeight: 2.15,
  ...over,
})

const timber = PL_PRESETS.wallTechnologies.find(
  (t) => t.id === 'timber_frame',
) as Extract<PlWallTechnology, { family: 'framing' }>

describe('PBV-04 · timber frame', () => {
  const wall = mkWall({ openings: [mkOpening(), mkOpening({ id: 'w1', kind: 'window', u: 5.0, width: 1.2, height: 1.2, sillHeight: 0.9, roughWidth: 1.3, roughHeight: 1.3 })] })
  const r = timberWallParts(wall, LEVEL, 'timber_frame', timber)
  const studs = r.parts.filter((p) => p.role === 'stud')

  test('plates, studs, jambs, headers, sill follow scene dimensions', () => {
    expect(r.parts.filter((p) => p.role === 'bottom-plate')).toHaveLength(1)
    expect(r.parts.filter((p) => p.role === 'top-plate')).toHaveLength(1)
    const bp = r.parts.find((p) => p.role === 'bottom-plate')!
    expect(bp.dims[0]).toBeCloseTo(6, 6)
    expect(bp.dims[1]).toBeCloseTo(0.045, 6)
    expect(bp.dims[2]).toBeCloseTo(0.15, 6) // host thickness
    expect(studs.length).toBeGreaterThan(3)
    // two openings -> 2 headers, 4 jambs, 1 window sill
    expect(r.parts.filter((p) => p.role === 'header')).toHaveLength(2)
    expect(r.parts.filter((p) => p.role === 'jamb-stud')).toHaveLength(4)
    expect(r.parts.filter((p) => p.role === 'sill')).toHaveLength(1)
  })

  test('no stud passes through a door/window cut-out', () => {
    for (const s of studs) {
      const u = s.position[0]
      const y0 = s.position[1] - s.dims[1] / 2
      const y1 = s.position[1] + s.dims[1] / 2
      for (const o of wall.openings) {
        const [ou0, ou1] = [o.u - o.roughWidth / 2, o.u + o.roughWidth / 2]
        const overlap =
          u + s.dims[0] / 2 > ou0 + 1e-6 &&
          u - s.dims[0] / 2 < ou1 - 1e-6 &&
          y1 > o.sillHeight + 1e-6 &&
          y0 < o.sillHeight + o.roughHeight - 1e-6
        expect(overlap).toBe(false)
      }
    }
  })

  test('spacing changes the stud count deterministically', () => {
    const tighter = { ...timber, stud: { ...timber.stud, spacing: 0.4 } }
    const n600 = timberWallParts(mkWall(), LEVEL, 'timber_frame', timber).parts.filter((p) => p.role === 'stud').length
    const n400 = timberWallParts(mkWall(), LEVEL, 'timber_frame', tighter).parts.filter((p) => p.role === 'stud').length
    expect(n400).toBeGreaterThan(n600)
    expect(timberWallParts(mkWall(), LEVEL, 'timber_frame', timber).parts.filter((p) => p.role === 'stud').length).toBe(n600)
  })

  test('material timber_raw, stage S2, source/level ids, S2 sequence bucket', () => {
    for (const p of r.parts) {
      expect(p.materialId).toBe('timber_raw')
      expect(p.stage).toBe('S2')
      expect(p.sourceId).toBe('tw')
      expect(p.levelId).toBe(LEVEL)
      expect(p.sequence).toBeGreaterThanOrEqual(2000)
    }
  })

  test('preset depth mismatch warns and keeps host thickness', () => {
    const thick = timberWallParts(mkWall({ thickness: 0.2 }), LEVEL, 'timber_frame', timber)
    expect(thick.warnings.join('\n')).toContain('thickness')
    expect(thick.parts.every((p) => Math.abs(p.dims[2] - 0.2) < 1e-9)).toBe(true)
  })
})

describe('PBV-05 · foundations + floor + roof honesty', () => {
  const wall = mkWall()
  const crossed = mkWall({ id: 't2', start: [0, 0], end: [0, 4], length: 4, dir: [0, 1] })
  const CERAMIC = { technology: 'ceramic', foundation: 'raft', floor: 'concrete_slab' } as const

  test('raft: one S1 slab under the oriented footprint, below the floor plane', () => {
    const r = groundRoofParts(LEVEL, 0, [wall, crossed], [], false, CERAMIC, 'ceramic', PL_PRESETS)
    const slab = r.parts.filter((p) => p.role === 'foundation-slab')
    expect(slab).toHaveLength(1)
    const s = slab[0]!
    expect(s.stage).toBe('S1')
    expect(s.dims[0]).toBeCloseTo(6.075, 2)   // oriented along the longest wall, + its thickness
    expect(s.dims[2]).toBeCloseTo(4.075, 2)
    expect(s.dims[1]).toBeCloseTo(0.3, 3) // preset default thickness
    expect(s.position[1] + s.dims[1] / 2).toBeCloseTo(0, 6) // top at floor level
    expect(s.sequence).toBeGreaterThanOrEqual(1000)
  })

  test('strip: ground slab + per-wall stemwall + footing, no wall moved', () => {
    const STRIP = { ...CERAMIC, foundation: 'strip' } as const
    const r = groundRoofParts(LEVEL, 0, [wall], [], false, STRIP, 'ceramic', PL_PRESETS)
    expect(r.parts.filter((p) => p.role === 'ground-slab')).toHaveLength(1)
    expect(r.parts.filter((p) => p.role === 'stemwall')).toHaveLength(1)
    expect(r.parts.filter((p) => p.role === 'footing')).toHaveLength(1)
    const stem = r.parts.find((p) => p.role === 'stemwall')!
    expect(stem.dims[0]).toBeCloseTo(6, 3)
    expect(stem.dims[2]).toBeCloseTo(0.15, 3) // wall thickness, wall centerline kept
    const foot = r.parts.find((p) => p.role === 'footing')!
    expect(foot.dims[2]).toBeCloseTo(0.6, 3) // footing width default
    for (const p of r.parts) expect(p.position[1] < 0.001).toBe(true) // all below floor
  })

  test('ground storey gets NO invented suspended floor', () => {
    const r = groundRoofParts(LEVEL, 0, [wall], [], false, CERAMIC, 'ceramic', PL_PRESETS)
    expect(r.parts.filter((p) => p.role === 'floor-slab' || p.role === 'floor-joist')).toHaveLength(0)
  })

  test('upper storey: concrete floor only from a real slab; timber joists schematic', () => {
    const slab = {
      id: 'slab2', polygon: [[0, 0], [4, 0], [4, 3], [0, 3]] as const,
      holes: [], elevation: 0.05, thickness: 0.2,
    }
    const conc = groundRoofParts(LEVEL, 1, [], [slab], false, CERAMIC, 'ceramic', PL_PRESETS)
    expect(conc.parts.filter((p) => p.role === 'floor-slab')).toHaveLength(1)
    const TIMBER = { ...CERAMIC, floor: 'timber_joists' } as const
    const jo = groundRoofParts(LEVEL, 1, [], [slab], false, TIMBER, 'ceramic', PL_PRESETS)
    const joists = jo.parts.filter((p) => p.role === 'floor-joist')
    expect(joists.length).toBeGreaterThanOrEqual(2)
    expect(joists.every((p) => p.materialId === 'timber_raw' && p.stage === 'S2')).toBe(true)
  })

  test('roof present -> honest warning, zero invented S3 parts', () => {
    const r = groundRoofParts(LEVEL, 0, [wall], [], true, CERAMIC, 'ceramic', PL_PRESETS)
    expect(r.warnings.join('\n')).toContain('nothing invented')
    expect(r.parts.filter((p) => p.stage === 'S3')).toHaveLength(0)
  })

  test('golden house through generateVisualBones: S1 present, S3 empty, roof warning', () => {
    const nodes = golden.nodes as Record<string, Record<string, unknown>>
    const result = generateVisualBones(nodes, CERAMIC)
    expect(result.summary.stageCounts.S1).toBeGreaterThanOrEqual(1)
    expect(result.summary.stageCounts.S3).toBe(0)
    expect(result.warnings.join('\n')).toContain('roof envelope IS the S3')
    const s1 = result.parts.filter((p) => p.stage === 'S1')
    // oriented raft slab under the rotated 8x6 centerline footprint + wall thickness
    expect(s1.some((p) => p.role === 'foundation-slab' && Math.abs(p.dims[0] - 8.25) < 0.01 && Math.abs(p.dims[2] - 6.25) < 0.01)).toBe(true)
  })

  test('golden house timber_frame end-to-end: S1 + S2, no US-imperial leakage', () => {
    const nodes = golden.nodes as Record<string, Record<string, unknown>>
    const result = generateVisualBones(nodes, {
      technology: 'timber_frame', foundation: 'strip', floor: 'timber_joists',
    })
    expect(result.summary.stageCounts.S2).toBeGreaterThan(50)
    expect(result.summary.stageCounts.S1).toBeGreaterThanOrEqual(6) // slab + 4 stems + 4 footings... >= 6
    const ids = new Set(result.parts.map((p) => p.id))
    expect(ids.size).toBe(result.parts.length)
  })
})
