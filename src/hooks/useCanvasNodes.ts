import { useState, useCallback, useEffect } from 'react'
import type {
  Node,
  NodeChange,
  Edge,
  EdgeChange,
  Connection,
} from '@xyflow/react'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { ArtifactFile } from './useChat.js'
import { idbGet, idbSet, idbDelete } from '../lib/storage.js'
import type { SectionNodeData } from '../components/SectionNode.js'

export type DevicePreset = 'desktop' | 'tablet' | 'mobile'

export const DEVICE_PRESETS: Record<
  DevicePreset,
  { w: number; h: number; label: string }
> = {
  desktop: { w: 1440, h: 900, label: 'Desktop 1440×900' },
  tablet: { w: 768, h: 1024, label: 'Tablet 768×1024' },
  mobile: { w: 375, h: 812, label: 'Mobile 375×812' },
}

// Scale factor for displaying device frames on canvas
const DEVICE_SCALE = 0.4

export interface ArtifactNodeData extends Record<string, unknown> {
  file: ArtifactFile
  label: string
  devicePreset?: DevicePreset
}

const STORAGE_KEY = 'canvas-nodes'
const EDGES_KEY = 'canvas-edges'

const EDGE_COLORS: Record<string, string> = {
  references: '#888',
  implements: '#818cf8',
  derives: '#f59e0b',
  extends: '#10b981',
}

function getEdgeStyle(kind?: string) {
  const color = (kind && EDGE_COLORS[kind]) || '#666'
  return {
    style: { stroke: color, strokeWidth: 2 },
    labelStyle: { fill: color, fontSize: 10 },
  }
}

function getDeviceNodeSize(preset?: DevicePreset) {
  if (!preset) return { width: 480, height: 400 }
  const p = DEVICE_PRESETS[preset]
  return {
    width: Math.round(p.w * DEVICE_SCALE),
    height: Math.round(p.h * DEVICE_SCALE) + 36, // +36 for titlebar
  }
}

