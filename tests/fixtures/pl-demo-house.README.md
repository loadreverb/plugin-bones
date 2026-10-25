# pl-demo-house.json — the golden PL fixture

Rectangular one-storey detached house, whole footprint **rotated 10°** about the
origin so every wall is non-axis-aligned (orientation-error catcher, ticket
PBV-02). Node shapes cribbed from `src/core/wall-model.test.ts` synthetic
scenes (the extractor's own ground truth) with roof shape from
`src/engines/roof-framing.ts::extractRoofs`; overall layout informed by
pascal-blender's `examples/demo-house.json` (read-only reference clone).

## QA checklist

| Item | Value |
|---|---|
| Walls | 4, external, thickness 0.25 m, height 2.8 m, all non-axis-aligned (10° rotation) |
| Footprint | 8.0 m × 6.0 m external rectangle (centrelines), rotated 10° |
| Door | 1 — `wall_pl_south` at u=2.0, 0.9 × 2.05 m, sill 0 (floor-bound), rough 1.0 × 2.15 m |
| Windows | 2 — `wall_pl_east` at u=1.5 and u=4.5, 1.2 × 1.2 m, sill 0.9 m, rough 1.3 × 1.3 m |
| Slab | 1 — footprint polygon, thickness 0.2 m |
| Roof | 1 gable — 8 × 6 m, pitch 40°, overhang 0.3 m, at wall-top height |
| Level | `level_pl1`, storey 0, height 2.8 m, baseElevation 0.35 m (nonzero origin) |
| Not present (never hallucinated) | chimney, skylights, pergola, terrace, upper storey |

Rough openings are set explicitly so the imperial nominal+1.5″ shim default
never enters PL-mode geometry.
