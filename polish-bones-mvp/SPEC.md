# SPEC: Polish Bones — visualization-only MVP

**State:** ready for coding agents after repo checkout. **Date:** 2026-10-25. **Priority:** first make it exist. **Replaces** the former 88-family catalog/product/engineering/takeoff roadmap for this deliverable.

## Problem Statement
Pascal can hold the architecture of a house recreated by an AI agent from Polish building drawings; Bones currently derives American-style structural/MEP members. We need to illustrate how the *same house* looks when constructed with Polish ceramic masonry, AAC, silicate masonry or timber framing and animate construction steps in Blender with believable PBR textures. The existing Blender importer does not automatically get the derived Bones geometry, and `material.texture` currently creates only placeholder images.

## Solution
Fork `pascalorg/plugin-bones` and `pascalorg/pascal-blender` only. Add a separate **PL Visual Mode** inside Bones; keep the original US calculation pipeline intact. Use existing Pascal `wall`, `door`, `window`, `slab`, `roof`, `level` scene nodes and Bones' `extractWalls`, `extractSlabs`, `extractLevels`, `extractRoofs` or equivalent source geometry extractors. An AI agent prepares the Pascal scene from the PDF; that scene is checked before selecting a visual technology.

New pure deterministic API (conceptual contract, implementation may use existing types):

`generateVisualBones(sceneNodes, config, presets) → { parts, warnings, summary }`

`parts` contain per-piece box dimensions/placement (metres; level-local; Pascal axes X,Y-up,Z), stable IDs, source node ID, visual material, technology, build stage and sequence. A thin renderer adapter presents them in Bones; a sidecar JSON export passes identical pieces to the Blender importer. Blender imports the original Pascal scene plus the sidecar, uses stage collections, joins actual local PBR maps into Principled BSDF nodes and saves an editable `.blend`.

## MVP user stories
1. As a visualization creator, I want a house reconstructed from its drawings in Pascal, so structural illustrations use the right footprint, openings, roof and levels.
2. As a creator, I want to select `ceramic`, `aac`, `silicate`, or `timber_frame`, so I can render different construction technologies without changing the house outline.
3. As a creator, I want editable representative block/stud dimensions, so piece layout is deterministic and visibly convincing.
4. As a creator, I want incompatible foundation/floor/wall combinations blocked, so I do not generate nonsensical illustrated assemblies.
5. As a creator, I want automatic block courses or stud framing around the original doors and windows, so openings remain intact.
6. As a creator, I want one simple foundation, floor and pitched-roof visualization, so construction clips contain more than walls.
7. As a creator, I want the same generated parts in Pascal and Blender, so geometry does not shift on export.
8. As a Blender artist, I want named material slots with local CC0 PBR maps, so generic ceramic, AAC, silicate, timber, concrete, roof metal and facade look realistic.
9. As a Blender artist, I want parts grouped by S1/S2/S3/S4, with stable IDs, so I can animate assembly and render stage transitions.
10. As an agent maintainer, I want one golden house fixture with exact wall/window/door assertions, so parallel agents cannot accidentally change the building.
11. As a creator, I want a clear warning for missing roof opening data or incompatible thickness, so a visualization does not silently misrepresent the plans.

## Locked decisions

