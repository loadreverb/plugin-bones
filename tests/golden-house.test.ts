import { describe, expect, test } from 'bun:test'
import { extractLevels, extractSlabs, extractWalls } from '../src/core/wall-model'
import { extractRoofs } from '../src/engines/roof-framing'
import fixture from './fixtures/pl-demo-house.json'

/** The golden PL house (see fixtures/pl-demo-house.README.md): 8×6 m external
 * rectangle rotated 10°, 4 walls, 1 door, 2 windows, slab, gable roof,
 * nonzero level baseElevation. THE canonical test scene of the PL Visual
 * MVP — geometry asserts are exact on purpose (ticket PBV-02). */

const nodes = fixture.nodes as Record<string, Record<string, unknown>>
const LEVEL = 'level_pl1'

describe('PBV-02 · golden house — levels', () => {
  test('one level, nonzero baseElevation survives into baseY', () => {
    const levels = extractLevels(nodes)
    expect(levels).toHaveLength(1)
    expect(levels[0]?.id).toBe(LEVEL)
    expect(levels[0]?.height).toBeCloseTo(2.8, 6)
    expect(levels[0]?.baseY).toBeCloseTo(0.35, 6)
  })
})

describe('PBV-02 · golden house — walls', () => {
  const walls = extractWalls(nodes, LEVEL)

  test('exactly 4 external walls', () => {
    expect(walls.map((w) => w.id).sort()).toEqual([
      'wall_pl_east',
      'wall_pl_north',
      'wall_pl_south',
      'wall_pl_west',
    ])
    for (const w of walls) expect(w.exterior).toBe(true)
  })

  test('exact footprint: 8 m and 6 m centrelines, thickness 0.25, height 2.8', () => {
    const byId = new Map(walls.map((w) => [w.id, w]))
    expect(byId.get('wall_pl_south')?.length).toBeCloseTo(8, 3)
    expect(byId.get('wall_pl_north')?.length).toBeCloseTo(8, 3)
    expect(byId.get('wall_pl_east')?.length).toBeCloseTo(6, 3)
    expect(byId.get('wall_pl_west')?.length).toBeCloseTo(6, 3)
    for (const w of walls) {
      expect(w.thickness).toBe(0.25)
      expect(w.height).toBe(2.8)
      expect(w.curved).toBe(false)
    }
  })

  test('closed rectangle: exactly 4 shared corners, every wall touched twice', () => {
    const key = (p: readonly number[]) => `${p[0]?.toFixed(3)}:${p[1]?.toFixed(3)}`
    const corners = new Map<string, number>()
    for (const w of walls) {
      for (const p of [w.start, w.end]) {
        corners.set(key(p), (corners.get(key(p)) ?? 0) + 1)
      }
    }
    expect(corners.size).toBe(4)
    for (const count of corners.values()) expect(count).toBe(2)
  })

  test('every wall is non-axis-aligned (10° rotation — orientation catcher)', () => {
    for (const w of walls) {
      const dx = Math.abs(w.end[0] - w.start[0])
      const dz = Math.abs(w.end[1] - w.start[1])
      expect(dx).toBeGreaterThan(0.5)
      expect(dz).toBeGreaterThan(0.5)
    }
    const south = walls.find((w) => w.id === 'wall_pl_south')
    // direction 10° off +X: dir ≈ (cos10°, sin10°)
    expect(south?.dir[0]).toBeCloseTo(Math.cos(0.174533), 3)
    expect(south?.dir[1]).toBeCloseTo(Math.sin(0.174533), 3)
  })

  test('openings: 1 floor-bound door south, 2 windows east sorted by u', () => {
    const byId = new Map(walls.map((w) => [w.id, w]))
    const south = byId.get('wall_pl_south')?.openings ?? []
    expect(south).toHaveLength(1)
    const door = south[0]
    expect(door?.kind).toBe('door')
    expect(door?.sillHeight).toBe(0)
    expect(door?.u).toBeCloseTo(2.0, 6)
    expect(door?.roughWidth).toBeCloseTo(1.0, 6)
    expect(door?.roughHeight).toBeCloseTo(2.15, 6)

    const east = byId.get('wall_pl_east')?.openings ?? []
    expect(east.map((o) => o.kind)).toEqual(['window', 'window'])
    expect(east.map((o) => o.u)).toEqual([1.5, 4.5])
    for (const win of east) {
      // center height 1.5 − height 1.2 / 2 → sill 0.9
      expect(win.sillHeight).toBeCloseTo(0.9, 6)
      expect(win.roughWidth).toBeCloseTo(1.3, 6)
    }
    // no opening anywhere else
    expect(byId.get('wall_pl_north')?.openings).toHaveLength(0)
    expect(byId.get('wall_pl_west')?.openings).toHaveLength(0)
  })
})

describe('PBV-02 · golden house — slab + roof', () => {
  test('one slab matching the footprint polygon', () => {
    const slabs = extractSlabs(nodes, LEVEL)
    expect(slabs).toHaveLength(1)
    expect(slabs[0]?.id).toBe('slab_pl_1')
    expect(slabs[0]?.polygon).toHaveLength(4)
    expect(slabs[0]?.thickness).toBeCloseTo(0.2, 6)
  })

  test('one gable roof at wall-top, pitch converted to radians', () => {
    const roofs = extractRoofs(nodes, LEVEL)
    expect(roofs).toHaveLength(1)
    const roof = roofs[0]
    expect(roof?.roofType).toBe('gable')
    expect(roof?.width).toBeCloseTo(8, 6)
    expect(roof?.depth).toBeCloseTo(6, 6)
    expect(roof?.pitch).toBeCloseTo((40 * Math.PI) / 180, 6)
    expect(roof?.position[1]).toBeCloseTo(2.8, 6)
  })
})

describe('PBV-02 · golden house — source of truth stays untouched', () => {
  test('extraction never mutates the fixture', () => {
    const before = JSON.stringify(fixture)
    extractWalls(nodes, LEVEL)
    extractSlabs(nodes, LEVEL)
    extractLevels(nodes)
    extractRoofs(nodes, LEVEL)
    expect(JSON.stringify(fixture)).toBe(before)
  })
})
