"""Real local CC0 PBR materials for Visual Bones parts (PBV-09).

Wires bundled texture sets (``materials.json`` + ``assets/pbr/**``) into
Principled BSDF node graphs:

    Geometry Position (world) -> Mapping (scale 1/metersPerRepeat)
        -> Image Texture (Box projection)
              baseColor sRGB  -> Base Color
              roughness Non-Color -> Roughness
              normal    Non-Color -> Normal Map -> Normal
              metallic  Non-Color -> Metallic (optional)

World-aligned metric mapping keeps every part — a shared instanced unit
cube, object-scaled — textured at true real-world scale (spec: planar/
world-aligned metric scale; timber grain follows world axes, the honest
v1 ceiling). Images are packed into the .blend at import so a cold reopen
renders with the network disconnected. Missing maps fall back to the flat
color with a visible warning — never a checkerboard placeholder.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Tuple

_MAP_SLOTS = ("baseColor", "roughness", "normal", "metallic")
_COLORSPACE = {"baseColor": "sRGB", "roughness": "Non-Color", "normal": "Non-Color", "metallic": "Non-Color"}

_ADDON_ROOT = os.path.dirname(os.path.abspath(__file__))


def load_manifest() -> Dict[str, Dict[str, Any]]:
    import json

    with open(os.path.join(_ADDON_ROOT, "materials.json"), encoding="utf-8") as f:
        return json.load(f).get("materials", {})


def resolve_map_paths(entry: Dict[str, Any]) -> Dict[str, str]:
    """Relative manifest map paths -> absolute file paths (addon root)."""
    maps = entry.get("maps", {})
    return {
        slot: os.path.join(_ADDON_ROOT, maps[slot])
        for slot in _MAP_SLOTS
        if slot in maps and isinstance(maps[slot], str)
    }


def meters_per_repeat(entry: Dict[str, Any]) -> Tuple[float, float]:
    mpr = entry.get("metersPerRepeat", [1.0, 1.0])
    u = float(mpr[0]) if len(mpr) > 0 and float(mpr[0]) > 0 else 1.0
    v = float(mpr[1]) if len(mpr) > 1 and float(mpr[1]) > 0 else 1.0
    return (u, v)


def build_pbr_material(material_id: str, entry: Dict[str, Any]):
    """(Re)build VB/<id> with real image nodes. Returns (material, warnings).

    bpy-only; pure helpers above stay testable without Blender.
    """
    import bpy

    warnings: List[str] = []
    name = f"VB/{material_id}"
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    if not mat.use_nodes:
        mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:  # pragma: no cover - Blender always provides one
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")

    # Idempotent rebuild: drop previously created loader nodes.
    for n in [x for x in nt.nodes if x.get("vb_loader")]:
        nt.nodes.remove(n)

    paths = resolve_map_paths(entry)
    existing = {slot: path for slot, path in paths.items() if os.path.isfile(path)}
    missing = [s for s in paths if s not in existing]
    if missing:
        warnings.append(f"VB/{material_id}: missing {', '.join(missing)} map(s) — flat fallback")

    u, v = meters_per_repeat(entry)
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.0 / u, 1.0 / v, 1.0 / u)
    mapping["vb_loader"] = True
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    geo["vb_loader"] = True
    nt.links.new(mapping.inputs["Vector"], geo.outputs["Position"])

    def texture(slot: str):
        path = existing[slot]
        img = bpy.data.images.load(path, check_existing=True)
        img.name = f"VB {material_id} {slot}"[:63]
        img.colorspace_settings.name = _COLORSPACE[slot]
        if img.packed_file is None:
            img.pack()  # cold-reopen offline guarantee
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.projection = "BOX"  # world-aligned planar per face
        tex["vb_loader"] = True
        nt.links.new(tex.inputs["Vector"], mapping.outputs["Vector"])
        return tex

    if "baseColor" in existing:
        nt.links.new(bsdf.inputs["Base Color"], texture("baseColor").outputs["Color"])
    if "roughness" in existing:
        nt.links.new(bsdf.inputs["Roughness"], texture("roughness").outputs["Color"])
    if "normal" in existing:
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap["vb_loader"] = True
        nt.links.new(nmap.inputs["Color"], texture("normal").outputs["Color"])
        nt.links.new(bsdf.inputs["Normal"], nmap.outputs["Normal"])
    if "metallic" in existing:
        nt.links.new(bsdf.inputs["Metallic"], texture("metallic").outputs["Color"])

    return mat, warnings


def apply_pbr_materials():
    """Build all manifest materials. Returns (materials, warnings)."""
    mats: Dict[str, Any] = {}
    warnings: List[str] = []
    for material_id, entry in load_manifest().items():
        mat, warns = build_pbr_material(material_id, entry)
        mats[material_id] = mat
        warnings.extend(warns)
    return mats, warnings
