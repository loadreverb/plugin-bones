import { z } from 'zod'

/**
 * Polish Bones Visual MVP — the `visual-bones-v1` contract types.
 * Canonical JSON Schema: `polish-bones-mvp/contracts/visual-bones.schema.json`
 * (the TS↔Python interface; `engine.test.ts` pins the two in sync).
 *
 * Geometry: metres, level-local, Pascal axes (X horizontal, Y up, Z
 * horizontal). Everything here is a VISUAL construction illustration — never
 * engineering, never a bill of materials.
 */

/** Pascal scene nodes record — same shape `src/core/wall-model.ts` extracts
 * from. Kept structurally identical (`Record<string, AnyRecord>`) without
 * importing core, so the pl-visual contract stays host-agnostic. */
export type VisualSceneNodes = Record<string, Record<string, unknown>>

export const VISUAL_STAGES = ['S1', 'S2', 'S3', 'S4'] as const
export type VisualStage = (typeof VISUAL_STAGES)[number]

/**
 * Build-order sequence = stage bucket + in-stage index:
 * S1→1000+n, S2→2000+n, S3→3000+n (S4→4000 reserved; Pascal owns openings).
 * Sub-ordering within a stage is wall→course→piece (masonry) / role order
 * (timber), so a stage animation can sort on `sequence` alone.
 */
const STAGE_SEQUENCE_BASE: Record<VisualStage, number> = {
  S1: 1000,
  S2: 2000,
  S3: 3000,
  S4: 4000,
}
export function stageSequenceBase(stage: VisualStage): number {
  return STAGE_SEQUENCE_BASE[stage]
}

/**
 * Stable deterministic part ID: `v1:<sourceId>:<technology>:<path>` with
 * zero-padded 3-wide indices inside `path` (e.g. `course004:piece002`), so
 * lexicographic order == build order. ponytail: fixed 3-width pads cap a
 * group at 999 siblings — widen the pad if a house-scale course ever exceeds
 * that (it won't: a course holds at most a handful of clipped pieces).
 */
export function visualPartId(sourceId: string, technology: string, path: string): string {
  return `v1:${sourceId}:${technology}:${path}`
}

/** PL wall technology — one global choice per level (per-wall override
 * deliberately deferred; see polish-bones-mvp/SPEC.md). */
export const PlVisualTechnology = z.enum(['ceramic', 'aac', 'silicate', 'timber_frame'])
export type PlVisualTechnology = z.infer<typeof PlVisualTechnology>

export const PlVisualFoundation = z.enum(['raft', 'strip'])
export type PlVisualFoundation = z.infer<typeof PlVisualFoundation>

export const PlVisualFloor = z.enum(['concrete_slab', 'timber_joists'])
export type PlVisualFloor = z.infer<typeof PlVisualFloor>

/** PL Visual Mode config on the `bones:framing` node: PRESENCE ACTIVATES the
 * mode (no `enabled` flag; same pattern as `framingSystem`). */
export const PlVisualConfig = z.strictObject({
  technology: PlVisualTechnology,
  foundation: PlVisualFoundation,
  floor: PlVisualFloor,
})
export type PlVisualConfig = z.infer<typeof PlVisualConfig>

const vec3 = z.tuple([z.number(), z.number(), z.number()])

/**
 * One visual construction piece — always a box (dims all positive, position =
 * box centre, rotation = XYZ euler), level-local metres Y-up.
 */
export const VisualPart = z.strictObject({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  levelId: z.string().min(1),
  technology: z.string(),
  stage: z.enum(VISUAL_STAGES),
  sequence: z.number().int().min(0),
  role: z.string(),
  materialId: z.string().min(1),
  shape: z.literal('box'),
  position: vec3,
  rotation: vec3,
  dims: z.tuple([
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
  ]),
  warning: z.string().optional(),
})
export type VisualPart = z.infer<typeof VisualPart>

/** The exported sidecar document. `config` mirrors the JSON Schema's open
 * config object (additionalProperties true) plus the fixed `visualOnly` stamp. */
export const VisualSidecar = z.object({
  schemaVersion: z.literal('visual-bones-v1'),
  unit: z.literal('m'),
  axis: z.literal('Y_UP'),
  sceneHash: z.string().min(8),
  config: z.looseObject({
    ...PlVisualConfig.shape,
    visualOnly: z.literal(true),
  }),
  parts: z.array(VisualPart),
  warnings: z.array(z.string()),
})
export type VisualSidecar = z.infer<typeof VisualSidecar>

/** Diagnostic vocabulary (SPEC.md → Compatibility): engine support, not
 * construction permissibility. */
export type VisualDiagnostic =
  | { kind: 'supported'; message: string }
  | { kind: 'blocked_by_mvp'; message: string }
  | { kind: 'missing_project_data'; message: string }

export type VisualBonesSummary = {
  technology: PlVisualTechnology
  foundation: PlVisualFoundation
  floor: PlVisualFloor
  stageCounts: Record<VisualStage, number>
  diagnostics: VisualDiagnostic[]
}

export type VisualBonesResult = {
  parts: VisualPart[]
  warnings: string[]
  summary: VisualBonesSummary
}
