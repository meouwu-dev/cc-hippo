import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  Node,
  NodeChange,
  Edge,
  EdgeChange,
  Connection,
} from '@xyflow/react'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { ArtifactFile } from './useChat.js'
import {
  loadCanvasStateFn,
  saveCanvasStateFn,
  clearCanvasStateFn,
} from '../server/state.js'
import type { SectionNodeData } from '../components/section-node.js'

export type DevicePreset = 'desktop' | 'tablet' | 'mobile'

export const DEVICE_PRESETS: Record<
  DevicePreset,
  { w: number; h: number; label: string }
> = {
  desktop: { w: 1440, h: 1024, label: 'Desktop 1440×1024' },
  tablet: { w: 768, h: 1024, label: 'Tablet 768×1024' },
  mobile: { w: 390, h: 844, label: 'Mobile 390×844' },
}

// No scale factor — render at 1:1 like Figma, use canvas zoom to navigate

export interface ArtifactNodeData extends Record<string, unknown> {
  file: ArtifactFile
  label: string
  devicePreset?: DevicePreset
  minimized?: boolean
  preMinimizeHeight?: number
}

// Debounce timer for canvas state persistence
let saveTimer: ReturnType<typeof setTimeout> | undefined

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
    width: p.w,
    height: p.h + 36, // +36 for titlebar
  }
}

export function useCanvasNodes(projectId: string, pageId: string) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])

  // Keep refs in sync
  nodesRef.current = nodes
  edgesRef.current = edges

  // Load from SQLite on mount
  useEffect(() => {
    loadCanvasStateFn({ data: { projectId, pageId } }).then((state) => {
      if (state.nodes?.length) setNodes(state.nodes as Node[])
      if (state.edges?.length) setEdges(state.edges as Edge[])
    })
  }, [projectId, pageId])

  const persistCanvas = useCallback(() => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveCanvasStateFn({
        data: {
          projectId,
          pageId,
          nodes: nodesRef.current,
          edges: edgesRef.current,
        },
      })
    }, 500)
  }, [projectId, pageId])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev)
        persistCanvas()
        return next
      })
    },
    [persistCanvas],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((prev) => {
        const next = applyEdgeChanges(changes, prev)
        persistCanvas()
        return next
      })
    },
    [persistCanvas],
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
        persistCanvas()
        return next
      })
    },
    [persistCanvas],
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
        persistCanvas()
        return next
      })
    },
    [persistCanvas],
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
          const existing = prev[existingIdx]
          const wasMinimized = (existing.data as ArtifactNodeData).minimized
          const next = prev.map((n, i) => {
            if (i !== existingIdx) return n
            const d = n.data as ArtifactNodeData
            if (wasMinimized) {
              // Restore from minimized
              const restoreH = d.preMinimizeHeight || 400
              return {
                ...n,
                data: {
                  ...d,
                  file,
                  minimized: false,
                  preMinimizeHeight: undefined,
                },
                style: { ...n.style, height: restoreH },
              }
            }
            return { ...n, data: { ...d, file } }
          })
          persistCanvas()
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
        persistCanvas()
        return next
      })
    },
    [persistCanvas],
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
          persistCanvas()
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
        persistCanvas()
        return next
      })
    },
    [persistCanvas, openArtifact, pageId],
  )

  const toggleMinimizeArtifact = useCallback(
    (id: string) => {
      setNodes((prev) => {
        const next = prev.map((n) => {
          if (n.id !== id) return n
          const d = n.data as ArtifactNodeData
          if (d.minimized) {
            // Restore
            const restoreH = d.preMinimizeHeight || 400
            return {
              ...n,
              data: { ...d, minimized: false, preMinimizeHeight: undefined },
              style: { ...n.style, height: restoreH },
            }
          } else {
            // Minimize — save current height, collapse to title bar
            const curH =
              (n.style?.height as number) || (n.measured?.height ?? 400)
            return {
              ...n,
              data: { ...d, minimized: true, preMinimizeHeight: curH },
              style: { ...n.style, height: 36 },
            }
          }
        })
        persistCanvas()
        return next
      })
    },
    [persistCanvas],
  )

  const closeSection = useCallback(
    (id: string) => {
      setNodes((prev) => {
        // Remove section and all its children
        const next = prev.filter((n) => n.id !== id && n.parentId !== id)
        persistCanvas()
        return next
      })
    },
    [persistCanvas],
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
            width: size.width,
            height: size.height,
            style: { ...n.style, width: size.width, height: size.height },
            measured: undefined,
          }
        })
        persistCanvas()
        return next
      })
    },
    [persistCanvas],
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
        persistCanvas()
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
  }, [setDevicePreset, closeSection, persistCanvas])

  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
    clearCanvasStateFn({ data: { projectId, pageId } })
  }, [projectId, pageId])

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addEdge,
    openArtifact,
    openArtifactBatch,
    toggleMinimizeArtifact,
    closeSection,
    clearCanvas,
  }
}
