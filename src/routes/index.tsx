import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow
  
} from '@xyflow/react'
import type {NodeTypes} from '@xyflow/react';
import '@xyflow/react/dist/style.css'
import ChatPanel from '../components/ChatPanel.js'
import ArtifactNode from '../components/ArtifactNode.js'
import SectionNode from '../components/SectionNode.js'
import { useChat } from '../hooks/useChat.js'
import { useCanvasNodes } from '../hooks/useCanvasNodes.js'
import { useProject } from '../hooks/useProject.js'
import type { ArtifactFile } from '../hooks/useChat.js'
import { loadState,
  loadPages,
  createPageFn,
  deletePageFn,
  renamePageFn } from '../server/state.js'
import { Plus, X } from 'lucide-react'

interface PageInfo {
  id: string
  name: string
  sort_order: number
}

export const Route = createFileRoute('/')({
  component: () => (
    <ReactFlowProvider>
      <ProjectShell />
    </ReactFlowProvider>
  ),
})

function ProjectShell() {
  const {
    projects,
    currentProjectId,
    loading,
    switchProject,
    createProject,
    deleteProject,
  } = useProject()

  if (loading || !currentProjectId) {
    return <div className="canvas-app" />
  }

  return (
    <CanvasApp
      key={currentProjectId}
      projectId={currentProjectId}
      projects={projects}
      onSwitchProject={switchProject}
      onCreateProject={createProject}
      onDeleteProject={deleteProject}
    />
  )
}

interface CanvasAppProps {
  projectId: string
  projects: { id: string; name: string; created_at: string }[]
  onSwitchProject: (id: string) => void
  onCreateProject: (name: string) => void
  onDeleteProject: (id: string) => void
}

