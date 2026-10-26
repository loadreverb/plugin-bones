"""bpy side of the Visual Bones companion addon: operator, menu, builder.

Run AFTER the upstream ``pascal_blender`` extension imported the Pascal
scene. Finds the imported level origin empties (custom property
``pascal_level_origin_of``), parents every sidecar box to its level origin,
and groups parts into per-level ``Construction/S1_Foundation | S2_Structure
| S3_Roof`` collections. Never mutates upstream objects: no upstream
datablock is moved, renamed, or re-parented; only NEW objects/collections
are created (the optional S4 grouping links existing door/window objects
into an S4 collection — off by default, opt-in).
"""
from __future__ import annotations

import bpy
from bpy_extras.io_utils import ImportHelper
from bpy.props import BoolProperty  # type: ignore[attr-defined]
from bpy.types import Operator  # type: ignore[attr-defined]

from . import sidecar, visual_materials

UNIT_CUBE = "VB Unit Cube"


def _material(material_id: str, materials: dict, pbr: dict) -> "bpy.types.Material":
    """PBR material when the bundled manifest covers the id, flat color else."""
    mat = pbr.get(material_id)
    if mat is not None:
        return mat
    name = f"VB/{material_id}"
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")  # type: ignore[union-attr]
        entry = materials.get(material_id, {})
        color = sidecar.hex_to_rgb(entry.get("fallbackColor", "#9a9a9a"))
        if bsdf is not None:
            bsdf.inputs["Base Color"].default_value = (*color, 1.0)
            if "metallic" in entry.get("maps", {}):
                bsdf.inputs["Metallic"].default_value = 1.0
    return mat


def _unit_cube_mesh() -> "bpy.types.Mesh":
    mesh = bpy.data.meshes.get(UNIT_CUBE)
    if mesh is None:
        mesh = bpy.data.meshes.new(UNIT_CUBE)
        mesh.from_pydata(
            [(x, y, z) for z in (-0.5, 0.5) for y in (-0.5, 0.5) for x in (-0.5, 0.5)],
            [],
            [
                (0, 1, 3, 2), (4, 6, 7, 5),  # -Z +Z
                (0, 4, 5, 1), (2, 3, 7, 6),  # -Y +Y
                (0, 2, 6, 4), (1, 5, 7, 3),  # -X +X
            ],
        )
        mesh.validate()
    return mesh


def _level_origins() -> dict:
    return {
        obj["pascal_level_origin_of"]: obj
        for obj in bpy.data.objects
        if "pascal_level_origin_of" in obj
    }


def _stage_collection(level_collection, stage_collection_name):
    """(Re)use ``<level>/Construction/<stage>``; returns the stage collection."""
    construction = level_collection.children.get(sidecar.CONSTRUCTION_COLLECTION)
    if construction is None:
        construction = bpy.data.collections.new(sidecar.CONSTRUCTION_COLLECTION)
        level_collection.children.link(construction)
    stage = construction.children.get(stage_collection_name)
    if stage is None:
        stage = bpy.data.collections.new(stage_collection_name)
        construction.children.link(stage)
    return stage


def import_sidecar(filepath: str, group_openings_s4: bool = False) -> tuple[int, list[str]]:
    """Build all parts; returns (object count, report messages)."""
    data = sidecar.load_sidecar(filepath)
    report: list[str] = []

    scene_path = sidecar.find_sibling_scene(filepath)
    if scene_path is None:
        report.append("pascal-scene.json not found next to the sidecar — sceneHash NOT verified")
    else:
        actual = sidecar.scene_file_hash(scene_path)
        if actual != data["sceneHash"]:
            report.append(
                f"sceneHash MISMATCH: sidecar {data['sceneHash']} vs scene file {actual} — "
                "the sidecar was exported from a different scene revision"
            )
        else:
            report.append(f"sceneHash OK ({actual})")

    materials = sidecar.load_materials()
    pbr, pbr_warnings = visual_materials.apply_pbr_materials()
    report.extend(f"pbr: {w}" for w in pbr_warnings)
    plan = sidecar.plan_parts(data)
    origins = _level_origins()
    if not origins:
        report.append(
            "WARNING: no level origins found — import the Pascal scene with the "
            "pascal_blender addon first; parts will land at scene root"
        )

    mesh = _unit_cube_mesh()
    level_collections: dict = {}
    for level_id, origin in origins.items():
        for coll in origin.users_collection:
            level_collections[level_id] = coll
            break

    created = 0
    for p in plan:
        origin = origins.get(p.level_id)
        obj = bpy.data.objects.new(p.name, mesh)
        obj.location = p.location
        obj.rotation_euler = p.rotation
        obj.scale = p.scale
        if origin is not None:
            obj.parent = origin
        for key, value in p.props.items():
            obj[key] = value
        obj.data.materials.append(_material(p.material_id, materials, pbr))

        home = level_collections.get(p.level_id)
        target = _stage_collection(home, p.collection) if home is not None else bpy.context.scene.collection
        target.objects.link(obj)
        created += 1

    if group_openings_s4:
        grouped = 0
        for level_id, coll in level_collections.items():
            openings = [
                o for o in coll.objects
                if o.get("pascal_type") in ("door", "window") and o.type == "MESH"
            ]
            if not openings:
                continue
            s4 = _stage_collection(coll, sidecar.STAGE_COLLECTIONS["S4"])
            for o in openings:
                for src in list(o.users_collection):
                    if src is not s4:
                        src.objects.unlink(o)
                s4.objects.link(o)
                grouped += 1
        report.append(f"S4 grouping: {grouped} door/window objects moved into S4_Openings_Existing")

    for w in data.get("warnings", []):
        report.append(f"exporter: {w}")
    report.append(f"imported {created} visual parts from {filepath}")
    return created, report


class VISUAL_BONES_OT_import_sidecar(Operator, ImportHelper):
    """Import a visual-bones-v1 sidecar (run after the Pascal scene import)"""

    bl_idname = "import_scene.visual_bones_sidecar"
    bl_label = "Import Visual Bones Sidecar (.json)"
    bl_options = {"REGISTER", "UNDO"}

    filename_ext = ".json"
    filter_glob: str = "*.json"  # type: ignore[assignment]

    group_openings_s4: BoolProperty(  # type: ignore[assignment]
        name="Group openings into S4",
        description=(
            "Move the imported door/window objects into the level's "
            "Construction/S4_Openings_Existing collection for stage animation "
            "(reorganizes collections only; pascal data untouched)"
        ),
        default=False,
    )

    def execute(self, context):
        try:
            created, report = import_sidecar(self.filepath, self.group_openings_s4)
        except sidecar.SidecarError as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        for line in report:
            self.report({"WARNING" if line.startswith(("sceneHash MISMATCH", "WARNING", "exporter:")) else "INFO"}, line)
        self.report({"INFO"}, f"Visual Bones: {created} parts imported")
        return {"FINISHED"}


def menu_func(self, context):
    self.layout.operator(
        VISUAL_BONES_OT_import_sidecar.bl_idname, text="Visual Bones Sidecar (.json)"
    )


def register():
    bpy.utils.register_class(VISUAL_BONES_OT_import_sidecar)
    bpy.types.TOPBAR_MT_file_import.append(menu_func)


def unregister():
    bpy.types.TOPBAR_MT_file_import.remove(menu_func)
    bpy.utils.unregister_class(VISUAL_BONES_OT_import_sidecar)
