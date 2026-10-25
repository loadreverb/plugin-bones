# Copy to the main coding agent

You are the integration lead for `Polish Bones Visual MVP` inside Estimates Factory. Do not research more technologies or build product catalogs. Make the existing repos run and complete the shortest end-to-end pipeline: Pascal house JSON → visual masonry members → sidecar JSON → editable Blender scene with **real local PBR maps**, with structure grouped for animation.

## Inputs
- This folder: `README.md`, `SPEC.md`, `catalog/presets.json`, `contracts/visual-bones.schema.json`, `tickets/AGENT_TICKETS.md`, `validation/ACCEPTANCE.md`.
- Writable repo: this plugin-bones fork only. Keep `https://github.com/pascalorg/pascal-blender` (main) as a **read-only reference clone** (conventions: coordinate conversion, hierarchy, custom props); all new code — TypeScript and the companion Blender addon (`blender-addon/`) — lands in this fork.
- Use actual Pascal demo JSON from the user's house when supplied; otherwise use golden fixture based on `pascal-blender/examples/demo-house.json`. Do not pretend you received a real PDF if absent.

## Your FIRST concrete action
Create the sidecar contract adapter and prove `one Pascal wall with an opening -> PL ceramic members -> sidecar -> Blender import -> actual ceramic PBR material`. That end-to-end slice beats ten individually finished modules.

## Parallel agent ownership
1. **Contract agent** — PBV-01, owns shared schema and Bones visual DTO.
2. **Fixture/QA agent** — PBV-02, owns tiny real Pascal JSON golden scene and geometry/orientation tests.
3. **Masonry agent** — PBV-03, owns metric course algorithm, untouched legacy US code.
4. **Blender bridge agent** — PBV-08, owns the companion addon (`blender-addon/`): sidecar importer, hierarchy, stable IDs, coordinate transforms.
5. **PBR agent** — PBV-09, owns actual CC0 image sets, manifest, shader nodes and image packing.
6. **Integration agent (you)** — PBV-07 exporter and merge. Assign PBV-04 timber, PBV-05 foundations/roof, PBV-06 UI to agents only after the vertical slice works. PBV-10 is the final merge.

## Execution discipline
- Start with `git status`, `README`, scripts, tests, and real plugin interface. Don't guess exact signatures.
- Changes isolated to owned paths; require a short merge note for shared `compute.ts`, `schema.ts`, `panel.tsx`.
- Treat `generateVisualBones` and `visual-bones-v1` JSON as the single interoperability contract. No second renderer-specific shadow geometry.
- Check original Pascal scene stays unmodified and US functionality untouched.
- Do not create wood-frame structural approvals/loads, material takeoffs, pricing, roof framing when roof openings aren't safely known.
- Every ticket ends with: summary of files touched, runnable command(s), test results, one screenshot or sample artifact when applicable, next dependency unblocked.
- If a blocker appears, implement simplest reversible adapter rather than rebuilding Pascal Editor, switching engines, or inventing a new product database.

## Final definition of done
Run all `validation/ACCEPTANCE.md` checks. Produce a scene JSON, a sidecar JSON, a `.blend` that reopens offline with working image maps, and two fixed-camera screenshots (ceramic, timber). Produce a brief summary of anything not visually modeled yet. If real house drawings are available, perform human review of openings and roof before calling the render faithful.
