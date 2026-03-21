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
  loadCanvasDataFn,
  saveArtifactPositionFn,
  saveArtifactMinimizedFn,
} from '../server/state.js'
import type { SectionNodeData } from '../components/section-node.js'
import type { ArtifactRow, EdgeRow, SectionRow } from '../mcp/db.js'

export type DevicePreset = 'desktop' | 'tablet' | 'mobile'

export const DEVICE_PRESETS: Record<
  DevicePreset,
  { w: number; h: number; label: string }
> = {
  desktop: { w: 1440, h: 1024, label: 'Desktop 1440×1024' },
  tablet: { w: 768, h: 1024, label: 'Tablet 768×1024' },
  mobile: { w: 390, h: 844, label: 'Mobile 390×844' },
}

export interface ArtifactNodeData extends Record<string, unknown> {
  file: ArtifactFile
  label: string
  artifactId: string
  devicePreset?: DevicePreset
  minimized?: boolean
  preMinimizeHeight?: number
}

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
    height: p.h + 36,
  }
}

// Convert DB rows to React Flow nodes/edges
function artifactToNode(a: ArtifactRow): Node {
  return {
    id: `artifact-${a.path}`,
    type: 'artifact',
    position: { x: a.position_x, y: a.position_y },
    data: {
      file: {
        path: a.path,
        filename: a.filename,
        content: a.content,
        version: 1,
      },
      label: a.filename,
      artifactId: a.id,
      devicePreset: a.device_preset as DevicePreset | undefined,
      minimized: a.minimized === 1,
      preMinimizeHeight: a.pre_minimize_height ?? undefined,
    } satisfies ArtifactNodeData,
    style: {
      width: a.width,
      height: a.minimized ? 36 : a.height,
    },
    parentId: a.section_id ? `section-${a.section_id}` : undefined,
  }
}

function sectionToNode(s: SectionRow): Node {
  return {
    id: `section-${s.id}`,
    type: 'section',
    position: { x: s.position_x, y: s.position_y },
    data: {
      label: s.name,
      sectionId: s.id,
      pageId: s.page_id,
    } satisfies SectionNodeData,
    style: { width: s.width, height: s.height },
  }
}

