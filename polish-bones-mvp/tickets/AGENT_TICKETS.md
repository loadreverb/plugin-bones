# Polish Bones MVP — agent tickets

**Only these ten tickets.** Assign one owner per file group; no manufacturer SKU / BOM / regulation work. The blocker is a working end-to-end visual export.

## First vertical slice

PBV-01 + PBV-02 → PBV-03 → PBV-07 → PBV-08 → PBV-09 → **one ceramic wall from Pascal to textured Blender**. Do not begin on speculative extra building technologies first.

## Safe parallelization

- **Wave A:** PBV-01 (types/config), PBV-02 (golden scene), PBR artist researches/curates 6–8 CC0 assets (no Blender code until PBV-08 API agreed).
- **Wave B:** PBV-03 masonry; PBV-08 Blender importer in parallel, bound to the locked JSON schema.
- **Wave C:** PBV-07 exporter; PBV-09 PBR loader; PBV-04 timber; PBV-05 foundations/roof; PBV-06 UI with owner avoiding concurrent edits to shared `panel.tsx`.
- **Wave D:** PBV-10 integrator + tests, screenshots and `.blend` handoff.

## Tickets

### PBV-01 — Lock visual-bones-v1 sidecar contract and PL-mode config
- **Repo:** plugin-bones · **Priority:** P0 · **Dependencies:** none · **Gate:** foundation
- **File ownership:** contracts/visual-bones.schema.json (shared spec), Bones visual DTO / schema adapter, legacy-mode guard
- **Work:** Adopt the JSON contract and add an opt-in `pl-visual-v1` to existing bones:framing config; wire a pure `generateVisualBones(sceneNodes, config, presetData)` public computation seam. Legacy code unaffected. Use meters Y-up, source+level IDs; support warning diagnostics and deterministic ID structure. Do not implement construction math here.
- **Acceptance:**
  - Typecheck and existing Bones test suite pass unchanged
  - Schema v1 golden example validated in JS and Python-compatible validator
  - Legacy framing node missing PL config behaves byte-identically
  - Pure entrypoint returns stable result from empty fixture; warnings defined

### PBV-02 — Golden Pascal house fixture and geometry invariants
- **Repo:** plugin-bones · **Priority:** P0 · **Dependencies:** none · **Gate:** foundation
- **File ownership:** tests/fixtures/pl-demo-house.json, tests/golden-house.test.ts, house QA checklist
- **Work:** Create a small rectangular 1-storey golden source fixture in the actual Pascal scene format, 4 walls, 1 door, 2 windows, 1 slab, gable roof. Prefer an existing Pascal example adapted with documented source boundaries. Separately keep the real PDF-to-Pascal house for visual QA when supplied; do not hallucinate windows/chimney/skylights/pergola. Test extractWalls and unit/coordinate assumptions.
- **Acceptance:**
  - Golden fixture parses through actual Pascal wall/roof/level extraction
  - 4 walls, 1 door, 2 windows, wall thickness and footprint verified exactly
  - Source scene file unchanged by derive and exporter
  - Test fixture includes nonzero rotated wall and nonzero level origin to catch orientation errors

### PBV-03 — Metric masonry course engine for ceramic/AAC/silicate
- **Repo:** plugin-bones · **Priority:** P0 · **Dependencies:** PBV-01, PBV-02 · **Gate:** vertical-slice
- **File ownership:** src/pl-visual/masonry.ts, tests/pl-visual-masonry.test.ts
- **Work:** Single generic masonry algorithm driven by editable preset module length/height/thickness, joint height/width, alternating half-course stagger. Generate box parts and clip at ends, door/window rectangles. Preserve host wall footprint. Build only visual lintel if safe. Technology IDs ceramic, aac, silicate share this one engine; reject bad numeric dims; deterministic order and material IDs.
- **Acceptance:**
  - All 3 material presets render different metric module layouts for same wall
  - No box intersects opening void beyond epsilon
  - Same inputs yield byte-identical sorted output
  - 3m wall and wall rotated 90 degrees pass placement tests
  - Mismatch >0.03m between wall thickness and preset thickness is a warning, never resizes host

### PBV-04 — Visual timber frame generator
- **Repo:** plugin-bones · **Priority:** P1 · **Dependencies:** PBV-01, PBV-02 · **Gate:** technology-variants
- **File ownership:** src/pl-visual/timber.ts, tests/pl-visual-timber.test.ts
- **Work:** Emit metric stud boxes, top/bottom plates, corner and simple header/jamb pieces around original openings; user editable stud section and spacing. No structural load design, no assumed fasteners/engineering. Respect wall axis and source thickness.
- **Acceptance:**
  - Studs/plates and openings follow scene dimensions
  - No stud through door/window cut-out
  - Different spacing changes count deterministically
  - Material ID timber_raw, stage S2 and correct source IDs

### PBV-05 — Visual foundations/floor and safe roof structure
- **Repo:** plugin-bones · **Priority:** P1 · **Dependencies:** PBV-01, PBV-02 · **Gate:** technology-variants
- **File ownership:** src/pl-visual/ground-roof.ts, tests/pl-visual-ground-roof.test.ts
- **Work:** Emit schematic slab or footing ribbon from source footprint using explicit depth config. Optional timber joists / concrete upper floor only if actual source slab exists. Preserve original host pitched roof envelope, tag S3; optional schematic rafters only when roof geometry and skylight/chimney keep-outs reliably extracted, otherwise warning + no invented elements.
- **Acceptance:**
  - Raft or strip outputs S1 parts from footprint without moving walls
  - Only source-defined floor/roof appears; no duplicate inferred floor
  - Roof skylight/chimney unknown => explicit warning, no collider through opening
  - S3 remains represented by original Pascal roof surface even if rafters omitted

