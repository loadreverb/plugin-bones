import { z } from 'zod'
import presetsJson from '../../data/pl-presets.json'

/**
 * Schematic VISUAL-ONLY preset modules (data/pl-presets.json — runtime copy of
 * polish-bones-mvp/catalog/presets.json). Editable demonstration values, NOT
 * manufacturer dimensions; the user/project should supply real selections.
 */

const pos = z.number().positive()

const MasonryModule = z.strictObject({
  length: pos,
  height: pos,
  thickness: pos,
  horizontalJoint: z.number().min(0),
  verticalJoint: z.number().min(0),
  courseOffsetFraction: z.number().min(0).max(1),
})

const TimberStud = z.strictObject({
  width: pos,
  depth: pos,
  spacing: pos,
  plateHeight: pos,
})

const WallTechnology = z.discriminatedUnion('family', [
  z.strictObject({
    id: z.string(),
    name: z.string(),
    family: z.literal('masonry'),
    module: MasonryModule,
    materialId: z.string(),
    status: z.string(),
  }),
  z.strictObject({
    id: z.string(),
    name: z.string(),
    family: z.literal('framing'),
    stud: TimberStud,
    materialId: z.string(),
    status: z.string(),
  }),
])

export const PlPresets = z.strictObject({
  schemaVersion: z.literal('visual-presets-v1'),
  disclaimer: z.string(),
  unit: z.literal('m'),
  wallTechnologies: z.array(WallTechnology),
  foundations: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      fields: z.array(z.string()),
      /** Schematic visual defaults (metres), overridable by project config. */
      defaults: z.record(z.string(), z.number()).optional(),
    }),
  ),
  floors: z.array(z.strictObject({ id: z.string(), name: z.string() })),
  roof: z.strictObject({ supportedType: z.string(), strategy: z.string() }),
  compatibility: z.record(
    z.string(),
    z.strictObject({ foundations: z.array(z.string()), floors: z.array(z.string()) }),
  ),
  materials: z.array(
    z.strictObject({
      id: z.string(),
      description: z.string(),
      assets: z.string(),
      fallbackColor: z.string(),
    }),
  ),
})

export type PlPresets = z.infer<typeof PlPresets>
export type PlWallTechnology = z.infer<typeof WallTechnology>

/** Parsed once at module load — bad preset data fails loudly and early. */
export const PL_PRESETS: PlPresets = PlPresets.parse(presetsJson)
