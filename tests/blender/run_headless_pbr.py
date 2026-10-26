"""Headless bpy PBR end-to-end for visual_bones (PBV-09).

Run:
  blender --background --factory-startup \
      --python tests/blender/run_headless_pbr.py -- <repo_root>

Imports a real sidecar with PBR materials, asserts real Image Texture nodes
(not placeholders), correct colorspaces, packed images, then saves the
.blend, reopens it and asserts the packed images survive offline.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile

import bpy  # noqa: E402

repo = sys.argv[-1]
sys.path.insert(0, os.path.join(repo, "blender-addon"))

import visual_bones.sidecar as vb  # noqa: E402
import visual_bones.operators as ops  # noqa: E402

FAILURES: list[str] = []


def check(label: str, condition: bool) -> None:
    print(("PASS " if condition else "FAIL ") + label)
    if not condition:
        FAILURES.append(label)


def image_nodes(mat):
    return [n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image]


def main() -> int:
    level_coll = bpy.data.collections.new("Level 0")
    bpy.context.scene.collection.children.link(level_coll)
    origin = bpy.data.objects.new("Level 0 Origin", None)
    origin["pascal_level_origin_of"] = "level001"
    level_coll.objects.link(origin)

    example = os.path.join(repo, "polish-bones-mvp", "contracts", "visual-bones.example.json")
    with open(example, encoding="utf-8") as f:
        sidecar = json.load(f)
    with tempfile.TemporaryDirectory() as tmp:
        scene_path = os.path.join(tmp, "pascal-scene.json")
        with open(scene_path, "w", encoding="utf-8") as f:
            json.dump({"nodes": {}}, f)
        sidecar["sceneHash"] = vb.scene_file_hash(scene_path)
        # exercise ceramic (wall part) + concrete (slab part) from the example
        sidecar_path = os.path.join(tmp, "visual-bones.json")
        with open(sidecar_path, "w", encoding="utf-8") as f:
            json.dump(sidecar, f)

        created, report = ops.import_sidecar(sidecar_path)
        check("parts imported", created == 2)

        for mid in ("ceramic_red", "concrete_raw"):
            mat = bpy.data.materials.get(f"VB/{mid}")
            check(f"VB/{mid} exists", mat is not None)
            if mat is None:
                continue
            texes = image_nodes(mat)
            slots = {t.image.name.split(" ")[-1] for t in texes}
            check(f"VB/{mid}: real image texture nodes (baseColor+roughness+normal)",
                  {"baseColor", "roughness", "normal"} <= slots)
            for t in texes:
                img = t.image
                slot = img.name.split(" ")[-1]
                want = "sRGB" if slot == "baseColor" else "Non-Color"
                check(f"VB/{mid}/{slot}: colorspace {want}",
                      img.colorspace_settings.name == want)
                check(f"VB/{mid}/{slot}: packed into .blend", img.packed_file is not None)
            bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            linked = {sock.name for sock in bsdf.inputs if sock.is_linked}
            check(f"VB/{mid}: Base Color wired from image", "Base Color" in linked)

        # timber too (not used by this sidecar, but must build identically)
        import visual_bones.visual_materials as vm
        mats, warns = vm.apply_pbr_materials()
        check("no missing-map warnings for bundled sets", warns == [])
        check("timber_raw has 3+ image nodes",
              len(image_nodes(mats["timber_raw"])) >= 3)

        blend = os.path.join(tmp, "vb.blend")
        bpy.ops.wm.save_as_mainfile(filepath=blend)
        bpy.ops.wm.open_mainfile(filepath=blend)
        packed = [i.name for i in bpy.data.images if i.packed_file is not None]
        check(f"reopen offline: packed images survive ({len(packed)} found)", len(packed) >= 6)

    print(f"\n{len(FAILURES)} failures")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
