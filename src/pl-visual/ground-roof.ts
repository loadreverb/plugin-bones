import type { SlabSlice, WallSlice } from '../core/types'
import { frameOf } from '../engines/wall-framing'
import type { PlPresets } from './presets'
import type { PlVisualConfig } from './types'
import { stageSequenceBase, visualPartId, type VisualPart } from './types'

/**
 * Visual foundations + floors + roof honesty (PBV-05).
 *
 * S1 (below the floor plane, so stage animation reveals it): raft = one
 * slab under the source footprint; strip = footing + stemwall ribbons under
 * each wall + a ground slab. The footprint box is ORIENTED along the
 * longest wall (rotated houses must not get an over-covering AABB). Visual
 * defaults come from the preset foundation entry (schematic, never
 * soil/load-derived).
 *
 * S2 floor: only on upper storeys (level index >= 1) and only where the
 * source defines a slab — concrete_slab renders the slab itself as a box,
 * timber_joists renders schematic joists just below it. A ground storey
 * never gets an invented suspended floor.
 *
 * S3: the Pascal roof envelope IS the visualization (imported by the
 * upstream addon); schematic rafters need reliable skylight/chimney
 * keep-outs, which v1 cannot extract — so we warn and invent nothing.
 */

const TIMBER_FOOTING_DEFAULTS = { slabThicknessM: 0.3 } as const
const STRIP_DEFAULTS = {
  footingWidthM: 0.6,
  footingDepthM: 0.3,
  stemwallHeightM: 0.4,
  groundSlabThicknessM: 0.15,
} as const
/** Schematic joist rhythm for timber_joists floors (visual default). */
const JOIST_SPACING = 0.4
const JOIST_WIDTH = 0.05
const JOIST_DEPTH = 0.2

const EPS = 1e-6

