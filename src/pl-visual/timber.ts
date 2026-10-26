import type { WallSlice } from '../core/types'
import { frameOf } from '../engines/wall-framing'
import type { PlWallTechnology } from './presets'
import { stageSequenceBase, visualPartId, type VisualPart } from './types'

/**
 * Visual timber-frame engine (PBV-04) — metric stud boxes in the same
 * wall-local frame the masonry engine uses (X along the wall, Y up, Z
 * across). Bottom/top plates, studs on a fixed rhythm, jamb studs at rough
 * opening edges, a header band above each opening, window sills. No stud
 * passes through an opening. Stud depth follows the HOST wall thickness
 * (>3 cm mismatch warns, host wins — same rule as masonry). Visual
 * illustration only: no spans, no loads, no fasteners.
 */

export type TimberPreset = Extract<PlWallTechnology, { family: 'framing' }>

const EPS = 1e-6
const MIN_PIECE = 0.01
const THICKNESS_WARN = 0.03
/** Visual header height — two stud widths, the classic doubled-up look. */
const HEADER_HEIGHT_FACTOR = 2

const pad3 = (n: number) => String(n).padStart(3, '0')

export function timberWallParts(
  wall: WallSlice,
  levelId: string,
  techId: string,
  preset: TimberPreset,
): { parts: VisualPart[]; warnings: string[] } {
  const s = preset.stud
  if (!(s.width > 0) || !(s.depth > 0) || !(s.spacing > 0) || !(s.plateHeight > 0)) {
    throw new Error(`pl-visual: invalid timber preset '${techId}': ${JSON.stringify(s)}`)
  }
  const warnings: string[] = []
  if (wall.curved) {
    return {
      parts: [],
      warnings: [`pl-visual: wall '${wall.id}' is curved — unsupported in visual v1, skipped`],
    }
  }

  const depth = wall.thickness // host footprint is authoritative
  if (Math.abs(s.depth - wall.thickness) > THICKNESS_WARN) {
    warnings.push(
      `pl-visual: wall '${wall.id}' thickness ${wall.thickness.toFixed(3)}m differs from stud depth ${s.depth.toFixed(3)}m by >${THICKNESS_WARN}m — host kept`,
    )
  }

  const openings = [...wall.openings]
    .sort((a, b) => a.u - b.u)
    .map((o) => ({
      id: o.id,
      kind: o.kind,
      u0: o.u - o.roughWidth / 2,
      u1: o.u + o.roughWidth / 2,
      y0: o.sillHeight,
      y1: o.sillHeight + o.roughHeight,
    }))

  const { yaw, place } = frameOf(wall)
  const headerH = HEADER_HEIGHT_FACTOR * s.width
  const plateB = s.plateHeight
  const plateT = wall.height - s.plateHeight

  const parts: VisualPart[] = []
  const emit = (
    u0: number,
    u1: number,
    y0: number,
    y1: number,
    path: string,
    role: string,
  ) => {
    parts.push({
      id: visualPartId(wall.id, techId, path),
      sourceId: wall.id,
      levelId,
      technology: techId,
      stage: 'S2',
      sequence: stageSequenceBase('S2') + parts.length,
      role,
      materialId: preset.materialId,
      shape: 'box',
      position: place((u0 + u1) / 2, (y0 + y1) / 2),
      rotation: [0, yaw, 0],
      dims: [u1 - u0, y1 - y0, depth],
    })
  }

  const clamp = (v: number) => Math.min(Math.max(v, 0), wall.length)

  // Plates: full-length bottom + top.
  emit(0, wall.length, 0, plateB, `plate:b`, 'bottom-plate')
  emit(0, wall.length, plateT, wall.height, `plate:t`, 'top-plate')

  // No-go X intervals for common studs: opening voids extended up through
  // the header band (a stud crossing the header would interpenetrate).
  const noGo = openings.map((o) => ({
    u0: clamp(o.u0 - s.width / 2),
    u1: clamp(o.u1 + s.width / 2),
    y0: 0,
    y1: Math.min(o.y1 + headerH, wall.height),
  }))

  // Common studs on the fixed rhythm, both wall ends included.
  const centers = new Set<number>()
  for (let u = 0; u <= wall.length + EPS; u += s.spacing) centers.add(Math.min(u, wall.length))
  centers.add(wall.length)
  const sorted = [...centers].sort((a, b) => a - b)
  let studIdx = 0
  for (const u of sorted) {
    const x0 = u - s.width / 2
    const x1 = u + s.width / 2
    const blocked = noGo.some(
      (g) => x1 > g.u0 + EPS && x0 < g.u1 - EPS && g.y1 > plateB + EPS && g.y0 < plateT - EPS,
    )
    if (blocked) continue
    emit(Math.max(x0, 0), Math.min(x1, wall.length), plateB, plateT, `stud:${pad3(studIdx++)}`, 'stud')
  }

  // Per opening: jamb studs at the rough edges + header band + window sill.
  openings.forEach((o, i) => {
    const top = Math.min(o.y1 + headerH, wall.height)
    if (o.y1 + headerH <= wall.height + EPS) {
      emit(o.u0, o.u1, o.y1, o.y1 + headerH, `header:${pad3(i)}`, 'header')
    } else {
      warnings.push(
        `pl-visual: opening '${o.id}' in wall '${wall.id}' reaches the wall top — header omitted`,
      )
    }
    for (const [side, edge] of [
      ['l', o.u0 - s.width / 2],
      ['r', o.u1 + s.width / 2],
    ] as const) {
      const c = clamp(edge)
      if (edge === c && c >= -EPS && c <= wall.length + EPS) {
        emit(c - s.width / 2, c + s.width / 2, plateB, plateT, `jamb:${pad3(i)}:${side}`, 'jamb-stud')
      }
    }
    if (o.kind === 'window' && o.y0 > plateB + MIN_PIECE) {
      emit(o.u0, o.u1, o.y0 - s.width, o.y0, `sill:${pad3(i)}`, 'sill')
    }
  })

  return { parts, warnings }
}
