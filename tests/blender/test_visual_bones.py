"""Pure-python tests for the visual_bones companion addon (no bpy needed).

Run: python -m unittest discover -s tests/blender -p "test_*.py"
(the headless bpy end-to-end lives in run_headless_import.py)
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import unittest

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(REPO, "blender-addon"))

import visual_bones.sidecar as vb  # noqa: E402

EXAMPLE = os.path.join(REPO, "polish-bones-mvp", "contracts", "visual-bones.example.json")


class Conversions(unittest.TestCase):
    def test_loc(self):
        # (x, y, z)_pascal -> (x, -z, y)_blender (upstream coords.py permutation)
        self.assertEqual(vb.loc_to_blender([1.0, 2.0, 3.0]), (1.0, -3.0, 2.0))

    def test_dims(self):
        # Pascal (L, H, D) -> Blender local (x=L along wall, y=D across, z=H up)
        self.assertEqual(vb.dims_to_blender([0.24, 0.226, 0.245]), (0.24, 0.245, 0.226))

    def test_euler_yaw_only(self):
        # [0, yaw, 0] -> (0, 0, yaw): Pascal Y-rotation becomes Blender Z-rotation
        self.assertEqual(vb.euler_to_blender([0.0, 1.25, 0.0]), (0.0, 0.0, 1.25))


class SidecarValidation(unittest.TestCase):
    def test_golden_example_loads(self):
        data = vb.load_sidecar(EXAMPLE)
        self.assertEqual(data["schemaVersion"], "visual-bones-v1")
        self.assertEqual(len(data["parts"]), 2)

    def test_structural_rejects_missing_key(self):
        with self.assertRaises(vb.SidecarError):
            vb._structural_check({"schemaVersion": "visual-bones-v1"})

    def test_structural_rejects_non_box(self):
        with open(EXAMPLE, encoding="utf-8") as f:
            data = json.load(f)
        data["parts"][0]["shape"] = "sphere"
        with self.assertRaises(vb.SidecarError):
            vb._structural_check(data)

    def test_structural_rejects_bad_dims(self):
        with open(EXAMPLE, encoding="utf-8") as f:
            data = json.load(f)
        data["parts"][0]["dims"] = [0.1, 0.0, 0.1]
        with self.assertRaises(vb.SidecarError):
            vb._structural_check(data)


class Hashing(unittest.TestCase):
    def test_scene_file_hash(self):
        with tempfile.NamedTemporaryFile("wb", suffix=".json", delete=False) as f:
            f.write(b"abc")
            path = f.name
        try:
            want = "sha256:" + hashlib.sha256(b"abc").hexdigest()
            self.assertEqual(vb.scene_file_hash(path), want)
        finally:
            os.unlink(path)

    def test_find_sibling_scene(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertIsNone(vb.find_sibling_scene(os.path.join(d, "visual-bones.json")))
            open(os.path.join(d, "pascal-scene.json"), "wb").close()
            self.assertEqual(
                vb.find_sibling_scene(os.path.join(d, "visual-bones.json")),
                os.path.join(d, "pascal-scene.json"),
            )


class Planning(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(EXAMPLE, encoding="utf-8") as f:
            cls.data = json.load(f)

    def test_plan_parts_mapping(self):
        plan = vb.plan_parts(self.data)
        self.assertEqual(len(plan), 2)
        wall = next(p for p in plan if p.stage == "S2")
        self.assertEqual(wall.collection, "S2_Structure")
        self.assertEqual(wall.level_id, "level001")
        self.assertEqual(wall.material_id, "ceramic_red")
        # example wall piece: pos [0.125, 0.119, 0], dims [0.24, 0.226, 0.245]
        self.assertEqual(wall.location, (0.125, -0.0, 0.119))
        self.assertEqual(wall.scale, (0.24, 0.245, 0.226))
        # identity props for animation/traceability
        for key in vb.PART_PROPS:
            self.assertIn(key, wall.props)

    def test_object_name_truncation(self):
        long_id = "v1:" + "x" * 100
        name = vb.object_name(long_id)
        self.assertLessEqual(len(name), 63)
        self.assertNotEqual(name, long_id)


class Materials(unittest.TestCase):
    def test_manifest_loads_with_fallbacks(self):
        mats = vb.load_materials()
        self.assertEqual(
            set(mats),
            {"ceramic_red", "aac_white", "silicate_gray", "timber_raw", "concrete_raw", "roof_graphite"},
        )
        for entry in mats.values():
            self.assertTrue(entry["fallbackColor"].startswith("#"))
            self.assertIn("baseColor", entry["maps"])
            self.assertIn("roughness", entry["maps"])
            self.assertIn("normal", entry["maps"])

    def test_hex_to_rgb(self):
        self.assertEqual(vb.hex_to_rgb("#b46c4c"), (0xb4 / 255, 0x6c / 255, 0x4c / 255))
        self.assertEqual(vb.hex_to_rgb("junk"), (0.6, 0.6, 0.6))


if __name__ == "__main__":
    unittest.main()