export function groundRoofParts(
  levelId: string,
  levelIndex: number,
  walls: WallSlice[],
  slabs: SlabSlice[],
  hasRoof: boolean,
  config: PlVisualConfig,
  techId: string,
  presetData: PlPresets,
): { parts: VisualPart[]; warnings: string[] } {
  const parts: VisualPart[] = []
  const warnings: string[] = []

  const foundation = presetData.foundations.find((f) => f.id === config.foundation)
  const defaults = (foundation?.defaults ?? {}) as Record<string, number>
  const num = (key: string, fallback: number) => {
    const v = defaults[key] ?? fallback
    return v > 0 ? v : fallback
  }

  const emit = (
    id: string,
    role: string,
    stage: 'S1' | 'S2',
    materialId: string,
    place: (u: number, y: number, v?: number) => [number, number, number],
    yaw: number,
    uMid: number,
    vMid: number,
    uLen: number,
    vLen: number,
    y0: number,
    y1: number,
  ) => {
    if (uLen <= EPS || vLen <= EPS || y1 - y0 <= EPS) return
    parts.push({
      id,
      sourceId: levelId,
      levelId,
      technology: techId,
      stage,
      sequence: stageSequenceBase(stage) + parts.length,
      role,
      materialId,
      shape: 'box',
      position: place(uMid, (y0 + y1) / 2, vMid),
      rotation: [0, yaw, 0],
      dims: [uLen, y1 - y0, vLen],
    })
  }

  if (walls.length > 0) {
    // Oriented footprint frame: the longest wall's local (u, v). Tie-break
    // by id — two equal-length walls must pick the SAME frame regardless of
    // node iteration order (determinism contract).
    const longest = walls.reduce((a, b) =>
      b.length > a.length || (b.length === a.length && b.id < a.id) ? b : a,
    )
    const { yaw, place } = frameOf(longest)
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity
    const grow = (u: number, v: number) => {
      uMin = Math.min(uMin, u); uMax = Math.max(uMax, u)
      vMin = Math.min(vMin, v); vMax = Math.max(vMax, v)
    }
    for (const w of walls) {
      // Project each wall's four FACE corners (not just the centerline) so
      // the footprint has width even without slabs.
      const nx = -w.dir[1]
      const nz = w.dir[0]
      const h = w.thickness / 2
      for (const p of [w.start, w.end]) {
        for (const s of [-h, h]) {
          const cx = p[0] + nx * s - longest.start[0]
          const cz = p[1] + nz * s - longest.start[1]
          grow(
            cx * longest.dir[0] + cz * longest.dir[1],
            -cx * longest.dir[1] + cz * longest.dir[0],
          )
        }
      }
    }
    for (const s of slabs) {
      for (const p of s.polygon) {
        const dx = p[0] - longest.start[0]
        const dz = p[1] - longest.start[1]
        grow(dx * longest.dir[0] + dz * longest.dir[1], -dx * longest.dir[1] + dz * longest.dir[0])
      }
    }

    if (config.foundation === 'raft') {
      const t = num('slabThicknessM', TIMBER_FOOTING_DEFAULTS.slabThicknessM)
      emit(
        visualPartId(levelId, techId, 'raft:0'),
        'foundation-slab',
        'S1',
        'concrete_raw',
        place, yaw,
        (uMin + uMax) / 2, (vMin + vMax) / 2,
        uMax - uMin, vMax - vMin,
        -t, 0,
      )
    } else {
      const gslabT = num('groundSlabThicknessM', STRIP_DEFAULTS.groundSlabThicknessM)
      const stemH = num('stemwallHeightM', STRIP_DEFAULTS.stemwallHeightM)
      const footW = num('footingWidthM', STRIP_DEFAULTS.footingWidthM)
      const footD = num('footingDepthM', STRIP_DEFAULTS.footingDepthM)

      emit(
        visualPartId(levelId, techId, 'ground-slab:0'),
        'ground-slab',
        'S1',
        'concrete_raw',
        place, yaw,
        (uMin + uMax) / 2, (vMin + vMax) / 2,
        uMax - uMin, vMax - vMin,
        -gslabT, 0,
      )
      for (const wall of [...walls].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const f = frameOf(wall)
        emit(visualPartId(wall.id, techId, `stemwall:${wall.id}`), 'stemwall', 'S1', 'concrete_raw',
          f.place, f.yaw, wall.length / 2, 0, wall.length, wall.thickness, -gslabT - stemH, 0)
        emit(visualPartId(wall.id, techId, `footing:${wall.id}`), 'footing', 'S1', 'concrete_raw',
          f.place, f.yaw, wall.length / 2, 0, wall.length, footW, -gslabT - stemH - footD, -gslabT - stemH)
      }
    }
  }

  // Upper-storey floors: only where the source defines slabs above ground.
  if (levelIndex >= 1 && slabs.length > 0) {
    slabs.forEach((slab, i) => {
      let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity
      for (const p of slab.polygon) {
        xMin = Math.min(xMin, p[0]); xMax = Math.max(xMax, p[0])
        zMin = Math.min(zMin, p[1]); zMax = Math.max(zMax, p[1])
      }
      if (config.floor === 'concrete_slab') {
        parts.push({
          id: visualPartId(slab.id, techId, `floor-slab:${i}`),
          sourceId: slab.id,
          levelId,
          technology: techId,
          stage: 'S2',
          sequence: stageSequenceBase('S2') + parts.length,
          role: 'floor-slab',
          materialId: 'concrete_raw',
          shape: 'box',
          position: [(xMin + xMax) / 2, slab.elevation + slab.thickness / 2, (zMin + zMax) / 2],
          rotation: [0, 0, 0],
          dims: [xMax - xMin, slab.thickness, zMax - zMin],
        })
      } else {
        const alongX = xMax - xMin >= zMax - zMin
        const span = alongX ? xMax - xMin : zMax - zMin
        const count = Math.max(1, Math.floor(span / JOIST_SPACING))
        for (let j = 0; j <= count; j++) {
          const t = count === 0 ? 0 : (j * span) / count
          parts.push({
            id: visualPartId(slab.id, techId, `joist:${i}:${j}`),
            sourceId: slab.id,
            levelId,
            technology: techId,
            stage: 'S2',
            sequence: stageSequenceBase('S2') + parts.length,
            role: 'floor-joist',
            materialId: 'timber_raw',
            shape: 'box',
            position: alongX
              ? [xMin + t, slab.elevation - JOIST_DEPTH / 2, (zMin + zMax) / 2]
              : [(xMin + xMax) / 2, slab.elevation - JOIST_DEPTH / 2, zMin + t],
            rotation: [0, 0, 0],
            dims: alongX ? [JOIST_WIDTH, JOIST_DEPTH, zMax - zMin] : [xMax - xMin, JOIST_DEPTH, JOIST_WIDTH],
          })
        }
      }
    })
  }

  if (hasRoof) {
    warnings.push(
      'pl-visual: roof — the original Pascal roof envelope IS the S3 visualization; ' +
        'schematic rafters need reliable skylight/chimney keep-outs, none extracted — nothing invented',
    )
  }

  return { parts, warnings }
}
