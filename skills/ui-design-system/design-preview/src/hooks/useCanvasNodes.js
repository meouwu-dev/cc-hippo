import { useCallback, useRef } from 'react'
import { useNodesState } from '@xyflow/react'

const STORAGE_KEY = 'design-preview-canvas'

let nodeIdCounter = 0
function nextId() {
  return `node-${++nodeIdCounter}`
}

// Auto-position: place nodes in a grid
const POSITIONS = {
  markdown: { x: 50, y: 50 },
  colorPalette: { x: 580, y: 50 },
  typography: { x: 580, y: 450 },
  componentPreview: { x: 580, y: 850 },
}

const SIZES = {
  markdown: { width: 480, height: 600 },
  colorPalette: { width: 380, height: 350 },
  typography: { width: 380, height: 350 },
  componentPreview: { width: 420, height: 400 },
}

let dynamicNodeIndex = 0

function loadCanvas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.nodes?.length) {
      // Restore counter
      for (const n of parsed.nodes) {
        const num = parseInt(n.id.split('-')[1])
        if (num > nodeIdCounter) nodeIdCounter = num
      }
      return parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

function createDefaultNodes() {
  return []
}

export function useCanvasNodes() {
  const saved = loadCanvas()
  const [nodes, setNodes, onNodesChange] = useNodesState(
    saved?.nodes || createDefaultNodes(),
  )
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  const saveCanvas = useCallback((currentNodes) => {
    // Save only layout info (positions, sizes, types), not ephemeral data like callbacks
    const serializable = currentNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      style: n.style,
      data: {
        // Only persist non-function data
        ...(n.type === 'markdown' ? { content: n.data.content } : {}),
        ...(n.type === 'colorPalette' ? { colors: n.data.colors } : {}),
        ...(n.type === 'typography' ? { typography: n.data.typography } : {}),
        ...(n.type === 'componentPreview' ? { tokens: n.data.tokens } : {}),
        ...(n.type === 'htmlPreview'
          ? { url: n.data.url, filename: n.data.filename }
          : {}),
      },
      dragHandle: n.dragHandle,
      _key: n._key,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: serializable }))
  }, [])

  const addNode = useCallback(
    (type, data = {}) => {
      // For dynamic types like "htmlPreview_foo.html", use the key for lookup but "htmlPreview" as the React Flow type
      const nodeKey = type
      const reactFlowType = type.startsWith('htmlPreview')
        ? 'htmlPreview'
        : type

      // Check if node with this key already exists
      const existing = nodesRef.current.find(
        (n) => n._key === nodeKey || n.type === nodeKey,
      )
      if (existing) {
        setNodes((nds) => {
          const updated = nds.map((n) =>
            n._key === nodeKey || n.type === nodeKey
              ? { ...n, data: { ...n.data, ...data } }
              : n,
          )
          saveCanvas(updated)
          return updated
        })
        return existing.id
      }

      const id = nextId()
      let position = POSITIONS[reactFlowType]
      if (!position) {
        // Dynamic node — place to the right, stacked vertically
        position = { x: 1050, y: 50 + dynamicNodeIndex * 450 }
        dynamicNodeIndex++
      }

      const newNode = {
        id,
        type: reactFlowType,
        _key: nodeKey,
        position,
        data,
        dragHandle: '.dragHandle',
        style: SIZES[reactFlowType] || { width: 500, height: 450 },
      }
      setNodes((nds) => {
        const updated = [...nds, newNode]
        saveCanvas(updated)
        return updated
      })
      return id
    },
    [setNodes, saveCanvas],
  )

  const updateNodeData = useCallback(
    (type, data) => {
      setNodes((nds) => {
        const updated = nds.map((n) =>
          n.type === type ? { ...n, data: { ...n.data, ...data } } : n,
        )
        return updated
      })
    },
    [setNodes],
  )

  const removeNode = useCallback(
    (id) => {
      setNodes((nds) => {
        const updated = nds.filter((n) => n.id !== id)
        saveCanvas(updated)
        return updated
      })
    },
    [setNodes, saveCanvas],
  )

  const persistNow = useCallback(() => {
    saveCanvas(nodesRef.current)
  }, [saveCanvas])

  const resetCanvas = useCallback(() => {
    nodeIdCounter = 0
    const fresh = createDefaultNodes()
    setNodes(fresh)
    localStorage.removeItem(STORAGE_KEY)
  }, [setNodes])

  return {
    nodes,
    onNodesChange,
    addNode,
    updateNodeData,
    removeNode,
    resetCanvas,
    persistNow,
  }
}
