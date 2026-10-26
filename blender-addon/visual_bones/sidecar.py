"""Polish Bones visual sidecar (``visual-bones-v1``) — pure planning layer.

Companion addon to the upstream ``pascal_blender`` extension: the user
imports the Pascal scene with the upstream importer first, then imports the
``visual-bones.json`` sidecar here. This module is deliberately bpy-free so
it is unit-testable without Blender; :mod:`visual_bones.operators` owns all
bpy work.

Axis conversion mirrors upstream ``pascal_blender/core/coords.py`` (the same
permutation the glTF importer uses; baked into data):

    location  (x, y, z)_pascal -> (x, -z, y)_blender
    box dims  (L, H, D)_pascal -> (L, D, H)_blender   (local X along wall,
               Y across, Z up after conversion)
    euler XYZ (0, yaw, 0)      -> (0, 0, yaw)          (Y-rotation -> Z)

Visual illustration only — never engineering (polish-bones-mvp/SPEC.md).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

SCHEMA_VERSION = "visual-bones-v1"

# Schema ships with the addon; validated with jsonschema when available,
# structurally otherwise (Blender does not bundle jsonschema).
_HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(_HERE, "contracts", "visual-bones.schema.json")
MATERIALS_PATH = os.path.join(_HERE, "materials.json")

STAGE_COLLECTIONS = {
    "S1": "S1_Foundation",
    "S2": "S2_Structure",
    "S3": "S3_Roof",
    "S4": "S4_Openings_Existing",
}
CONSTRUCTION_COLLECTION = "Construction"
PART_PROPS = (
    "visual_part_id",
    "source_id",
    "stage",
    "sequence",
    "technology",
    "material_id",
)


class SidecarError(Exception):
    """Unreadable, invalid or mismatched sidecar."""


# --- axis conversion (mirror of upstream coords.py) -----------------------

def loc_to_blender(v: Sequence[float]) -> Tuple[float, float, float]:
    return (float(v[0]), -float(v[2]), float(v[1]))


def dims_to_blender(v: Sequence[float]) -> Tuple[float, float, float]:
    """Pascal box dims (length, height, depth) -> Blender local (x, y, z)."""
    return (float(v[0]), float(v[2]), float(v[1]))


def euler_to_blender(v: Sequence[float]) -> Tuple[float, float, float]:
    return (float(v[0]), -float(v[2]), float(v[1]))


# --- sidecar IO + validation ----------------------------------------------

def scene_file_hash(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return f"sha256:{h.hexdigest()}"


def _structural_check(data: Any) -> None:
    def fail(msg: str) -> None:
        raise SidecarError(f"sidecar structural check failed: {msg}")

    if not isinstance(data, dict):
        fail("root is not an object")
    for key in ("schemaVersion", "unit", "axis", "sceneHash", "config", "parts", "warnings"):
        if key not in data:
            fail(f"missing '{key}'")
    if data["schemaVersion"] != SCHEMA_VERSION:
        fail(f"schemaVersion {data['schemaVersion']!r} != {SCHEMA_VERSION!r}")
    if data["unit"] != "m" or data["axis"] != "Y_UP":
        fail("unit/axis must be 'm'/'Y_UP'")
    if not isinstance(data["parts"], list):
        fail("'parts' is not a list")
    required = ("id", "sourceId", "levelId", "technology", "stage", "sequence",
                "role", "materialId", "shape", "position", "rotation", "dims")
    for i, part in enumerate(data["parts"]):
        if not isinstance(part, dict):
            fail(f"part[{i}] is not an object")
        for key in required:
            if key not in part:
                fail(f"part[{i}] missing '{key}'")
        if part["shape"] != "box":
            fail(f"part[{i}] shape {part['shape']!r} unsupported (v1 = boxes only)")
        for key in ("position", "rotation", "dims"):
            if len(part[key]) != 3:  # type: ignore[arg-type]
                fail(f"part[{i}] {key} is not a 3-vector")
        if min(part["dims"]) <= 0:  # type: ignore[arg-type]
            fail(f"part[{i}] dims must be positive")


def validate_sidecar(data: Any) -> None:
    """jsonschema when available (dev machines), structural fallback always."""
    try:
        import jsonschema  # type: ignore[import-not-found]
    except ImportError:
        _structural_check(data)
        return
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        schema = json.load(f)
    try:
        jsonschema.validate(data, schema)
    except jsonschema.ValidationError as exc:  # pragma: no cover - message passthrough
        raise SidecarError(f"schema validation failed: {exc.message}") from exc


def load_sidecar(path: str) -> Dict[str, Any]:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        raise SidecarError(f"cannot read sidecar: {exc}") from exc
    validate_sidecar(data)
    return data


def find_sibling_scene(sidecar_path: str) -> Optional[str]:
    """Sibling ``pascal-scene.json`` next to the sidecar, if present."""
    base = os.path.dirname(os.path.abspath(sidecar_path))
    candidate = os.path.join(base, "pascal-scene.json")
    return candidate if os.path.isfile(candidate) else None


# --- materials -------------------------------------------------------------

def load_materials() -> Dict[str, Dict[str, Any]]:
    with open(MATERIALS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("materials", {})


def hex_to_rgb(h: str) -> Tuple[float, float, float]:
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", h.strip())
    if not m:
        return (0.6, 0.6, 0.6)
    n = int(m.group(1), 16)
    return ((n >> 16 & 255) / 255.0, (n >> 8 & 255) / 255.0, (n & 255) / 255.0)


# --- planning (pure: sidecar -> object plan) -------------------------------

@dataclass
class PlannedPart:
    name: str
    part_id: str
    level_id: str
    stage: str
    collection: str
    location: Tuple[float, float, float]
    rotation: Tuple[float, float, float]
    scale: Tuple[float, float, float]
    material_id: str
    props: Dict[str, Any] = field(default_factory=dict)


def object_name(part_id: str) -> str:
    """Part ID as object name; identity also lives in visual_part_id."""
    return part_id if len(part_id) <= 63 else f"{part_id[:55]}..{abs(hash(part_id)) % 0xFFFF:04X}"


def plan_parts(sidecar: Dict[str, Any]) -> List[PlannedPart]:
    plan: List[PlannedPart] = []
    for part in sidecar["parts"]:
        stage = str(part["stage"])
        plan.append(
            PlannedPart(
                name=object_name(str(part["id"])),
                part_id=str(part["id"]),
                level_id=str(part["levelId"]),
                stage=stage,
                collection=STAGE_COLLECTIONS.get(stage, CONSTRUCTION_COLLECTION),
                location=loc_to_blender(part["position"]),
                rotation=euler_to_blender(part["rotation"]),
                scale=dims_to_blender(part["dims"]),
                material_id=str(part["materialId"]),
                props={
                    "visual_part_id": str(part["id"]),
                    "source_id": str(part["sourceId"]),
                    "stage": stage,
                    "sequence": int(part["sequence"]),
                    "technology": str(part["technology"]),
                    "material_id": str(part["materialId"]),
                },
            )
        )
    return plan