### Scope, supported combinations
- **One detached house** in MVP; prioritize **one ground floor and a pitched gable roof**, expanding to extra levels after the vertical slice. Pascal architectural host geometry stays authoritative.
- **Wall technologies:** `ceramic`, `aac`, `silicate` share one metric masonry coursing engine; `timber_frame` uses one metric stud framing engine. Select globally, allow per-wall override only if cheap to support; otherwise defer overrides explicitly.
- **Foundation visualization:** `raft` (single generic slab) or `strip` (footing ribbons + simple perimeter wall + ground slab); visual dimensions supplied by scene/config, never calculated from soil/load.
- **Floor above ground:** `concrete_slab` for masonry, `timber_joists` for timber; if no upper storey, no invented suspended floor.
- **Roof:** keep Pascal's *exact host roof envelope and openings*. Draw simplified rafters/trusses **only when slope data and safe keep-outs are available**; otherwise export host roof unmodified with a warning. S3 roof covering is a visual material on the existing roof surface, not thousands of physically accurate tiles.
- **Openings:** doors/windows remain Pascal-owned. S4 is imported from Pascal; Bones must not replace/reposition them. Chimney/skylights/pergola remain Pascal-owned; never infer them.
- **Materials:** generic technology surfaces and PBR texture sets; brand, SKU, detailed microgeometry and product quantities are out of scope.
- **Stages:** S1 foundation; S2 walls and applicable floor; S3 roof/frame/covering; S4 Pascal windows/doors (tag if feasible). Do not fake S5–S8 installations or claim they exist. Preserve five-video contract downstream: video 1/S0, video 2/S1, video 3/S2, video 4/S3–S4, video 5/S5–S8 visual finish/handover from actual modeled source only.
- **No estimates:** counts may be logged for diagnostics; no construction cost, supplier SKU, bill of materials, structural capacity, approvals or legal recommendations.

### Dimensions & layout
- All lengths in metres; presets are editable *schematic starting values*. Prefer user/project values where given. `source wall thickness` and opening positions/size are authoritative. A preset-width mismatch beyond 0.03m raises a visible warning; do not resize/move original wall/outer envelope.
- Masonry: courses based on configured block length/height, mortar joint; alternate half-course running bond. Clip/reduce pieces at ends and openings. No bricks or mortar visible inside rectangular opening voids. Simplified lintels/ring beams are *illustrative only*, not specified reinforcement.
- Timber: configurable stud width/depth, spacing, bottom/top plates, corner members and opening headers/jambs; all box geometry. No load/span/fastener/connector engineering.
- Shape limits: boxes for masonry, studs, beams, slab segments, generic strips. Unknown/nonrectilinear geometry triggers an explicit visualization limitation; never corrupt house or create implicit substituted geometry.
- Deterministic output: same input+config yields same part IDs, positions, dimensions, sequence, materials independent of JSON node ordering. No uncontrolled randomness.
- Isolation: adding PL mode MUST NOT change any original US/Canada legacy modes or introduce imperial defaults into PL mode.

### Compatibility (visual whitelist, not engineering rules)
- `ceramic|aac|silicate` → `concrete_slab`, and `raft|strip` foundation, `gable_pitched` host roof permitted.
- `timber_frame` → `timber_joists` or `concrete_slab` floor, and `raft|strip` foundation, `gable_pitched` host roof permitted.
- Visual incompatibilities (e.g. `silicate` + `timber_joists` in this limited engine) are BLOCKED, because engine support is absent, **not because the construction method is impossible in reality**.
- Missing geometry metadata (roof slopes/openings) yields warnings / component omissions, not invented geometry. Use clearly different `supported`, `blocked_by_mvp`, `missing_project_data` diagnostics.

### Pascal plugin integration
- Add optional PL visual configuration to the existing `bones:framing` node (no new building editor). A toggle and technology/foundation/floor selector in the existing Bones panel is enough; no new complicated app UX.
- Do not extend US jurisdiction tables or masquerade US CMU / timber rules as Polish standards. Dispatch PL mode to a new pure visual engine (reuse slice extractors), adapt generated parts to the current instanced `Member[]` renderer. Suppress legacy US members while PL mode is active to prevent duplication. One code path supplies both preview and JSON export.
- No frontend downloads of assets required for preview: flat/color material fallback in Pascal; real PBR in Blender.
- Preferred export: `pascal-scene.json` (existing editor export) PLUS `visual-bones.json` (new button). Bundling both with `assets/` into a ZIP may follow if no friction. The addon imports both using sibling filename lookup or a second import action (minimal invasive route).