export function useCanvasNodes(projectId: string, pageId: string) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  const nodesKey = `${STORAGE_KEY}-${projectId}-${pageId}`
  const edgesKey = `${EDGES_KEY}-${projectId}-${pageId}`

  // Load from IndexedDB on mount
  useEffect(() => {
    Promise.all([idbGet<Node[]>(nodesKey), idbGet<Edge[]>(edgesKey)]).then(
      ([savedNodes, savedEdges]) => {
        if (savedNodes) setNodes(savedNodes)
        if (savedEdges) setEdges(savedEdges)
      },
    )
  }, [nodesKey, edgesKey])

  const persistNodes = useCallback(
    (next: Node[]) => {
      idbSet(nodesKey, next)
    },
    [nodesKey],
  )

  const persistEdges = useCallback(
    (next: Edge[]) => {
      idbSet(edgesKey, next)
    },
    [edgesKey],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev)
        persistNodes(next)
        return next
      })
    },
    [persistNodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((prev) => {
        const next = applyEdgeChanges(changes, prev)
        persistEdges(next)
        return next
      })
    },
    [persistEdges],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        animated: true,
        style: { stroke: '#666', strokeWidth: 2 },
      }
      setEdges((prev) => {
        if (
          prev.some((e) => e.source === edge.source && e.target === edge.target)
        ) {
          return prev
        }
        const next = [...prev, edge]
        persistEdges(next)
        return next
      })
    },
    [persistEdges],
  )

  const addEdge = useCallback(
    (sourcePath: string, targetPath: string, kind?: string) => {
      const sourceId = `artifact-${sourcePath}`
      const targetId = `artifact-${targetPath}`
      setEdges((prev) => {
        if (prev.some((e) => e.source === sourceId && e.target === targetId)) {
          return prev
        }
        const edgeStyle = getEdgeStyle(kind)
        const edge: Edge = {
          id: `e-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          label: kind || undefined,
          animated: kind === 'implements',
          ...edgeStyle,
        }
        const next = [...prev, edge]
        persistEdges(next)
        return next
      })
    },
    [persistEdges],
  )

  const openArtifact = useCallback(
    (file: ArtifactFile) => {
      setNodes((prev) => {
        const existingIdx = prev.findIndex(
          (n) =>
            n.type === 'artifact' &&
            (n.data as ArtifactNodeData).file.path === file.path,
        )
        if (existingIdx !== -1) {
          const next = prev.map((n, i) =>
            i === existingIdx ? { ...n, data: { ...n.data, file } } : n,
          )
          persistNodes(next)
          return next
        }

        // Find free position — avoid overlapping existing nodes
        const artifactNodes = prev.filter((n) => n.type === 'artifact')
        const newNode: Node = {
          id: `artifact-${file.path}`,
          type: 'artifact',
          position: {
            x: 100 + artifactNodes.length * 40,
            y: 100 + artifactNodes.length * 40,
          },
          data: { file, label: file.filename } satisfies ArtifactNodeData,
          style: { width: 480, height: 400 },
        }

        const next = [...prev, newNode]
        persistNodes(next)
        return next
      })
    },
    [persistNodes],
  )

  const openArtifactBatch = useCallback(
    (files: ArtifactFile[], sectionName?: string) => {
      if (files.length === 0) return
      if (files.length === 1 || !sectionName) {
        // Single file — just open normally
        for (const f of files) openArtifact(f)
        return
      }

      setNodes((prev) => {
        // Check which files are already on canvas
        const newFiles = files.filter(
          (f) =>
            !prev.some(
              (n) =>
                n.type === 'artifact' &&
                (n.data as ArtifactNodeData).file.path === f.path,
            ),
        )

        if (newFiles.length === 0) {
          // All files exist — just update content
          const next = prev.map((n) => {
            if (n.type !== 'artifact') return n
            const match = files.find(
              (f) => (n.data as ArtifactNodeData).file.path === f.path,
            )
            return match ? { ...n, data: { ...n.data, file: match } } : n
          })
          persistNodes(next)
          return next
        }

        // Calculate section position based on existing nodes
        const allNodes = prev.filter(
          (n) => n.type !== 'artifact' || !n.parentId,
        )
        const maxY = allNodes.reduce(
          (max, n) =>
            Math.max(max, n.position.y + ((n.style?.height as number) || 400)),
          0,
        )
        const sectionY = maxY + 60
        const sectionX = 100

        const nodeW = 480
        const nodeH = 400
        const gap = 40
        const padding = 40
        const headerH = 50

        // Create section group node
        const sectionId = `section-${crypto.randomUUID()}`
        const sectionW = newFiles.length * (nodeW + gap) - gap + padding * 2
        const sectionH = nodeH + headerH + padding * 2

        const sectionNode: Node = {
          id: sectionId,
          type: 'section',
          position: { x: sectionX, y: sectionY },
          data: {
            label: sectionName,
            sectionId,
            pageId,
          } satisfies SectionNodeData,
          style: { width: sectionW, height: sectionH },
        }

        // Create child artifact nodes positioned inside the section
        const childNodes: Node[] = newFiles.map((file, i) => ({
          id: `artifact-${file.path}`,
          type: 'artifact',
          position: {
            x: padding + i * (nodeW + gap),
            y: headerH + padding,
          },
          parentId: sectionId,
          data: {
            file,
            label: file.filename,
          } satisfies ArtifactNodeData,
          style: { width: nodeW, height: nodeH },
        }))

        // Also update any existing files that got new content
        const updated = prev.map((n) => {
          if (n.type !== 'artifact') return n
          const match = files.find(
            (f) => (n.data as ArtifactNodeData).file.path === f.path,
          )
          return match ? { ...n, data: { ...n.data, file: match } } : n
        })

        const next = [...updated, sectionNode, ...childNodes]
        persistNodes(next)
        return next
      })
    },
    [persistNodes, openArtifact, pageId],
  )

  const closeArtifact = useCallback(
    (id: string) => {
      setNodes((prev) => {
        const next = prev.filter((n) => n.id !== id)
        persistNodes(next)
        return next
      })
      setEdges((prev) => {
        const next = prev.filter((e) => e.source !== id && e.target !== id)
        persistEdges(next)
        return next
      })
    },
    [persistNodes, persistEdges],
  )

  const closeSection = useCallback(
    (id: string) => {
      setNodes((prev) => {
        // Remove section and all its children
        const next = prev.filter((n) => n.id !== id && n.parentId !== id)
        persistNodes(next)
        return next
      })
    },
    [persistNodes],
  )

  const setDevicePreset = useCallback(
    (nodeId: string, preset: DevicePreset | undefined) => {
      setNodes((prev) => {
        const next = prev.map((n) => {
          if (n.id !== nodeId) return n
          const size = getDeviceNodeSize(preset)
          return {
            ...n,
            data: { ...n.data, devicePreset: preset },
            style: { ...n.style, width: size.width, height: size.height },
          }
        })
        persistNodes(next)
        return next
      })
    },
    [persistNodes],
  )

  // Listen for custom events from nodes
  useEffect(() => {
    const handleDevicePreset = (e: Event) => {
      const { id, preset } = (e as CustomEvent).detail
      setDevicePreset(id, preset)
    }
    const handleCloseSection = (e: Event) => {
      const { id } = (e as CustomEvent).detail
      closeSection(id)
    }
    const handleRenameSection = (e: Event) => {
      const { id, name } = (e as CustomEvent).detail
      setNodes((prev) => {
        const next = prev.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label: name } } : n,
        )
        persistNodes(next)
        return next
      })
    }

    window.addEventListener('set-device-preset', handleDevicePreset)
    window.addEventListener('close-section', handleCloseSection)
    window.addEventListener('rename-section', handleRenameSection)
    return () => {
      window.removeEventListener('set-device-preset', handleDevicePreset)
      window.removeEventListener('close-section', handleCloseSection)
      window.removeEventListener('rename-section', handleRenameSection)
    }
  }, [setDevicePreset, closeSection, persistNodes])

  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
    idbDelete(nodesKey)
    idbDelete(edgesKey)
  }, [nodesKey, edgesKey])

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addEdge,
    openArtifact,
    openArtifactBatch,
    closeArtifact,
    closeSection,
    clearCanvas,
  }
}