function CanvasApp({
  projectId,
  projects,
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
}: CanvasAppProps) {
  const [pages, setPages] = useState<PageInfo[]>([])
  const [currentPageId, setCurrentPageId] = useState<string>('')
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Load pages on mount
  useEffect(() => {
    loadPages({ data: { projectId } }).then((loaded) => {
      setPages(loaded as PageInfo[])
      if (loaded.length > 0) {
        setCurrentPageId(loaded[0].id)
      }
    })
  }, [projectId])

  const handleCreatePage = useCallback(async () => {
    const name = `Page ${pages.length + 1}`
    const page = (await createPageFn({
      data: { projectId, name },
    })) as PageInfo
    setPages((prev) => [...prev, page])
    setCurrentPageId(page.id)
  }, [projectId, pages.length])

  const handleDeletePage = useCallback(
    async (pageId: string) => {
      if (pages.length <= 1) return
      await deletePageFn({ data: { pageId } })
      setPages((prev) => {
        const next = prev.filter((p) => p.id !== pageId)
        if (pageId === currentPageId && next.length > 0) {
          setCurrentPageId(next[0].id)
        }
        return next
      })
    },
    [pages.length, currentPageId],
  )

  const handleStartRename = useCallback((pageId: string, name: string) => {
    setEditingPageId(pageId)
    setEditingName(name)
  }, [])

  const handleFinishRename = useCallback(async () => {
    if (editingPageId && editingName.trim()) {
      await renamePageFn({
        data: { pageId: editingPageId, name: editingName.trim() },
      })
      setPages((prev) =>
        prev.map((p) =>
          p.id === editingPageId ? { ...p, name: editingName.trim() } : p,
        ),
      )
    }
    setEditingPageId(null)
  }, [editingPageId, editingName])

  if (!currentPageId) {
    return <div className="canvas-app" />
  }

  return (
    <div className="canvas-app">
      <div className="page-tabs">
        {pages.map((p) => (
          <div
            key={p.id}
            className={`page-tab ${p.id === currentPageId ? 'active' : ''}`}
            onClick={() => setCurrentPageId(p.id)}
          >
            {editingPageId === p.id ? (
              <input
                className="page-tab-input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishRename()
                  if (e.key === 'Escape') setEditingPageId(null)
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  handleStartRename(p.id, p.name)
                }}
              >
                {p.name}
              </span>
            )}
            {pages.length > 1 && p.id === currentPageId && (
              <button
                className="page-tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeletePage(p.id)
                }}
                title="Delete page"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        <button
          className="page-tab-add"
          onClick={handleCreatePage}
          title="Add page"
        >
          <Plus size={14} />
        </button>
      </div>
      <CanvasPage
        key={`${projectId}-${currentPageId}`}
        projectId={projectId}
        pageId={currentPageId}
        projects={projects}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
        onDeleteProject={onDeleteProject}
      />
    </div>
  )
}

interface CanvasPageProps {
  projectId: string
  pageId: string
  projects: { id: string; name: string; created_at: string }[]
  onSwitchProject: (id: string) => void
  onCreateProject: (name: string) => void
  onDeleteProject: (id: string) => void
}

function CanvasPage({
  projectId,
  pageId,
  projects,
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
}: CanvasPageProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addEdge,
    openArtifact,
    openArtifactBatch,
    closeArtifact,
  } = useCanvasNodes(projectId, pageId)
  const { setCenter } = useReactFlow()

  const handleFileCreated = useCallback(
    (file: ArtifactFile) => {
      openArtifact(file)
    },
    [openArtifact],
  )

  const handleEdgeCreated = useCallback(
    (edge: { source: string; target: string; kind?: string }) => {
      addEdge(edge.target, edge.source, edge.kind)
    },
    [addEdge],
  )

  const handleBatchCreated = useCallback(
    (files: ArtifactFile[]) => {
      // Use the first file's directory as section name, or a generic label
      const dir = files[0]?.path.split('/').slice(0, -1).join('/')
      const sectionName = dir || 'Generated Files'
      openArtifactBatch(files, sectionName)
    },
    [openArtifactBatch],
  )

  const { messages, isStreaming, status, sendMessage, stop } = useChat({
    projectId,
    onFileCreated: handleFileCreated,
    onEdgeCreated: handleEdgeCreated,
    onBatchCreated: handleBatchCreated,
  })

  // Load artifacts and edges from SQLite on mount
  useEffect(() => {
    loadState({ data: { projectId } }).then((state) => {
      if (state.artifacts.length > 0) {
        // Filter artifacts for current page (or show all if no page_id set)
        const pageArtifacts = state.artifacts.filter(
          (art: { page_id?: string | null }) =>
            !art.page_id || art.page_id === pageId,
        )
        for (const art of pageArtifacts) {
          openArtifact({
            path: art.path,
            filename: art.filename,
            version: new Date(art.updated_at).getTime(),
            content: art.content,
          })
        }
        for (const edge of state.edges) {
          addEdge(edge.target_path, edge.source_path, edge.kind)
        }
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for close-artifact events from nodes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      closeArtifact(detail.id)
    }
    window.addEventListener('close-artifact', handler)
    return () => window.removeEventListener('close-artifact', handler)
  }, [closeArtifact])

  const nodeTypes: NodeTypes = useMemo(
    () => ({ artifact: ArtifactNode, section: SectionNode }),
    [],
  )

  const handleArtifactClick = useCallback(
    (file: ArtifactFile) => {
      openArtifact(file)
      requestAnimationFrame(() => {
        const nodeId = `artifact-${file.path}`
        const node = nodes.find((n) => n.id === nodeId)
        if (node) {
          const w = (node.style?.width as number) || 480
          const h = (node.style?.height as number) || 400
          setCenter(node.position.x + w / 2, node.position.y + h / 2, {
            zoom: 1,
            duration: 300,
          })
        }
      })
    },
    [openArtifact, nodes, setCenter],
  )

  return (
    <>
      <ChatPanel
        messages={messages}
        isStreaming={isStreaming}
        status={status}
        projects={projects}
        currentProjectId={projectId}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
        onDeleteProject={onDeleteProject}
        onSend={sendMessage}
        onStop={stop}
        onArtifactClick={handleArtifactClick}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView={false}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap
          nodeColor={(n) =>
            n.type === 'section'
              ? 'rgba(129, 140, 248, 0.3)'
              : 'rgba(255, 255, 255, 0.2)'
          }
          maskColor="rgba(0, 0, 0, 0.7)"
          style={{ background: '#1a1a2e' }}
        />
      </ReactFlow>
    </>
  )
}