### Blender integration & texture behavior
- Source scene first, derived sidecar second. Preserve importer’s lossless Pascal scene round-trip; don't persist derived parts as fake authoritative Pascal source nodes. New stage collections `Construction/S1_Foundation`, `S2_Structure`, `S3_Roof`, optional `S4_Openings_Existing`.
- Convert from Pascal Y-up to Blender Z-up **exactly once**, using existing coordinate conversion helpers. Preserve level-local / storey transformations and original source node IDs.
- Reuse cube meshes per shape+material where possible (linked meshes/instances); no costly per-block unique high-poly mesh. Every part gets stable custom properties `visual_part_id`, `source_id`, `stage`, `sequence`, `technology`, `material_id`.
- PBR materials: use local files with relative paths, `Base Color` sRGB, `Roughness` and `Normal` Non-Color, Normal Map node, optional Metallic/Height. Planar/world-aligned metric scale; timber grain follows beams when possible. **No remote fetch required during Blender import**. Package or pack textures into `.blend` at export time.
- Reference PBR assets from ambientCG and Poly Haven under CC0; asset IDs, source/license, checksums recorded in `materials.json`. Avoid manually inventing/download links in preset data.
- Cycles or Eevee output. UV fallback and color fallback are permissible only with a visible report; successful demo texture QA must show actual image texture nodes, not generated checker placeholders.

## Implementation decisions / module seams
- `PLUGIN CORE`: one pure `generateVisualBones` receives extracted source slices and config; new masonry and timber generators; small compatibility validator and preset loader.
- `PLUGIN ADAPTER`: extend `bones:framing` config, Bones panel, compute/preview renderer and sidecar export action; legacy default unchanged.
- `BLENDER ADDON`: sidecar importer invoked after normal Pascal importer; PBR material asset loader; collection and per-part data properties.
- `SHARED CONTRACT`: `contracts/visual-bones.schema.json` is the interface between TypeScript and Python. Add schema versioning and a fixture used by both repos.
- `TEST SEAM`: pure visual engine -> exact sidecar fixture -> Blender headless stage/material verification. Few narrow unit tests for course/opening math; don't test hidden implementation shape except where needed.

## Testing Decisions
- **Golden fixed house:** rectangular one-storey dwelling with four walls, one door, two windows, slab, gable roof. Assert counts and positions of openings unchanged, no visual blocks inside openings, 4 technologies load, supported/blocked matrix works, source scene unchanged.
- Snapshot sidecar stable across calls and node permutations; every positive-volume piece lies within its source wall/footprint except explicitly permitted visual lintel/roof overlap.
- Blender headless: import Pascal JSON + visual sidecar + packaged texture assets; ensure distinct S1/S2/S3 collections, correct scale/orientation, stable IDs, real Image Texture nodes and image file availability; `.blend` saves and reopens offline.
- Regression: original Bones tests pass for legacy US mode. Exceptions logged; no silent part displacement, no fake roof structure when roof openings unknown.
- Visual QA fixed screenshot: ceramic blocks/wood stud framing visibly different and PBR surfaces are not checkerboard; render minimum one matching camera shot for two variants.

## Out of Scope
Exact material SKUs, suppliers, costs, quantity takeoffs, thermal/moisture/fire structural calculations, actual build approval, installation design, MEP routing, full S5-S8 modeled systems, accurate rebar and floor systems (Teriva/Filigran/CLT/LGS), manufacturer-specific lintel/bond-beam engineering, all roof designs, highly detailed texture scanning, automatic error-free PDF-to-Pascal reconstruction, in-browser cinematic renderer, Blender-to-Pascal round-trip.

## Further Notes
- The earlier exhaustive Polish Bones catalog is NOT part of this MVP. The only four modes above are accepted initial scope.
- `visual-only` is a prominent UI/export label. A wall can be accurately located but a construction breakdown remains illustrative.
- The developer owns only visual correctness; architects/engineers own actual design and structural decisions.
- Ticket publishing must target a fork writable by the user's agents; these are prepared drafts, not published issues.
