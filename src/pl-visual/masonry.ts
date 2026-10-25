import type { WallSlice } from '../core/types'
import { frameOf } from '../engines/wall-framing'
import type { PlWallTechnology } from './presets'
import { stageSequenceBase, visualPartId, type VisualPart } from './types'

/**
 * Metric masonry coursing engine (PBV-03) — ONE algorithm shared by ceramic /
 * aac / silicate. Drives off the editable preset module (length/height/
 * thickness + joint widths + half-course stagger), emits box pieces in the
 * wall-local frame (X along the wall, Y up, Z across), clipped at wall ends
 * and rough-opening rectangles. The HOST wall footprint is authoritative:
 * block depth = host thickness (a >3 cm preset mismatch warns, never
 * resizes), openings are cleared by their rough rectangles, and no geometry
 * is ever invented inside a void.
 *
 * Visual illustration only — no structural meaning (SPEC.md nonnegotiables).
 */

export type MasonryPreset = Extract<PlWallTechnology, { family: 'masonry' }>

const EPS = 1e-6
/** Pieces narrower than this (clipped slivers) are dropped, not emitted. */
const MIN_PIECE = 0.02
/** Spec: preset↔host thickness mismatch beyond 3 cm raises a warning. */
const THICKNESS_WARN = 0.03

/** Visual lintel: fills exactly the rough-opening void band one course high.
 * Bearing zones stay filled by the course blocks themselves — the only
 * "safe" lintel is one that cannot collide with anything. */
const LINTEL_ROLE = 'lintel'
const LINTEL_MATERIAL = 'concrete_raw'

const pad3 = (n: number) => String(n).padStart(3, '0')

function validateModule(m: MasonryPreset['module'], techId: string): void {
  const bad =
    !(m.length > 0) ||
    !(m.height > 0) ||
    !(m.thickness > 0) ||
    m.horizontalJoint < 0 ||
    m.verticalJoint < 0 ||
    !(m.courseOffsetFraction >= 0 && m.courseOffsetFraction <= 1)
  if (bad) throw new Error(`pl-visual: invalid masonry preset '${techId}': ${JSON.stringify(m)}`)
}

export function masonryWallParts(
  wall: WallSlice,
  levelId: string,
  techId: string,
  preset: MasonryPreset,
): { parts: VisualPart[]; warnings: string[] } {
  validateModule(preset.module, techId)
  const warnings: string[] = []
  if (wall.curved) {
    return {
      parts: [],
      warnings: [`pl-visual: wall '${wall.id}' is curved — unsupported in visual v1, skipped`],
    }
  }

  const m = preset.module
  const blockDepth = wall.thickness // host footprint is authoritative
  if (Math.abs(m.thickness - wall.thickness) > THICKNESS_WARN) {
    warnings.push(
      `pl-visual: wall '${wall.id}' thickness ${wall.thickness.toFixed(3)}m differs from preset ${m.thickness.toFixed(3)}m by >${THICKNESS_WARN}m — host kept`,
    )
  }

  const openings = [...wall.openings]
    .sort((a, b) => a.u - b.u)
    .map((o) => ({
      id: o.id,
      u0: o.u - o.roughWidth / 2,
      u1: o.u + o.roughWidth / 2,
      y0: o.sillHeight,
      y1: o.sillHeight + o.roughHeight,
    }))

  const { yaw, place } = frameOf(wall)
  const parts: VisualPart[] = []
  const pitch = m.height + m.horizontalJoint
  const step = m.length + m.verticalJoint
  const stagger = m.courseOffsetFraction * m.length

  const emit = (
    u0: number,
    u1: number,
    y0: number,
    y1: number,
    course: number,
    piece: number,
    role = 'masonry-unit',
    materialId = preset.materialId,
  ) => {
    parts.push({
      id: visualPartId(wall.id, techId, `${role}:${pad3(course)}:${pad3(piece)}`),
      sourceId: wall.id,
      levelId,
      technology: techId,
      stage: 'S2',
      sequence: stageSequenceBase('S2') + parts.length,
      role,
      materialId,
      shape: 'box',
      position: place((u0 + u1) / 2, (y0 + y1) / 2),
      rotation: [0, yaw, 0],
      dims: [u1 - u0, y1 - y0, blockDepth],
    })
  }

  // Courses bottom-up; odd courses staggered by the offset fraction.
  for (let course = 0; ; course++) {
    const y0 = course * pitch
    if (y0 >= wall.height - EPS) break
    const y1 = Math.min(y0 + m.height, wall.height)
    const shift = (course % 2) * stagger
    let piece = 0
    for (let k = 0; ; k++) {
      const rawS0 = -shift + k * step
      if (rawS0 >= wall.length - EPS) break
      const s0 = Math.max(rawS0, 0)
      const s1 = Math.min(rawS0 + m.length, wall.length)
      if (s1 - s0 <= EPS) continue

      // Clip this block against every opening whose vertical band overlaps
      // the course; emit the surviving X segments.
      let segments: [number, number][] = [[s0, s1]]
      for (const op of openings) {
        if (op.y1 <= y0 + EPS || op.y0 >= y1 - EPS) continue
        const next: [number, number][] = []
        for (const [u0, u1] of segments) {
          if (Math.min(op.u1, u1) - Math.max(op.u0, u0) <= EPS) {
            next.push([u0, u1])
            continue
          }
          if (op.u0 - u0 > MIN_PIECE) next.push([u0, Math.min(op.u0, u1)])
          if (u1 - op.u1 > MIN_PIECE) next.push([Math.max(op.u1, u0), u1])
        }
        segments = next
      }
      for (const [u0, u1] of segments) {
        if (u1 - u0 <= MIN_PIECE) continue
        emit(u0, u1, y0, y1, course, piece++)
      }
    }
  }

  // Visual lintels: one course-high box over each rough opening, only when
  // it fits below the wall top and collides with nothing.
  for (const op of openings) {
    const lintelTop = op.y1 + m.height
    if (op.y1 <= EPS || op.y1 >= wall.height - EPS) continue
    if (lintelTop > wall.height + EPS) {
      warnings.push(
        `pl-visual: opening '${op.id}' in wall '${wall.id}' reaches the wall top — visual lintel omitted`,
      )
      continue
    }
    const collides = openings.some(
      (o) => o !== op && o.y0 < lintelTop - EPS && o.y1 > op.y1 + EPS && o.u1 > op.u0 && o.u0 < op.u1,
    )
    if (collides) {
      warnings.push(
        `pl-visual: opening '${op.id}' in wall '${wall.id}' overlaps another opening — visual lintel omitted`,
      )
      continue
    }
    emit(op.u0, op.u1, op.y1, lintelTop, 0, parts.length, LINTEL_ROLE, LINTEL_MATERIAL)
  }

  return { parts, warnings }
}
