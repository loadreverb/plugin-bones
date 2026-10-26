import { useScene } from '@pascal-app/core'
import { useState } from 'react'
import { buildSidecar, sidecarJsonBytes } from './export'
import type { PlVisualConfig } from './types'

/**
 * Export Visual Bones button (PBV-07). Downloads pascal-scene.json +
 * visual-bones.json in one click (sceneHash covers the exact scene bytes
 * emitted here). The panel mounts it (PBV-06); it is deliberately dumb:
 * config in, two files out, errors inline.
 */

function downloadJson(filename: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function ExportVisualBonesButton({ config }: { config: PlVisualConfig }) {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <button
        className="rounded-md border border-sidebar-ring bg-sidebar-accent px-3 py-2 text-left font-medium text-sm transition-colors hover:bg-sidebar-accent/70"
        type="button"
        onClick={() => {
          setError(null)
          try {
            const { nodes, rootNodeIds } = useScene.getState()
            const { sidecar, sceneBytes } = buildSidecar(
              nodes as unknown as Record<string, Record<string, unknown>>,
              rootNodeIds,
              config,
            )
            downloadJson('pascal-scene.json', sceneBytes)
            downloadJson('visual-bones.json', sidecarJsonBytes(sidecar))
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        🧱 Export Visual Bones
        <span className="block font-normal text-sidebar-foreground/50 text-xs">
          pascal-scene.json + visual-bones.json · visual only
        </span>
      </button>
      {error && (
        <p className="rounded-md border border-sidebar-ring/60 bg-sidebar-accent px-2 py-1 text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
