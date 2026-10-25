import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { FramingNode, isPlVisualActive } from '../framing/schema'
import { computeSceneHash, generateVisualBones } from './engine'
import { PL_PRESETS } from './presets'
import { VISUAL_STAGES, VisualPart, VisualSidecar } from './types'

const CERAMIC = { technology: 'ceramic', foundation: 'raft', floor: 'concrete_slab' } as const

describe('PBV-01 · computeSceneHash', () => {
  test('sha256 over exact file bytes, known vector', () => {
    // sha256("abc") — RFC 6234 test vector
    expect(computeSceneHash(new TextEncoder().encode('abc'))).toBe(
      'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('PBV-01 · generateVisualBones seam (pre-engine stub)', () => {
  test('supported combo: zero parts, defined warnings, supported diagnostic', () => {
    const r = generateVisualBones({}, CERAMIC)
    expect(r.parts).toEqual([])
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.summary.diagnostics).toEqual([
      { kind: 'supported', message: 'ceramic+raft+concrete_slab' },
    ])
    expect(r.summary.stageCounts).toEqual({ S1: 0, S2: 0, S3: 0, S4: 0 })
  })

  test('blocked combo: silicate+timber_joists is blocked_by_mvp, not "illegal"', () => {
    const r = generateVisualBones(
      {},
      { technology: 'silicate', foundation: 'strip', floor: 'timber_joists' },
    )
    const blocked = r.summary.diagnostics.find((d) => d.kind === 'blocked_by_mvp')
    expect(blocked).toBeDefined()
    expect(blocked?.message).toContain('unsupported by current engine')
    expect(r.parts).toEqual([])
  })

  test('timber_frame+timber_joists is supported (SPEC G3)', () => {
    const r = generateVisualBones(
      {},
      { technology: 'timber_frame', foundation: 'raft', floor: 'timber_joists' },
    )
    expect(r.summary.diagnostics[0]?.kind).toBe('supported')
  })

  test('deterministic: identical across calls and JSON key permutations', () => {
    const a = generateVisualBones(
      { w1: { id: 'w1', type: 'wall' }, w2: { id: 'w2', type: 'wall' } },
      CERAMIC,
    )
    const b = generateVisualBones(
      { w2: { type: 'wall', id: 'w2' }, w1: { type: 'wall', id: 'w1' } },
      { floor: 'concrete_slab', technology: 'ceramic', foundation: 'raft' },
    )
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('PBV-01 · framing schema: opt-in plVisual, legacy byte-parity', () => {
  test('node without plVisual parses with NO plVisual key injected', () => {
    const parsed = FramingNode.parse({ jurisdiction: 'INTL' })
    expect('plVisual' in parsed).toBe(false)
  })

  test('node with plVisual round-trips the config untouched', () => {
    const parsed = FramingNode.parse({ jurisdiction: 'INTL', plVisual: CERAMIC })
    expect(parsed.plVisual).toEqual(CERAMIC)
  })

  test('malformed plVisual is rejected', () => {
    expect(() =>
      FramingNode.parse({ jurisdiction: 'INTL', plVisual: { technology: 'bogus' } }),
    ).toThrow()
  })

  test('isPlVisualActive legacy guard', () => {
    expect(isPlVisualActive({})).toBe(false)
    expect(isPlVisualActive({ plVisual: undefined })).toBe(false)
    expect(isPlVisualActive({ plVisual: CERAMIC })).toBe(true)
    expect(isPlVisualActive({ plVisual: { technology: 'bogus' } })).toBe(false)
  })
})

describe('PBV-01 · sidecar contract sync (TS mirror ↔ canonical JSON Schema)', () => {
  const example = JSON.parse(
    readFileSync('polish-bones-mvp/contracts/visual-bones.example.json', 'utf8'),
  )
  const schema = JSON.parse(
    readFileSync('polish-bones-mvp/contracts/visual-bones.schema.json', 'utf8'),
  )

  test('zod mirror accepts the golden example sidecar', () => {
    expect(VisualSidecar.safeParse(example).success).toBe(true)
  })

  test('part required keys + enums match the JSON Schema exactly', () => {
    const part = schema.$defs.part
    const zodRequired = Object.entries(VisualPart.shape)
      .filter(([, v]) => !v.isOptional())
      .map(([k]) => k)
    const schemaRequired = [...part.required]
    expect(schemaRequired.sort()).toEqual([...zodRequired].sort())
    expect(part.properties.stage.enum).toEqual([...VISUAL_STAGES])
    expect(part.properties.shape.const).toBe('box')
    expect(part.properties.dims.items.exclusiveMinimum).toBe(0)
    expect(part.additionalProperties).toBe(false)
    expect(schema.properties.schemaVersion.const).toBe('visual-bones-v1')
    expect(schema.properties.unit.const).toBe('m')
    expect(schema.properties.axis.const).toBe('Y_UP')
  })

  test('python jsonschema also validates the example (cross-language contract)', () => {
    const py = spawnSync('python', ['-c', [
      'import json, jsonschema',
      "example = json.load(open('polish-bones-mvp/contracts/visual-bones.example.json', encoding='utf-8'))",
      "schema = json.load(open('polish-bones-mvp/contracts/visual-bones.schema.json', encoding='utf-8'))",
      'jsonschema.validate(example, schema)',
      "print('ok')",
    ].join('\n')])
    if (py.error) {
      console.warn('python unavailable — skipping python validator check:', py.error.message)
      return
    }
    expect(py.status).toBe(0)
    expect(py.stdout.toString()).toContain('ok')
  })
})

describe('PBV-01 · presets load and validate', () => {
  test('four technologies, compatibility table covers all of them', () => {
    expect(PL_PRESETS.wallTechnologies.map((t) => t.id).sort()).toEqual([
      'aac',
      'ceramic',
      'silicate',
      'timber_frame',
    ])
    for (const t of PL_PRESETS.wallTechnologies) {
      expect(PL_PRESETS.compatibility[t.id]).toBeDefined()
    }
  })
})
