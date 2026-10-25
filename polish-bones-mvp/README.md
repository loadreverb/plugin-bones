# Polish Bones — visual MVP handoff

**Scope locked 2026-10-25.** Visualization-only Polish technologies for Pascal → Bones → Blender. **Not** manufacturer SKUs, cost estimating, structural calculations, legal compliance, manufacturer-level quantities, auto-permitting or precise detail of every building material.

## Start here

1. Give `agents/ORCHESTRATOR_PROMPT.md` to your coordinating AI coding agent, with access to clones/forks of `pascalorg/plugin-bones` (master) and `pascalorg/pascal-blender` (main), and the actual Pascal demo house JSON / blueprint PDF if available.
2. Implement tickets **PBV-01 + PBV-02 → PBV-03 → PBV-07 → PBV-08 → PBV-09** first: one ceramic wall plus Blender texture is a real vertical slice. Then run PBV-04,05,06,09,10.
3. Accept only when `validation/ACCEPTANCE.md` passes with exported `.blend` showing correct house openings and ceramic/AAC/silicate/timber alternatives.

## Files
- `SPEC.md`: short spec in the `to-spec` structure, locked engineering seams, scope.
- `catalog/presets.json`: schematic dimensional presets, not manufacturer product measurements.
- `contracts/visual-bones.schema.json`: stable JSON construction/export contract.
- `contracts/visual-bones.example.json`: representative visual parts.
- `blender/PBR_PIPELINE.md`: working-texture import/export contract.
- `tickets/AGENT_TICKETS.md` + `tickets/github-issues.json`: ten owner-isolated tickets.
- `agents/ORCHESTRATOR_PROMPT.md`: copy/paste agent instruction for the first implementation action.
- `research/SOURCES.md`: authoritative pointers and repository seams.
- `validation/ACCEPTANCE.md`: test gates and demo pass criteria.

## Nonnegotiable
- The approved/documented house is source of truth. Never invent windows, roof lights, chimneys, terrace/pergola or roof geometry to make it pretty.
- Unit = metres. No US inches or US regulatory assumptions in PL visual mode.
- Geometry is a **visual construction illustration**. Do not label it engineered, verified, approved or exact bill of materials.
- The Five-Clip Contract belongs to Estimates Factory. MVP supplies stage-tagged objects; generating five videos is a downstream production step.
- No browser-side heavy 3D as production output. Export and render offline in Blender.
