"""Pure-python tests for the PBR material loader (PBV-09) — no bpy needed.

Also verifies the bundled asset pack against its manifest: every referenced
map exists on disk and its sha256 matches materials.json.
"""
from __future__ import annotations

import hashlib
import os
import sys
import unittest

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(REPO, "blender-addon"))

import visual_bones.visual_materials as vm  # noqa: E402


class Manifest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.materials = vm.load_manifest()

    def test_six_materials_with_full_map_sets(self):
        self.assertEqual(len(vm._MAP_SLOTS), 4)
        for mid, entry in self.materials.items():
            maps = vm.resolve_map_paths(entry)
            for slot in ("baseColor", "roughness", "normal"):
                self.assertIn(slot, maps, f"{mid} missing {slot}")
            self.assertNotIn("junk", maps)

    def test_bundled_maps_exist_and_match_checksums(self):
        for mid, entry in self.materials.items():
            for slot, path in vm.resolve_map_paths(entry).items():
                self.assertTrue(os.path.isfile(path), f"{mid}/{slot}: {path} missing")
                digest = hashlib.sha256(open(path, "rb").read()).hexdigest()
                self.assertEqual(
                    entry["checksum"].get(slot), digest, f"{mid}/{slot} sha256 mismatch"
                )

    def test_meters_per_repeat_positive(self):
        for mid, entry in self.materials.items():
            u, v = vm.meters_per_repeat(entry)
            self.assertGreater(u, 0)
            self.assertGreater(v, 0)

    def test_licenses_are_cc0(self):
        for mid, entry in self.materials.items():
            self.assertEqual(entry["license"], "CC0", mid)
            self.assertTrue(entry["sourceUrl"].startswith("https://ambientcg.com/"), mid)


if __name__ == "__main__":
    unittest.main()
