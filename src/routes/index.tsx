import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
} from '@xyflow/react'
import type { NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ChatPanel from '../components/chat-panel.js'
import ArtifactNode from '../components/artifact-node.js'
import SectionNode from '../components/section-node.js'
import { useChat } from '../hooks/useChat.js'
import { useCanvasNodes } from '../hooks/useCanvasNodes.js'
import { useProject } from '../hooks/useProject.js'
import { useConversation } from '../hooks/useConversation.js'
import { appMeta } from '../consts.js'
import type { ArtifactFile } from '../hooks/useChat.js'
import {
  loadState,
  loadPages,
  createPageFn,
  deletePageFn,
  renamePageFn,
} from '../server/state.js'
import { Plus, X, Check, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button.js'
import { Input } from '../components/ui/input.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.js'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip.js'

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
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

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
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border/50 bg-background px-2 py-1">
        <div className="flex items-center gap-1.5 px-2 py-1">
          <img src={appMeta.icon} alt={appMeta.name} className="size-5" />
          <span className="text-sm font-semibold text-foreground">{appMeta.name}</span>
        </div>
        <div className="mx-1 h-4 w-px bg-border/50" />
        {pages.map((p) => (
          <div
            key={p.id}
            className={`group/tab flex cursor-pointer items-center gap-1.5 rounded-t-md px-3 py-1.5 text-[13px] transition-colors select-none ${
              p.id === currentPageId
                ? 'bg-card text-foreground'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
            onClick={() => setCurrentPageId(p.id)}
          >
            {editingPageId === p.id ? (
              <Input
                className="h-5 w-[100px] text-[13px]"
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
            {pages.length > 1 && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-4 opacity-0 group-hover/tab:opacity-50 hover:!opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeletePage(p.id)
                }}
              >
                <X size={10} />
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          size="icon-xs"
          className="opacity-50 hover:opacity-100"
          onClick={handleCreatePage}
        >
          <Plus size={14} />
        </Button>

        {/* Project selector — right side */}
        <div className="ml-auto flex items-center gap-1">
          {creatingProject ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                if (newProjectName.trim()) {
                  onCreateProject(newProjectName.trim())
                  setNewProjectName('')
                  setCreatingProject(false)
                }
              }}
            >
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                className="h-6 w-[120px] text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setNewProjectName('')
                    setCreatingProject(false)
                  }
                }}
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon-xs"
                className="size-5"
                disabled={!newProjectName.trim()}
              >
                <Check size={12} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-5"
                onClick={() => {
                  setNewProjectName('')
                  setCreatingProject(false)
                }}
              >
                <X size={12} />
              </Button>
            </form>
          ) : (
            <>
              <Select
                value={projectId}
                onValueChange={(val: string | null) => {
                  if (val) onSwitchProject(val)
                }}
              >
                <SelectTrigger size="sm" className="h-6 text-xs font-semibold">
                  <SelectValue>
                    {projects.find((p) => p.id === projectId)?.name ??
                      'Project'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} label={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-5 shrink-0"
                      onClick={() => setCreatingProject(true)}
                    />
                  }
                >
                  <Plus size={12} />
                </TooltipTrigger>
                <TooltipContent>New project</TooltipContent>
              </Tooltip>
              {projects.length > 1 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-5 shrink-0"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Delete this project and all its data?',
                            )
                          ) {
                            onDeleteProject(projectId)
                          }
                        }}
                      />
                    }
                  >
                    <Trash2 size={11} />
                  </TooltipTrigger>
                  <TooltipContent>Delete project</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>
      <CanvasPage
        key={`${projectId}-${currentPageId}`}
        projectId={projectId}
        pageId={currentPageId}
      />
    </div>
  )
}

interface CanvasPageProps {
  projectId: string
  pageId: string
}

function CanvasPage({ projectId, pageId }: CanvasPageProps) {
  const {
    conversations,
    currentConversationId,
    currentConversation,
    loading: convLoading,
    switchConversation,
    createConversation,
    deleteConversation,
    updateSettings,
  } = useConversation(projectId)

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addEdge,
    openArtifact,
    openArtifactBatch,
    toggleMinimizeArtifact,
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
      const dir = files[0]?.path.split('/').slice(0, -1).join('/')
      const sectionName = dir || 'Generated Files'
      openArtifactBatch(files, sectionName)
    },
    [openArtifactBatch],
  )

  const { messages, isStreaming, status, usage, sendMessage, stop } = useChat({
    projectId,
    conversationId: currentConversationId ?? '',
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
      toggleMinimizeArtifact(detail.id)
    }
    window.addEventListener('minimize-artifact', handler)
    return () => window.removeEventListener('minimize-artifact', handler)
  }, [toggleMinimizeArtifact])

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

  if (convLoading || !currentConversationId || !currentConversation) {
    return <div className="canvas-app" />
  }

  return (
    <>
      <div className="relative">
        <ChatPanel
          key={currentConversationId}
          messages={messages}
          isStreaming={isStreaming}
          status={status}
          conversations={conversations}
          currentConversationId={currentConversationId}
          currentModel={currentConversation.model}
          currentEffort={currentConversation.effort}
          onSwitchConversation={switchConversation}
          onCreateConversation={createConversation}
          onDeleteConversation={deleteConversation}
          onModelChange={(model: string) =>
            updateSettings(model, currentConversation.effort)
          }
          onEffortChange={(effort: string) =>
            updateSettings(currentConversation.model, effort)
          }
          usage={usage}
          onSend={sendMessage}
          onStop={stop}
          onArtifactClick={handleArtifactClick}
        />
      </div>
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
