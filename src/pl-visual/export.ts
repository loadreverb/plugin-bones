import { computeSceneHash, generateVisualBones } from './engine'
import { PL_PRESETS, type PlPresets } from './presets'
import type { PlVisualConfig, VisualSceneNodes, VisualSidecar } from './types'

/**
 * Deterministic visual-bones.json export (PBV-07) — the same
 * `generateVisualBones` result the panel preview shows, serialized once.
 *
 * The button downloads TWO files: `pascal-scene.json` (the persisted Pascal
 * scene shape {nodes, rootNodeIds}) and `visual-bones.json`. sceneHash is
 * sha256 over the EXACT scene bytes emitted here, so the Blender addon's
 * sibling-file check always compares against the file that shipped with the
 * sidecar — no editor-serialization guessing.
 */

export function sceneJsonBytes(
  nodes: VisualSceneNodes,
  rootNodeIds: readonly string[],
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ nodes, rootNodeIds }))
}

export function sidecarJsonBytes(sidecar: VisualSidecar): Uint8Array {
  // Field order is the object-literal order (schema order); parts come from
  // the engine already deterministically sorted — byte-identical per
  // scene+config. 2-space indent keeps exports human-diffable.
  return new TextEncoder().encode(JSON.stringify(sidecar, null, 2))
}

export function buildSidecar(
  sceneNodes: VisualSceneNodes,
  rootNodeIds: readonly string[],
  config: PlVisualConfig,
  presetData: PlPresets = PL_PRESETS,
): { sidecar: VisualSidecar; sceneBytes: Uint8Array } {
  const result = generateVisualBones(sceneNodes, config, presetData)
  const refused = result.summary.diagnostics.find(
    (d) => d.kind === 'blocked_by_mvp' || d.kind === 'missing_project_data',
  )
  if (refused) throw new Error(`visual-bones export refused: ${refused.message}`)

  const sceneBytes = sceneJsonBytes(sceneNodes, rootNodeIds)
  const sidecar: VisualSidecar = {
    schemaVersion: 'visual-bones-v1',
    unit: 'm',
    axis: 'Y_UP',
    sceneHash: computeSceneHash(sceneBytes),
    config: { ...config, visualOnly: true },
    parts: result.parts,
    warnings: result.warnings,
  }
  return { sidecar, sceneBytes }
}
