import { createHash } from 'node:crypto'
import { extractLevels, extractSlabs, extractWalls } from '../core/wall-model'
import { extractRoofs } from '../engines/roof-framing'
import { groundRoofParts } from './ground-roof'
import { masonryWallParts } from './masonry'
import { PL_PRESETS, type PlPresets } from './presets'
import { timberWallParts } from './timber'
import type {
  PlVisualConfig,
  VisualBonesResult,
  VisualDiagnostic,
  VisualPart,
  VisualSceneNodes,
} from './types'

/**
 * `sha256:<hex>` over the EXACT exported pascal-scene.json file bytes. Both
 * the TS exporter and the Blender addon hash the same downloaded file — no
 * canonicalization, no cross-language hashing pitfalls (grill decision).
 */
export function computeSceneHash(sceneFileBytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(sceneFileBytes).digest('hex')}`
}

/**
 * The pure PL-visual derivation seam (PBV-01). Deterministic: the same
 * sceneNodes+config+presets yield the same parts — IDs, positions, dims,
 * sequence, materials — regardless of JSON key ordering. One code path feeds
 * the Pascal preview and the sidecar export.
 *
 * Engines: masonry (PBV-03) is live for ceramic/aac/silicate. Timber framing
 * lands in PBV-04, foundations/floors/roof in PBV-05. Missing engines warn
 * and emit nothing — never invented geometry.
 */
export function generateVisualBones(
  sceneNodes: VisualSceneNodes,
  config: PlVisualConfig,
  presetData: PlPresets = PL_PRESETS,
): VisualBonesResult {
  const warnings: string[] = []
  const diagnostics: VisualDiagnostic[] = []

  const compat = presetData.compatibility[config.technology]
  let supported = false
  if (!compat) {
    diagnostics.push({
      kind: 'missing_project_data',
      message: `no preset entry for technology '${config.technology}'`,
    })
  } else if (
    !compat.floors.includes(config.floor) ||
    !compat.foundations.includes(config.foundation)
  ) {
    diagnostics.push({
      kind: 'blocked_by_mvp',
      message: `${config.technology}+${config.floor}/${config.foundation} unsupported by current engine (visual MVP; not a construction-permissibility judgement)`,
    })
  } else {
    supported = true
    diagnostics.push({
      kind: 'supported',
      message: `${config.technology}+${config.foundation}+${config.floor}`,
    })
  }

  const parts: VisualPart[] = []
  const tech = presetData.wallTechnologies.find((t) => t.id === config.technology)
  if (supported && tech) {
    const levels = extractLevels(sceneNodes)
    if (levels.length === 0) warnings.push('pl-visual: no levels found in scene')
    for (const level of levels) {
      const walls = extractWalls(sceneNodes, level.id)
      const slabs = extractSlabs(sceneNodes, level.id)
      if (tech.family === 'masonry') {
        for (const wall of walls) {
          const r = masonryWallParts(wall, level.id, tech.id, tech)
          parts.push(...r.parts)
          warnings.push(...r.warnings)
        }
      } else if (tech.family === 'framing') {
        for (const wall of walls) {
          const r = timberWallParts(wall, level.id, tech.id, tech)
          parts.push(...r.parts)
          warnings.push(...r.warnings)
        }
      }
      const g = groundRoofParts(
        level.id,
        level.level,
        walls,
        slabs,
        extractRoofs(sceneNodes, level.id).length > 0,
        config,
        tech.id,
        presetData,
      )
      parts.push(...g.parts)
      warnings.push(...g.warnings)
    }
  }

  parts.sort(
    (a, b) =>
      a.sequence - b.sequence ||
      (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : a.id.localeCompare(b.id)),
  )
  const stageCounts: Record<string, number> = { S1: 0, S2: 0, S3: 0, S4: 0 }
  for (const p of parts) stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1

  return {
    parts,
    warnings,
    summary: {
      technology: config.technology,
      foundation: config.foundation,
      floor: config.floor,
      stageCounts,
      diagnostics,
    },
  }
}