function edgeRowToEdge(e: EdgeRow, artifacts: ArtifactRow[]): Edge | null {
  const source = artifacts.find((a) => a.id === e.source_artifact_id)
  const target = artifacts.find((a) => a.id === e.target_artifact_id)
  if (!source || !target) return null
  const sourceId = `artifact-${source.path}`
  const targetId = `artifact-${target.path}`
  const edgeStyle = getEdgeStyle(e.kind)
  return {
    id: `e-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    label: e.kind || undefined,
    animated: e.kind === 'implements',
    ...edgeStyle,
  }
}

// Debounce helper for position saves
const positionTimers = new Map<string, ReturnType<typeof setTimeout>>()

function debouncedSavePosition(
  artifactId: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const existing = positionTimers.get(artifactId)
  if (existing) clearTimeout(existing)
  positionTimers.set(
    artifactId,
    setTimeout(() => {
      positionTimers.delete(artifactId)
      saveArtifactPositionFn({
        data: { artifactId, x, y, w, h },
      })
    }, 500),
  )
}

export function useCanvasNodes(projectId: string, pageId: string) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])

  nodesRef.current = nodes
  edgesRef.current = edges

  // Load from relational tables on mount
  useEffect(() => {
    loadCanvasDataFn({ data: { projectId, pageId } }).then((data) => {
      const sectionNodes = data.sections.map(sectionToNode)
      const artifactNodes = data.artifacts.map(artifactToNode)
      const flowEdges = data.edges
        .map((e) => edgeRowToEdge(e, data.artifacts))
        .filter((e): e is Edge => e !== null)

      setNodes([...sectionNodes, ...artifactNodes])
      setEdges(flowEdges)
    })
  }, [projectId, pageId])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => {
      const next = applyNodeChanges(changes, prev)

      // Persist position/dimension changes for artifact nodes
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const node = next.find((n) => n.id === change.id) as Node | undefined
          if (node?.type === 'artifact') {
            const d = node.data as ArtifactNodeData
            const w = (node.style?.width as number) || 480
            const h = (node.style?.height as number) || 400
            debouncedSavePosition(
              d.artifactId,
              change.position.x,
              change.position.y,
              w,
              h,
            )
          }
        }
        if (change.type === 'dimensions' && change.dimensions) {
          const node = next.find((n) => n.id === change.id)
          if (node?.type === 'artifact') {
            const d = node.data as ArtifactNodeData
            debouncedSavePosition(
              d.artifactId,
              node.position.x,
              node.position.y,
              change.dimensions.width,
              change.dimensions.height,
            )
          }
        }
      }

      return next
    })
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev))
  }, [])

  const onConnect = useCallback((connection: Connection) => {
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
      return [...prev, edge]
    })
  }, [])

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
        return [...prev, edge]
      })
    },
    [],
  )

  const openArtifact = useCallback((file: ArtifactFile) => {
    setNodes((prev) => {
      const existingIdx = prev.findIndex(
        (n) =>
          n.type === 'artifact' &&
          (n.data as ArtifactNodeData).file.path === file.path,
      )
      if (existingIdx !== -1) {
        const existing = prev[existingIdx]
        const wasMinimized = (existing.data as ArtifactNodeData).minimized
        return prev.map((n, i) => {
          if (i !== existingIdx) return n
          const d = n.data as ArtifactNodeData
          if (wasMinimized) {
            const restoreH = d.preMinimizeHeight || 400
            saveArtifactMinimizedFn({
              data: {
                artifactId: d.artifactId,
                minimized: false,
              },
            })
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
      }

      // New node — position based on existing artifact count
      const artifactNodes = prev.filter((n) => n.type === 'artifact')
      const newNode: Node = {
        id: `artifact-${file.path}`,
        type: 'artifact',
        position: {
          x: 100 + artifactNodes.length * 40,
          y: 100 + artifactNodes.length * 40,
        },
        data: {
          file,
          label: file.filename,
          artifactId: '', // will be populated when DB row exists
        } satisfies ArtifactNodeData,
        style: { width: 480, height: 400 },
      }

      return [...prev, newNode]
    })
  }, [])

  const openArtifactBatch = useCallback(
    (files: ArtifactFile[], sectionName?: string) => {
      if (files.length === 0) return
      if (files.length === 1 || !sectionName) {
        for (const f of files) openArtifact(f)
        return
      }

      setNodes((prev) => {
        const newFiles = files.filter(
          (f) =>
            !prev.some(
              (n) =>
                n.type === 'artifact' &&
                (n.data as ArtifactNodeData).file.path === f.path,
            ),
        )

        if (newFiles.length === 0) {
          return prev.map((n) => {
            if (n.type !== 'artifact') return n
            const match = files.find(
              (f) => (n.data as ArtifactNodeData).file.path === f.path,
            )
            return match ? { ...n, data: { ...n.data, file: match } } : n
          })
        }

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
            artifactId: '',
          } satisfies ArtifactNodeData,
          style: { width: nodeW, height: nodeH },
        }))

        const updated = prev.map((n) => {
          if (n.type !== 'artifact') return n
          const match = files.find(
            (f) => (n.data as ArtifactNodeData).file.path === f.path,
          )
          return match ? { ...n, data: { ...n.data, file: match } } : n
        })

        return [...updated, sectionNode, ...childNodes]
      })
    },
    [openArtifact, pageId],
  )

  const toggleMinimizeArtifact = useCallback((id: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n
        const d = n.data as ArtifactNodeData
        if (d.minimized) {
          const restoreH = d.preMinimizeHeight || 400
          if (d.artifactId) {
            saveArtifactMinimizedFn({
              data: { artifactId: d.artifactId, minimized: false },
            })
          }
          return {
            ...n,
            data: { ...d, minimized: false, preMinimizeHeight: undefined },
            style: { ...n.style, height: restoreH },
          }
        } else {
          const curH =
            (n.style?.height as number) || (n.measured?.height ?? 400)
          if (d.artifactId) {
            saveArtifactMinimizedFn({
              data: {
                artifactId: d.artifactId,
                minimized: true,
                preMinimizeHeight: curH,
              },
            })
          }
          return {
            ...n,
            data: { ...d, minimized: true, preMinimizeHeight: curH },
            style: { ...n.style, height: 36 },
          }
        }
      }),
    )
  }, [])

  const closeSection = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id && n.parentId !== id))
  }, [])

  const setDevicePreset = useCallback(
    (nodeId: string, preset: DevicePreset | undefined) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n
          const size = getDeviceNodeSize(preset)
          const d = n.data as ArtifactNodeData
          if (d.artifactId) {
            debouncedSavePosition(
              d.artifactId,
              n.position.x,
              n.position.y,
              size.width,
              size.height,
            )
          }
          return {
            ...n,
            data: { ...n.data, devicePreset: preset },
            width: size.width,
            height: size.height,
            style: { ...n.style, width: size.width, height: size.height },
            measured: undefined,
          }
        }),
      )
    },
    [],
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
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label: name } } : n,
        ),
      )
    }

    window.addEventListener('set-device-preset', handleDevicePreset)
    window.addEventListener('close-section', handleCloseSection)
    window.addEventListener('rename-section', handleRenameSection)
    return () => {
      window.removeEventListener('set-device-preset', handleDevicePreset)
      window.removeEventListener('close-section', handleCloseSection)
      window.removeEventListener('rename-section', handleRenameSection)
    }
  }, [setDevicePreset, closeSection])

  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
  }, [])

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
