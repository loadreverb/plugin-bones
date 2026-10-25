# Sources and fact-vs-assumption register

## Code seams verified in source
- [Bones `src/core/wall-model.ts`](https://github.com/pascalorg/plugin-bones/blob/master/src/core/wall-model.ts) — wall/slab/level extracts.
- [Bones `src/framing/compute.ts`](https://github.com/pascalorg/plugin-bones/blob/master/src/framing/compute.ts) — central pure compute level, must dispatch PL without breaking original.
- [Bones `src/framing/schema.ts`](https://github.com/pascalorg/plugin-bones/blob/master/src/framing/schema.ts) — current US/CMU/lumber/LGS options; add separate visual mode.
- [Bones `src/core/types.ts`](https://github.com/pascalorg/plugin-bones/blob/master/src/core/types.ts) — `Member` uses box dims / position and material enum; adapter required to preserve semantic material IDs.
- [Bones `src/framing/renderer.tsx`](https://github.com/pascalorg/plugin-bones/blob/master/src/framing/renderer.tsx) — instanced boxes and preview colors.
- [Bones `src/panel.tsx`](https://github.com/pascalorg/plugin-bones/blob/master/src/panel.tsx) — existing UI and downloads.
- [Blender `pascal_blender/build/importer.py`](https://github.com/pascalorg/pascal-blender/blob/main/pascal_blender/build/importer.py) — existing importer recognizes common Pascal node types, not derived Bones parts.
- [Blender `pascal_blender/build/common.py`](https://github.com/pascalorg/pascal-blender/blob/main/pascal_blender/build/common.py) — `_wire_texture` uses generated image placeholders; replace/extend in sidecar material loader.
- [Blender `pascal_blender/core/materials.py`](https://github.com/pascalorg/pascal-blender/blob/main/pascal_blender/core/materials.py) — basic preset color/roughness/metallic mapping.

## First-party technology manuals (used as context; DO NOT copy proprietary geometry/dimension tables without checking terms)
- [Wienerberger Porotherm technical guidelines](https://www.wienerberger.pl/content/dam/wienerberger/poland/marketing/documents-magazines/brochures/PL_MKT_DOC_POR_wytyczne_projektowo_wykonawcze_porotherm.pdf): ceramic course/masonry, openings, lintels.
- [Wienerberger Porotherm BIM elements](https://www.wienerberger.pl/narzedzia-i-pliki-do-pobrania/pustaki-ceramiczne-porotherm/porotherm-detale-bim.html): proof that ceramic systems have distinct wall/lintel/ring-beam representations, not required for MVP assets.
- [Ytong masonry manual](https://storefrontapi.commerce.xella.com/medias/sys_master/images/hfd/h8f/9194484203550/Poradnik%20murowania%20Ytong%202024-02/Poradnik-murowania-Ytong-2024-02.pdf): AAC laying and openings.
- [H+H technical notebooks](https://www.hplush.pl/pl-pl/do-pobrania/zeszyty-techniczne): AAC/silicate system context.
- [State Forests timber framing guidelines](https://bystrzyca.wroclaw.lasy.gov.pl/documents/21700348/43603871/Wytyczne+projektowania+i+realizacji+drewnianych+budynk%C3%B3w+szkieletowych.pdf/2b6f28c8-d82a-0cfb-097c-c96207a4108e): wall stud framing context; no load design in app.
- [Formee Filigran instructions](https://formee.pl/pdf/instrukcja-montazu-stropow-filigran.pdf): project-specific engineer-defined details; **excluded from MVP**.
- [Ruukki roof installation documents](https://www.ruukki.com/pol/dachy/wsparcie/dokumenty-do-pobrania/instrukcje-montazu-pokrycia-dachowe): roof layer background; **MVP uses existing Pascal roof envelope**.

## Explicit assumptions
The preset module sizes in `catalog/presets.json` are **schematic editable demonstration values**, not sourced manufacturer product dimensions. Compatibility whitelist represents only ENGINE SUPPORT in this MVP, NOT Polish structural/design permissibility. All geometry derived from source house and selected visual cross-sections remains a visualization, not a permit or engineering statement. Required actual design dimensions are read from the Pascal project or provided as user configuration, never claimed to have been calculated structurally.