### PBV-06 — Bones panel visual technology selector and compatibility rules
- **Repo:** plugin-bones · **Priority:** P0 · **Dependencies:** PBV-01, PBV-03 · **Gate:** integration
- **File ownership:** src/pl-visual/compatibility.ts, src/pl-visual/ui/**, src/framing/schema.ts, src/panel.tsx (coordinator merge)
- **Work:** Add minimal `PL Visual` toggle, technology dropdown (ceramic/aac/silicate/timber), foundation and floor selectors, editable dimension inputs, warnings, and Export Visual Bones button placement (wire it to PBV-07). Compatibility whitelist blocks only MVP-unsupported combinations with correct message, not legal/engineering judgments. Hide/suppress default US output in PL mode.
- **Acceptance:**
  - 4 technology options and supported combinations selectable in real Bones UI
  - Unsupported silicate+timber_joists blocked as unsupported-by-MVP
  - Visual-only label always visible
  - US legacy selector and tests unaffected

### PBV-07 — Deterministic visual-bones.json exporter from exact preview result
- **Repo:** plugin-bones · **Priority:** P0 · **Dependencies:** PBV-01, PBV-03 · **Gate:** vertical-slice
- **File ownership:** src/pl-visual/export.ts, src/pl-visual/export-button.tsx, tests/pl-visual-export.test.ts
- **Work:** Produce visual-bones-v1 JSON via existing browser download conventions, same parts as panel/renderer; include units, Y_UP, scene hash, levelId, sourceId, stage, sequence, materialId, dims/pos/rotation. Do not include generated parts as fake Pascal authoritative nodes. Exports can initially be two files: existing scene JSON + new sidecar. Filename UX and ZIP can be deferred.
- **Acceptance:**
  - Downloads parsable schema-compliant JSON
  - No stale cached geometry after wall edit
  - Same scene/config exports byte-identical JSON
  - Same geometry feeds Pascal preview and sidecar export

### PBV-08 — Blender sidecar import with stage collections
- **Repo:** pascal-blender · **Priority:** P0 · **Dependencies:** PBV-01 · **Gate:** vertical-slice
- **File ownership:** pascal_blender/build/visual_bones.py, pascal_blender/ui/sidecar_import.py or equivalent, tests/test_visual_bones.py
- **Work:** Extend existing Blender importer with an optional second-step visual-bones-v1 sidecar loader. Create box object data with coordinate conversion once and level parent transforms; stage grouping and identity props. Keep original source round-trip untouched and warn on hash/schema mismatch. Don’t alter core Pascal scene importer behavior unnecessarily.
- **Acceptance:**
  - Fixture imports with correct Y-up -> Blender Z-up placement
  - S1/S2/S3 collections and per-part custom props appear
  - Material slots populated from semantic IDs (even color fallback before PBV-09)
  - Save/reopen `.blend` preserves stage control and original Pascal JSON

### PBV-09 — Real local CC0 PBR material loader and sample asset pack
- **Repo:** pascal-blender · **Priority:** P0 · **Dependencies:** PBV-08 · **Gate:** vertical-slice
- **File ownership:** pascal_blender/build/visual_materials.py, assets/pbr/**, materials.json, tests/test_visual_materials.py
- **Work:** Curate a minimal 6–8 CC0 generic texture sets; do not invent URLs, license, product IDs. Implement relative asset file loading, real BSDF node wiring for color (sRGB), roughness/normal (Non-Color), optional metallic; metric UV mapping, library cache; pack images in .blend. Add missing-map warnings. Avoid placeholder checkerboard. Can begin asset collection in parallel with PBV-08, merge after sidecar seam.
- **Acceptance:**
  - Ceramic, AAC, silicate, timber, concrete show distinct realistic surfaces
  - At least ceramic/timber/concrete have real color+roughness+normal maps
  - Offline reopen of .blend renders with packed images
  - Source/license/checksum recorded for every actual bundled asset

### PBV-10 — Wire preview/export/import and pass golden demo acceptance
- **Repo:** cross-repo · **Priority:** P0 · **Dependencies:** PBV-02, PBV-03, PBV-04, PBV-05, PBV-06, PBV-07, PBV-08, PBV-09 · **Gate:** release
- **File ownership:** integration tests, demo/README.md, Blender stage-animation smoke script
- **Work:** Integrator merges agent branches. Run every gate in validation/ACCEPTANCE.md, confirm US regression and lossless importer, record exact commands. Render two fixed-camera stills of one house with ceramic and timber plus tiny stage visibility animation S1→S3. Avoid generating five polished videos and avoid unrelated product catalog/cost work.
- **Acceptance:**
  - Four technology modes render on same source house
  - Browser-preview geometry matches Blender output within 1cm in test
  - Source windows/doors/roof preserved, stages visible, no duplicate opaque host mesh
  - All textures loaded offline, .blend saved, US original tests pass
  - A single reproducible demo command documented
