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
  saveArtifactPositionByPathFn,
  saveArtifactMinimizedFn,
  saveArtifactDevicePresetFn,
  upsertArtifactFn,
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
  projectId?: string,
  path?: string,
) {
  const key = artifactId || path || ''
  if (!key) return
  const existing = positionTimers.get(key)
  if (existing) clearTimeout(existing)
  positionTimers.set(
    key,
    setTimeout(() => {
      positionTimers.delete(key)
      if (artifactId) {
        saveArtifactPositionFn({
          data: { artifactId, x, y, w, h },
        })
      } else if (projectId && path) {
        saveArtifactPositionByPathFn({
          data: { projectId, path, x, y, w, h },
        })
      }
    }, 500),
  )
}

export interface ViewportInfo {
  /** Flow-coordinate X of the viewport's left edge */
  x: number
  /** Flow-coordinate Y of the viewport's top edge */
  y: number
  /** Viewport width in flow coordinates */
  width: number
  /** Viewport height in flow coordinates */
  height: number
  zoom: number
}

export function useCanvasNodes(
  projectId: string,
  pageId: string,
  viewportRef?: React.RefObject<ViewportInfo | null>,
) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [savedViewport, setSavedViewport] = useState<
    { x: number; y: number; zoom: number } | null | undefined
  >(undefined)

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])

  nodesRef.current = nodes
  edgesRef.current = edges

  // Reset on page change
  useEffect(() => {
    setSavedViewport(undefined)
  }, [pageId])

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
      setSavedViewport(data.viewport)
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
              projectId,
              d.file.path,
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
              projectId,
              d.file.path,
            )
          }
        }
      }

      return next
    })
  }, [projectId])

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

  const NODE_W = 480
  const NODE_H = 400
  const GAP_X = 60
  const GAP_Y = 80
  // Chat panel is 380px + 16px margin on each side
  const PANEL_OFFSET_PX = 420

  // Where the next node should be placed (flow coordinates)
  const nextPosRef = useRef<{ x: number; y: number } | null>(null)

  // Pre-planned layout from AI (saveArtifact called before Write)
  const plannedLayoutRef = useRef<
    Map<
      string,
      { x?: number; y?: number; devicePreset?: DevicePreset }
    >
  >(new Map())

  const startNewRow = useCallback(() => {
    const allArtifacts = nodesRef.current.filter(
      (n) => n.type === 'artifact' && !n.parentId,
    )
    const vp = viewportRef?.current

    if (allArtifacts.length === 0) {
      // First ever spawn — place to the right of the chat panel in viewport
      if (vp) {
        nextPosRef.current = {
          x: vp.x + PANEL_OFFSET_PX / vp.zoom + GAP_X,
          y: vp.y + GAP_Y,
        }
      } else {
        nextPosRef.current = { x: PANEL_OFFSET_PX + GAP_X, y: GAP_Y }
      }
      return
    }

    // Find the bottom edge of all existing nodes (the "working row" bottom)
    const bottomEdge = allArtifacts.reduce((max, n) => {
      const h = (n.style?.height as number) || NODE_H
      return Math.max(max, n.position.y + h)
    }, 0)

    // Find the leftmost X among the bottom-most row of nodes
    // (nodes whose bottom is within NODE_H of the overall bottom)
    const bottomRowNodes = allArtifacts.filter((n) => {
      const h = (n.style?.height as number) || NODE_H
      return n.position.y + h >= bottomEdge - NODE_H / 2
    })
    const leftX = bottomRowNodes.reduce(
      (min, n) => Math.min(min, n.position.x),
      Infinity,
    )

    nextPosRef.current = {
      x: isFinite(leftX)
        ? leftX
        : vp
          ? vp.x + PANEL_OFFSET_PX / vp.zoom + GAP_X
          : PANEL_OFFSET_PX + GAP_X,
      y: bottomEdge + GAP_Y,
    }
  }, [viewportRef])

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
        // Persist updated content to DB
        const w = (existing.style?.width as number) || NODE_W
        const h = (existing.style?.height as number) || NODE_H
        upsertArtifactFn({
          data: {
            projectId,
            path: file.path,
            filename: file.filename,
            content: file.content,
            x: existing.position.x,
            y: existing.position.y,
            w,
            h,
          },
        })
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

      // Check for pre-planned layout from AI (saveArtifact called before Write)
      const planned = plannedLayoutRef.current.get(file.path)
      const nodeSize = planned?.devicePreset
        ? getDeviceNodeSize(planned.devicePreset)
        : { width: NODE_W, height: NODE_H }

      // Compute position for the new node
      let x: number
      let y: number

      if (planned?.x !== undefined && planned?.y !== undefined) {
        // Use AI-planned position
        x = planned.x
        y = planned.y
        // Clear the plan so it's not reused
        plannedLayoutRef.current.delete(file.path)
      } else if (nextPosRef.current) {
        // Use the position set by startNewRow
        x = nextPosRef.current.x
        y = nextPosRef.current.y
        // Advance for next node in this row: shift right
        nextPosRef.current = { x: x + NODE_W + GAP_X, y }
      } else {
        // Fallback: place to the right of the rightmost existing node
        const artifactNodes = prev.filter(
          (n) => n.type === 'artifact' && !n.parentId,
        )
        if (artifactNodes.length === 0) {
          const vp = viewportRef?.current
          x = vp
            ? vp.x + PANEL_OFFSET_PX / vp.zoom + GAP_X
            : PANEL_OFFSET_PX + GAP_X
          y = vp ? vp.y + GAP_Y : GAP_Y
        } else {
          const rightmost = artifactNodes.reduce((best, n) => {
            const nRight = n.position.x + ((n.style?.width as number) || NODE_W)
            const bRight =
              best.position.x + ((best.style?.width as number) || NODE_W)
            return nRight > bRight ? n : best
          })
          x =
            rightmost.position.x +
            ((rightmost.style?.width as number) || NODE_W) +
            GAP_X
          y = rightmost.position.y
        }
        nextPosRef.current = { x: x + NODE_W + GAP_X, y }
      }

      const newNode: Node = {
        id: `artifact-${file.path}`,
        type: 'artifact',
        position: { x, y },
        data: {
          file,
          label: file.filename,
          artifactId: '', // will be populated when DB row exists
          devicePreset: planned?.devicePreset,
        } satisfies ArtifactNodeData,
        style: { width: nodeSize.width, height: nodeSize.height },
      }

      // Upsert artifact to DB so it survives refresh even before MCP saveArtifact
      upsertArtifactFn({
        data: {
          projectId,
          path: file.path,
          filename: file.filename,
          content: file.content,
          x,
          y,
          w: nodeSize.width,
          h: nodeSize.height,
        },
      })

      return [...prev, newNode]
    })
  }, [projectId])

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

        const childNodes: Node[] = newFiles.map((file, i) => {
          const cx = padding + i * (nodeW + gap)
          const cy = headerH + padding
          // Upsert artifact to DB so it survives refresh
          upsertArtifactFn({
            data: {
              projectId,
              path: file.path,
              filename: file.filename,
              content: file.content,
              x: cx,
              y: cy,
              w: nodeW,
              h: nodeH,
            },
          })
          return {
            id: `artifact-${file.path}`,
            type: 'artifact',
            position: { x: cx, y: cy },
            parentId: sectionId,
            data: {
              file,
              label: file.filename,
              artifactId: '',
            } satisfies ArtifactNodeData,
            style: { width: nodeW, height: nodeH },
          }
        })

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
            saveArtifactDevicePresetFn({
              data: {
                artifactId: d.artifactId,
                devicePreset: preset ?? null,
              },
            })
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

  const setDevicePresetByPath = useCallback(
    (path: string, preset: DevicePreset) => {
      const nodeId = `artifact-${path}`
      // Check if node exists yet
      const exists = nodesRef.current.some((n) => n.id === nodeId)
      if (!exists) {
        // Buffer into planned layout for when the node spawns
        const existing = plannedLayoutRef.current.get(path) || {}
        plannedLayoutRef.current.set(path, { ...existing, devicePreset: preset })
        return
      }
      setDevicePreset(nodeId, preset)
    },
    [setDevicePreset],
  )

  const moveArtifactByPath = useCallback(
    (artifactPath: string, x: number, y: number) => {
      const nodeId = `artifact-${artifactPath}`
      // Check if node exists yet
      const exists = nodesRef.current.some((n) => n.id === nodeId)
      if (!exists) {
        // Buffer into planned layout for when the node spawns
        const existing = plannedLayoutRef.current.get(artifactPath) || {}
        plannedLayoutRef.current.set(artifactPath, { ...existing, x, y })
        return
      }
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n
          const d = n.data as ArtifactNodeData
          const w = (n.style?.width as number) || NODE_W
          const h = (n.style?.height as number) || NODE_H
          if (d.artifactId) {
            debouncedSavePosition(d.artifactId, x, y, w, h)
          }
          return { ...n, position: { x, y } }
        }),
      )
    },
    [],
  )

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
    startNewRow,
    toggleMinimizeArtifact,
    closeSection,
    clearCanvas,
    setDevicePresetByPath,
    moveArtifactByPath,
    savedViewport,
  }
}
