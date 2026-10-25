import { createHash } from 'node:crypto'
import { PL_PRESETS, type PlPresets } from './presets'
import type {
  PlVisualConfig,
  VisualBonesResult,
  VisualDiagnostic,
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
 * Construction engines land in PBV-03 (masonry), PBV-04 (timber), PBV-05
 * (ground/roof). Until then: zero parts, the MVP compatibility verdict, and
 * defined warnings — never invented geometry.
 */
export function generateVisualBones(
  sceneNodes: VisualSceneNodes,
  config: PlVisualConfig,
  presetData: PlPresets = PL_PRESETS,
): VisualBonesResult {
  void sceneNodes // engines read it from PBV-03 on
  const warnings: string[] = []
  const diagnostics: VisualDiagnostic[] = []

  const compat = presetData.compatibility[config.technology]
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
    diagnostics.push({
      kind: 'supported',
      message: `${config.technology}+${config.foundation}+${config.floor}`,
    })
    warnings.push(
      `pl-visual: ${config.technology} engine not implemented yet (PBV-03/04/05); no parts generated`,
    )
  }

  return {
    parts: [],
    warnings,
    summary: {
      technology: config.technology,
      foundation: config.foundation,
      floor: config.floor,
      stageCounts: { S1: 0, S2: 0, S3: 0, S4: 0 },
      diagnostics,
    },
  }
}
