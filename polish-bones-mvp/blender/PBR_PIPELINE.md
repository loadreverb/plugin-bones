# Blender PBR pipeline (MVP only)

**Current fact:** `pascal-blender` creates Principled BSDF materials from Pascal presets, but `build/common.py::_wire_texture` currently inserts a generated checker placeholder instead of loading the real image. Derived Bones `Member[]` is not recognized by the normal scene node builders. Therefore both a sidecar adapter and image-node loader are required.

## Minimal asset bundle layout

```
export/
  pascal-scene.json
  visual-bones.json
  materials.json
  assets/pbr/
    ceramic_red/basecolor.jpg
    ceramic_red/roughness.jpg
    ceramic_red/normal.jpg
    ...
```

`materials.json` is a mapping `materialId -> { maps: {baseColor, roughness, normal, metallic?}, metersPerRepeat:[u,v], sourceUrl, license:'CC0', checksum }`. Keep file paths **relative** to export root. The `presets.json` names material categories but is NOT a repository of downloadable PBR images. Curate 6–8 appropriate source images from legal CC0 libraries; use texture assets, not specific masonry product photographs. For first demo, `baseColor+roughness+normal` sufficient, optional metalness for roof.

## Import algorithm

1. Import `pascal-scene.json` using the existing `pascal_blender` importer.
2. Parse and JSON-schema-validate `visual-bones.json`; warn when `sceneHash` differs from source scene. No source modification.
3. Reuse scene's per-building/per-level hierarchy but create `Construction/S1_Foundation`, `S2_Structure`, `S3_Roof` as child collections. Keep stage tags also in object custom properties.
4. For each `part.shape='box'`, create one cube mesh / linked data or efficient instances; transform from Pascal Y-up to Blender Z-up once; respect level parent transform and world coordinates. Name based on part ID, not fragile display labels.
5. Create/dedupe Blender node materials by `materialId`: Principled BSDF; `Image Texture` for albedo (sRGB) → Base Color, roughness (Non-Color) → Roughness, normal (Non-Color) → Normal Map → BSDF Normal, optional metallic (Non-Color) → Metallic. Use texcoord mapping scaled by real-world metres per repeat; wood grain oriented to piece length where possible.
6. Set fallback colors **only** when an actual map is missing and include warnings in import report. Checker placeholders are FAIL for the MVP demo.
7. Pack all asset images into `.blend` via Blender image packing and save; ensure a cold reopen renders with network disconnected. No runtime asset fetching required.
8. Collection visibility or object scale/visibility controls create animation from sequence numbers; no baked video inside Pascal browser.

## Source and license
- [ambientCG license (CC0)](https://docs.ambientcg.com/license/) — commercial use, redistribution permitted.
- [Poly Haven license (CC0)](https://polyhaven.com/license/) — commercial use, redistribution permitted; [API](https://polyhaven.com/our-api).
- [Blender glTF material manual](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html) — PBR transport reference if GLB is added later. **Do not use GLB as the source of truth**; native `.blend` scene and sidecar preserve animation control.

## Acceptance
- Blender material node graph contains all three real image maps on at least ceramic, timber and concrete objects.
- UV/repeat-scale meter check across 2m and 4m wall; texture scale not stretched by changing face length.
- Render with fixed camera shows visibly different masonry and timber alternatives.
- Close Blender, disconnect network, reopen .blend — textures remain loaded.
- No duplicate host wall opaque surface over exposed Bones members in animated stages; hide or isolate host shell stage appropriately.
