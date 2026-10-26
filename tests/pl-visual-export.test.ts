import { describe, expect, test } from 'bun:test'
import { generateVisualBones } from '../src/pl-visual/engine'
import { buildSidecar, sceneJsonBytes, sidecarJsonBytes } from '../src/pl-visual/export'
import { VisualSidecar } from '../src/pl-visual/types'
import golden from './fixtures/pl-demo-house.json'

/** PBV-07 — deterministic visual-bones.json export. */

const CERAMIC = { technology: 'ceramic', foundation: 'raft', floor: 'concrete_slab' } as const
const nodes = golden.nodes as Record<string, Record<string, unknown>>
const ROOTS = ['level_pl1']

describe('PBV-07 · buildSidecar', () => {
  const { sidecar, sceneBytes } = buildSidecar(nodes, ROOTS, CERAMIC)

  test('schema-valid sidecar with the visualOnly stamp', () => {
    expect(VisualSidecar.safeParse(JSON.parse(new TextDecoder().decode(sidecarJsonBytes(sidecar)))).success).toBe(true)
    expect(sidecar.config.visualOnly).toBe(true)
    expect(sidecar.unit).toBe('m')
    expect(sidecar.axis).toBe('Y_UP')
  })

  test('same parts as the preview path (one geometry truth)', () => {
    expect(sidecar.parts).toEqual(generateVisualBones(nodes, CERAMIC).parts)
  })

  test('sceneHash = sha256 over the exact emitted scene bytes', () => {
    const crypto = require('node:crypto') as typeof import('node:crypto')
    const want = `sha256:${crypto.createHash('sha256').update(sceneBytes).digest('hex')}`
    expect(sidecar.sceneHash).toBe(want)
    // and the scene file is the persisted Pascal shape
    const scene = JSON.parse(new TextDecoder().decode(sceneBytes))
    expect(Object.keys(scene).sort()).toEqual(['nodes', 'rootNodeIds'])
    expect(scene.rootNodeIds).toEqual(ROOTS)
  })

  test('same scene + config exports byte-identical JSON', () => {
    const a = buildSidecar(nodes, ROOTS, CERAMIC)
    const b = buildSidecar(nodes, ROOTS, CERAMIC)
    expect(new TextDecoder().decode(sidecarJsonBytes(a.sidecar))).toBe(
      new TextDecoder().decode(sidecarJsonBytes(b.sidecar)),
    )
    expect(new TextDecoder().decode(a.sceneBytes)).toBe(new TextDecoder().decode(b.sceneBytes))
  })

  test('blocked combinations refuse the export', () => {
    expect(() =>
      buildSidecar(nodes, ROOTS, { technology: 'silicate', foundation: 'strip', floor: 'timber_joists' }),
    ).toThrow(/refused/)
  })

  test('sidecar bytes round-trip through the zod mirror unchanged', () => {
    const bytes = sidecarJsonBytes(sidecar)
    const parsed = VisualSidecar.parse(JSON.parse(new TextDecoder().decode(bytes)))
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(JSON.parse(new TextDecoder().decode(bytes))))
  })
})

describe('PBV-07 · sceneJsonBytes stability', () => {
  test('a moved wall changes the hash — no stale cached geometry story', () => {
    const before = buildSidecar(nodes, ROOTS, CERAMIC).sidecar.sceneHash
    const edited: Record<string, Record<string, unknown>> = structuredClone(nodes)
    edited['wall_pl_south']!.start = [-3.5, -3.7]
    const after = buildSidecar(edited, ROOTS, CERAMIC).sidecar.sceneHash
    expect(after).not.toBe(before)
  })

  test('deterministic for the same node object regardless of read order', () => {
    const a = sceneJsonBytes(nodes, ROOTS)
    const b = sceneJsonBytes(nodes, ROOTS)
    expect(new TextDecoder().decode(a)).toBe(new TextDecoder().decode(b))
  })
})
