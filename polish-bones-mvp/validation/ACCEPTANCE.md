# Required MVP acceptance (no feature-creep)

## G0 — Repository/contract smoke
- Two forks/clones runnable in dev; existing Bones tests still pass; Blender addon headless import still passes.
- `visual-bones-v1` example validates against schema and TS/Python both read it.

## G1 — One vertical slice FIRST
- Pascal scene containing one 3m+ wall, a real window, and a real door produces course blocks in Pascal UI, avoiding their bounding rectangles.
- Click Export Visual Bones: a `.json` is produced with positive metric dims, stable IDs, correct source IDs, correct S2 stages.
- Blender imports source Pascal scene + the exported derived JSON. A ceramic wall is shown, with a **real** ceramic PBR texture on the blocks (not color-only, not a checker placeholder). A `.blend` opens offline.

## G2 — Four technologies
- Same unchanged house scene switches ceramic/AAC/silicate/timber. Masonry styles have distinct editable modular proportions; timber generates studs, plates, headers and jambs.
- No extra/moved window/door, no pergola/chimney/roof-light hallucination. No more than 0.01m transform deviation after axis+level conversion for canonical test parts.
- Current source wall thickness kept. >3cm preset mismatch warns; no silent envelope changes.

## G3 — Roof/foundation + rules
- One foundation is visible at S1; wall/floor structure at S2; roof envelope/optional framing at S3, existing windows/doors usable at S4.
- `silicate+timber_joists` is blocked in MVP and states 'unsupported by current engine' (not 'illegal'); `timber_frame+timber_joists` supported. Missing roof opening geometry yields warning and no invented framing.

## G4 — Stage animation-ready
- Blender separates parts into S1/S2/S3 collections; part properties carry stage/sequence/material/source IDs; visibility can be controlled without renaming.
- Can show side-by-side stills of same house with ceramic vs timber, and render a short stage-visibility test from S1 through S3.
- Existing Pascal JSON remains available losslessly in `.blend`; no fake engineering/permit or BOM claims.

## Explicit non-gates
**Not required for MVP:** real manufacturer model, supplier price, exact number of bricks, reinforcement layout, Teriva/Filigran, wall thermal layers, full MEP, final five videos, any 3D browser delivery, fully automatic PDF parsing.
