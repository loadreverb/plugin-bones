"""Visual Bones — Polish Bones companion addon for Blender 4.2+.

Imports the ``visual-bones-v1`` sidecar exported by the Bones Pascal plugin
(fork: loadreverb/plugin-bones) after the upstream ``pascal_blender``
extension imported the Pascal scene. Adds Construction stage collections
with real metric box parts carrying stable identity properties, ready for
the PBR material loader and stage-visibility animation.

Visualization only — a construction illustration, never engineering.
"""
from __future__ import annotations

bl_info = {
    "name": "Visual Bones Sidecar Importer",
    "author": "loadreverb",
    "version": (0, 1, 0),
    "blender": (4, 2, 0),
    "location": "File > Import > Visual Bones Sidecar (.json)",
    "description": "Import visual-bones-v1 construction sidecars (companion to pascal_blender)",
    "category": "Import-Export",
}


def register():
    from . import operators

    operators.register()


def unregister():
    from . import operators

    operators.unregister()
