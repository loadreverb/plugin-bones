"""Headless bpy end-to-end for the visual_bones companion addon (PBV-08).

Run:
  blender --background --factory-startup \
      --python tests/blender/run_headless_import.py -- <repo_root>

Simulates the upstream pascal_blender state (level collection + level origin
empty + a door object), imports a real sidecar via the addon's own entry
point, and asserts placement/parenting/collections/props/materials plus the
optional S4 grouping. Prints PASS/FAIL lines and exits non-zero on failure.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile

import bpy  # noqa: E402  (Blender's own python)

repo = sys.argv[-1] if "--" in sys.argv else sys.argv[-1]
sys.path.insert(0, os.path.join(repo, "blender-addon"))

import visual_bones.sidecar as vb  # noqa: E402
import visual_bones.operators as ops  # noqa: E402

FAILURES: list[str] = []


def check(label: str, condition: bool) -> None:
    print(("PASS " if condition else "FAIL ") + label)
    if not condition:
        FAILURES.append(label)


def main() -> int:
    # --- fake the upstream import state -------------------------------------
    scene = bpy.context.scene
    level_coll = bpy.data.collections.new("Level 0")
    scene.collection.children.link(level_coll)
    origin = bpy.data.objects.new("Level 0 Origin", None)
    origin["pascal_level_origin_of"] = "level001"
    level_coll.objects.link(origin)
    door_mesh = bpy.data.meshes.new("DoorMesh")
    door = bpy.data.objects.new("Door d001", door_mesh)
    door["pascal_type"] = "door"
    door["pascal_id"] = "door001"
    level_coll.objects.link(door)
    wall = bpy.data.objects.new("Wall w001", None)
    wall["pascal_type"] = "wall"
    wall["pascal_id"] = "wall001"
    level_coll.objects.link(wall)

    # --- a real sidecar + matching sibling scene file ------------------------
    example = os.path.join(repo, "polish-bones-mvp", "contracts", "visual-bones.example.json")
    with open(example, encoding="utf-8") as f:
        sidecar = json.load(f)
    with tempfile.TemporaryDirectory() as tmp:
        scene_path = os.path.join(tmp, "pascal-scene.json")
        with open(scene_path, "w", encoding="utf-8") as f:
            json.dump({"nodes": {}}, f)
        sidecar["sceneHash"] = vb.scene_file_hash(scene_path)
        sidecar_path = os.path.join(tmp, "visual-bones.json")
        with open(sidecar_path, "w", encoding="utf-8") as f:
            json.dump(sidecar, f)

        created, report = ops.import_sidecar(sidecar_path, group_openings_s4=False)
        check(f"created 2 parts (got {created})", created == 2)
        check("sceneHash verified OK", any("sceneHash OK" in r for r in report))

        part_objs = [o for o in bpy.data.objects if "visual_part_id" in o]
        check("two part objects with identity props", len(part_objs) == 2)
        for o in part_objs:
            check(f"{o.name}: parent is level origin", o.parent is origin)
            for key in vb.PART_PROPS:
                check(f"{o.name}: prop {key}", key in o)
            check(f"{o.name}: has VB material", o.data.materials and o.data.materials[0].name.startswith("VB/"))

        # example wall piece: pos [0.125, 0.119, 0] -> blender (0.125, -0, 0.119)
        # (tolerance 1e-5: Blender stores transforms as float32)
        wall_piece = next(o for o in part_objs if o["stage"] == "S2")
        check(
            "wall piece placement (x, -z, y)",
            abs(wall_piece.location.x - 0.125) < 1e-5
            and abs(wall_piece.location.z - 0.119) < 1e-5,
        )
        check(
            "wall piece scale (L, D, H)",
            abs(wall_piece.scale.x - 0.24) < 1e-5
            and abs(wall_piece.scale.y - 0.245) < 1e-5
            and abs(wall_piece.scale.z - 0.226) < 1e-5,
        )

        construction = level_coll.children.get("Construction")
        check("Construction collection under level", construction is not None)
        if construction is not None:
            check("S1_Foundation exists", "S1_Foundation" in construction.children)
            check("S2_Structure exists", "S2_Structure" in construction.children)

        check("door NOT moved without opt-in", door.users_collection and door.users_collection[0] is level_coll)
        check("wall untouched by import", wall.users_collection and wall.users_collection[0] is level_coll)

        # --- opt-in S4 grouping -------------------------------------------------
        created2, report2 = ops.import_sidecar(sidecar_path, group_openings_s4=True)
        check("re-import is idempotent-safe count", created2 == 2)
        s4 = construction.children.get("S4_Openings_Existing") if construction else None
        check("S4 collection after opt-in", s4 is not None)
        check("door moved into S4", s4 is not None and door in s4.objects)
        check("door pascal data untouched", door.get("pascal_id") == "door001")

    print(f"\n{len(FAILURES)} failures")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
