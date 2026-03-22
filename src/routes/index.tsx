import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  SelectionMode,
  useReactFlow,
  useOnSelectionChange,
} from '@xyflow/react'
import type { Node as FlowNode, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ChatPanel from '../components/chat-panel.js'
import ArtifactNode from '../components/artifact-node.js'
import SectionNode from '../components/section-node.js'
import { useChat } from '../hooks/useChat.js'
import { useCanvasNodes } from '../hooks/useCanvasNodes.js'
import type { ViewportInfo, DevicePreset } from '../hooks/useCanvasNodes.js'
import { useProject } from '../hooks/useProject.js'
import { useConversation } from '../hooks/useConversation.js'
import { appMeta } from '../consts.js'
import type { ArtifactFile } from '../hooks/useChat.js'
import {
  loadPages,
  createPageFn,
  deletePageFn,
  renamePageFn,
  getArtifactPageFn,
  savePageViewportFn,
} from '../server/state.js'
import { Plus, X, Check, Trash2, Pencil } from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog.js'

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
    return (
      <div className="canvas-app items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      </div>
    )
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

  const {
    conversations,
    currentConversationId,
    currentConversation,
    loading: convLoading,
    switchConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    updateSettings,
  } = useConversation(projectId)

  // Refs that CanvasPage populates with canvas-specific callbacks
  const fileCreatedRef = useRef<((file: ArtifactFile) => void) | undefined>(
    undefined,
  )
  const edgeCreatedRef = useRef<
    | ((edge: { source: string; target: string; kind?: string }) => void)
    | undefined
  >(undefined)
  const batchCreatedRef = useRef<((files: ArtifactFile[]) => void) | undefined>(
    undefined,
  )
  const startNewRowRef = useRef<(() => void) | undefined>(undefined)
  const devicePresetRef = useRef<
    ((path: string, preset: string) => void) | undefined
  >(undefined)

  // Stable wrappers that delegate to the current page's callbacks
  const onFileCreated = useCallback((file: ArtifactFile) => {
    fileCreatedRef.current?.(file)
  }, [])
  const onEdgeCreated = useCallback(
    (edge: { source: string; target: string; kind?: string }) => {
      edgeCreatedRef.current?.(edge)
    },
    [],
  )
  const onBatchCreated = useCallback((files: ArtifactFile[]) => {
    batchCreatedRef.current?.(files)
  }, [])
  const onStartNewRow = useCallback(() => {
    startNewRowRef.current?.()
  }, [])
  const onDevicePreset = useCallback((path: string, preset: string) => {
    devicePresetRef.current?.(path, preset)
  }, [])
  const onSwitchPage = useCallback(
    (pageId: string) => {
      setCurrentPageId(pageId)
      // Also reload pages in case AI created it just now
      loadPages({ data: { projectId } }).then((loaded) => {
        setPages((prev) => {
          const prevIds = new Set(prev.map((p) => p.id))
          const hasNew = (loaded as PageInfo[]).some((p) => !prevIds.has(p.id))
          if (hasNew) return loaded as PageInfo[]
          // Also update names (AI may have renamed)
          const namesChanged = (loaded as PageInfo[]).some(
            (p) => prev.find((pp) => pp.id === p.id)?.name !== p.name,
          )
          return namesChanged ? (loaded as PageInfo[]) : prev
        })
      })
    },
    [projectId],
  )

  const onRenamePage = useCallback((pageId: string, name: string) => {
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, name } : p)))
  }, [])

  // useChat lives here — survives page switches
  const {
    messages,
    isStreaming,
    status,
    usage,
    pendingQuestions,
    dismissQuestions,
    sendMessage: rawSendMessage,
    stop,
    retry,
  } = useChat({
    projectId,
    conversationId: currentConversationId ?? '',
    onFileCreated,
    onEdgeCreated,
    onBatchCreated,
    onStartNewRow,
    onSwitchPage,
    onRenamePage,
    onDevicePreset,
  })

  // Wrap sendMessage to inject current page context (like IDE file context)
  const sendMessage = useCallback(
    (
      text: string,
      opts: { model?: string; effort?: string; references?: string[] } = {},
    ) => {
      const currentPage = pages.find((p) => p.id === currentPageId)
      return rawSendMessage(text, {
        ...opts,
        currentPageId,
        currentPageName: currentPage?.name,
      })
    },
    [rawSendMessage, pages, currentPageId],
  )

  // Auto-rename conversation after first interaction if still using default name
  const autoRenamedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!currentConversationId || isStreaming) return
    if (autoRenamedRef.current.has(currentConversationId)) return
    const conv = conversations.find((c) => c.id === currentConversationId)
    if (!conv || !/^Chat \d+$/.test(conv.name)) return
    const firstUserMsg = messages.find((m) => m.role === 'user')
    const hasAssistant = messages.some((m) => m.role === 'assistant')
    if (!firstUserMsg || !hasAssistant) return
    autoRenamedRef.current.add(currentConversationId)
    const title = firstUserMsg.content.slice(0, 40).trim()
    if (title) {
      renameConversation(
        currentConversationId,
        title + (firstUserMsg.content.length > 40 ? '…' : ''),
      )
    }
  }, [
    currentConversationId,
    conversations,
    messages,
    isStreaming,
    renameConversation,
  ])

  // Pending focus: when clicking an artifact in chat, navigate to its page then focus
  const [pendingFocusPath, setPendingFocusPath] = useState<string | null>(null)

  const handleArtifactClick = useCallback(
    async (file: ArtifactFile) => {
      const { pageId: artifactPageId } = await getArtifactPageFn({
        data: { projectId, artifactPath: file.path },
      })
      if (artifactPageId && artifactPageId !== currentPageId) {
        // Different page — switch and queue focus
        setPendingFocusPath(file.path)
        setCurrentPageId(artifactPageId)
      } else {
        // Same page — just focus the node directly
        setPendingFocusPath(file.path)
      }
    },
    [projectId, currentPageId],
  )

  // Load pages on mount
  useEffect(() => {
    loadPages({ data: { projectId } }).then((loaded) => {
      setPages(loaded as PageInfo[])
      if (loaded.length > 0) {
        setCurrentPageId(loaded[0].id)
      }
    })
  }, [projectId])

  // Reload pages when streaming ends — AI may have created new pages via MCP
  const prevStreamingRef = useRef(false)
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      loadPages({ data: { projectId } }).then((loaded) => {
        setPages((prev) => {
          const prevIds = new Set(prev.map((p) => p.id))
          const hasNew = (loaded as PageInfo[]).some((p) => !prevIds.has(p.id))
          return hasNew ? (loaded as PageInfo[]) : prev
        })
      })
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, projectId])

  // Warn before leaving while AI is generating
  useEffect(() => {
    if (!isStreaming) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isStreaming])

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
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border/50 bg-background px-2">
        <div className="flex items-center gap-1.5 px-2 py-1">
          <img src={appMeta.icon} alt={appMeta.name} className="size-5" />
          <span className="text-sm font-semibold text-foreground">
            {appMeta.name}
          </span>
        </div>
        <div className="mx-1 h-4 w-px bg-border/50" />
        {pages.map((p) => (
          <div className="pt-1">
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
              {editingPageId !== p.id && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-4 opacity-0 group-hover/tab:opacity-50 hover:!opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartRename(p.id, p.name)
                    }}
                  >
                    <Pencil size={9} />
                  </Button>
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
                </>
              )}
            </div>
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
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 shrink-0"
                            />
                          }
                        />
                      }
                    >
                      <Trash2 size={11} />
                    </TooltipTrigger>
                    <TooltipContent>Delete project</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete project</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this project and all its
                        data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDeleteProject(projectId)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </div>
      </div>
      {convLoading || !currentConversationId || !currentConversation ? (
        <div className="flex-1" />
      ) : (
        <CanvasPage
          key={`${projectId}-${currentPageId}`}
          projectId={projectId}
          pageId={currentPageId}
          fileCreatedRef={fileCreatedRef}
          edgeCreatedRef={edgeCreatedRef}
          batchCreatedRef={batchCreatedRef}
          startNewRowRef={startNewRowRef}
          devicePresetRef={devicePresetRef}
          messages={messages}
          isStreaming={isStreaming}
          status={status}
          usage={usage}
          sendMessage={sendMessage}
          stop={stop}
          conversations={conversations}
          currentConversationId={currentConversationId}
          currentConversation={currentConversation}
          onSwitchConversation={switchConversation}
          onCreateConversation={createConversation}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          onUpdateSettings={updateSettings}
          onArtifactClick={handleArtifactClick}
          pendingFocusPath={pendingFocusPath}
          onClearPendingFocus={() => setPendingFocusPath(null)}
          pendingQuestions={pendingQuestions}
          dismissQuestions={dismissQuestions}
          onRetry={(messageId) =>
            retry(messageId, {
              model:
                currentConversation.model !== 'default'
                  ? currentConversation.model
                  : undefined,
              effort:
                currentConversation.effort !== 'default'
                  ? currentConversation.effort
                  : undefined,
            })
          }
        />
      )}
    </div>
  )
}

interface CanvasPageProps {
  projectId: string
  pageId: string
  fileCreatedRef: React.RefObject<((file: ArtifactFile) => void) | undefined>
  edgeCreatedRef: React.RefObject<
    | ((edge: { source: string; target: string; kind?: string }) => void)
    | undefined
  >
  batchCreatedRef: React.RefObject<
    ((files: ArtifactFile[]) => void) | undefined
  >
  startNewRowRef: React.RefObject<(() => void) | undefined>
  devicePresetRef: React.RefObject<
    ((path: string, preset: string) => void) | undefined
  >
  messages: ReturnType<typeof useChat>['messages']
  isStreaming: boolean
  status: ReturnType<typeof useChat>['status']
  usage: ReturnType<typeof useChat>['usage']
  sendMessage: ReturnType<typeof useChat>['sendMessage']
  stop: ReturnType<typeof useChat>['stop']
  conversations: ReturnType<typeof useConversation>['conversations']
  currentConversationId: string
  currentConversation: NonNullable<
    ReturnType<typeof useConversation>['currentConversation']
  >
  onSwitchConversation: ReturnType<typeof useConversation>['switchConversation']
  onCreateConversation: ReturnType<typeof useConversation>['createConversation']
  onDeleteConversation: ReturnType<typeof useConversation>['deleteConversation']
  onRenameConversation: ReturnType<typeof useConversation>['renameConversation']
  onUpdateSettings: ReturnType<typeof useConversation>['updateSettings']
  onArtifactClick: (file: ArtifactFile) => void
  pendingFocusPath: string | null
  onClearPendingFocus: () => void
  pendingQuestions: ReturnType<typeof useChat>['pendingQuestions']
  dismissQuestions: ReturnType<typeof useChat>['dismissQuestions']
  onRetry: (messageId: string) => void
}

function CanvasPage({
  projectId,
  pageId,
  fileCreatedRef,
  edgeCreatedRef,
  batchCreatedRef,
  startNewRowRef,
  devicePresetRef,
  messages,
  isStreaming,
  status,
  usage,
  sendMessage,
  stop,
  conversations,
  currentConversationId,
  currentConversation,
  onSwitchConversation,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  onUpdateSettings,
  onArtifactClick,
  pendingFocusPath,
  onClearPendingFocus,
  pendingQuestions,
  dismissQuestions,
  onRetry,
}: CanvasPageProps) {
  const [selectedNodes, setSelectedNodes] = useState<FlowNode[]>([])
  const viewportInfoRef = useRef<ViewportInfo | null>(null)
  const {
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
    setDevicePresetByPath,
    savedViewport,
  } = useCanvasNodes(projectId, pageId, viewportInfoRef)
  const { setCenter, getViewport, setViewport } = useReactFlow()

  // Restore saved viewport when page data loads
  const hasRestoredRef = useRef(false)
  useEffect(() => {
    hasRestoredRef.current = false
  }, [pageId])
  useEffect(() => {
    if (hasRestoredRef.current) return
    // Wait until nodes have loaded (savedViewport is set in same .then())
    if (savedViewport === undefined) return
    hasRestoredRef.current = true
    if (savedViewport) {
      requestAnimationFrame(() => {
        setViewport(savedViewport)
      })
    }
  }, [savedViewport, setViewport])

  // Keep viewport info updated for node positioning + persist to DB
  const viewportSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateViewportInfo = useCallback(() => {
    const vp = getViewport()
    viewportInfoRef.current = {
      x: -vp.x / vp.zoom,
      y: -vp.y / vp.zoom,
      width: window.innerWidth / vp.zoom,
      height: window.innerHeight / vp.zoom,
      zoom: vp.zoom,
    }
    if (viewportSaveTimer.current) clearTimeout(viewportSaveTimer.current)
    viewportSaveTimer.current = setTimeout(() => {
      savePageViewportFn({ data: { pageId, x: vp.x, y: vp.y, zoom: vp.zoom } })
    }, 500)
  }, [getViewport, pageId])

  // Track selected nodes
  useOnSelectionChange({
    onChange: ({ nodes: selected }) => {
      setSelectedNodes(selected.filter((n) => n.type === 'artifact'))
    },
  })

  // Register canvas callbacks so useChat (in parent) can reach them
  useEffect(() => {
    fileCreatedRef.current = (file: ArtifactFile) => openArtifact(file)
    edgeCreatedRef.current = (edge) =>
      addEdge(edge.source, edge.target, edge.kind)
    batchCreatedRef.current = (files: ArtifactFile[]) => {
      const dir = files[0]?.path.split('/').slice(0, -1).join('/')
      const sectionName = dir || 'Generated Files'
      openArtifactBatch(files, sectionName)
    }
    startNewRowRef.current = () => startNewRow()
    devicePresetRef.current = (path, preset) =>
      setDevicePresetByPath(path, preset as DevicePreset)
    return () => {
      fileCreatedRef.current = undefined
      edgeCreatedRef.current = undefined
      batchCreatedRef.current = undefined
      startNewRowRef.current = undefined
      devicePresetRef.current = undefined
    }
  }, [
    fileCreatedRef,
    edgeCreatedRef,
    batchCreatedRef,
    startNewRowRef,
    devicePresetRef,
    openArtifact,
    addEdge,
    openArtifactBatch,
    startNewRow,
    setDevicePresetByPath,
  ])

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

  // Focus a node by path — used for pending focus after page switch
  const focusNode = useCallback(
    (artifactPath: string) => {
      requestAnimationFrame(() => {
        const nodeId = `artifact-${artifactPath}`
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
    [nodes, setCenter],
  )

  // Handle pending focus from page navigation
  useEffect(() => {
    if (pendingFocusPath) {
      // Small delay to let canvas data load
      const timer = setTimeout(() => {
        focusNode(pendingFocusPath)
        onClearPendingFocus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [pendingFocusPath, focusNode, onClearPendingFocus])

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
          onSwitchConversation={onSwitchConversation}
          onCreateConversation={onCreateConversation}
          onDeleteConversation={onDeleteConversation}
          onRenameConversation={onRenameConversation}
          onModelChange={(model: string) =>
            onUpdateSettings(model, currentConversation.effort)
          }
          onEffortChange={(effort: string) =>
            onUpdateSettings(currentConversation.model, effort)
          }
          usage={usage}
          onSend={sendMessage}
          onStop={stop}
          onArtifactClick={onArtifactClick}
          pendingQuestions={pendingQuestions}
          dismissQuestions={dismissQuestions}
          onRetry={onRetry}
          selectedNodes={selectedNodes}
          onClearSelection={() => setSelectedNodes([])}
          onDeselectNode={(nodeId) =>
            setSelectedNodes((prev) => prev.filter((n) => n.id !== nodeId))
          }
        />
      </div>
      <div className="flex-1" onContextMenu={(e) => e.preventDefault()}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={updateViewportInfo}
          onInit={updateViewportInfo}
          nodeTypes={nodeTypes}
          fitView={false}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnDrag={[2]}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <div
            className="group/minimap fixed bottom-4 right-0 z-10 flex items-end"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(0)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(calc(100% - 20px))'
            }}
            style={{
              transform: 'translateX(calc(100% - 20px))',
              transition: 'transform 0.25s ease',
            }}
          >
            <div className="flex h-10 w-5 shrink-0 cursor-pointer items-center justify-center rounded-l-md bg-[#1a1a2e] text-xs text-white/60 shadow-md">
              ‹
            </div>
            <MiniMap
              nodeColor={(n) =>
                n.type === 'section'
                  ? 'rgba(129, 140, 248, 0.3)'
                  : 'rgba(255, 255, 255, 0.2)'
              }
              maskColor="rgba(0, 0, 0, 0.7)"
              style={{
                background: '#1a1a2e',
                position: 'relative',
                margin: 0,
              }}
            />
          </div>
        </ReactFlow>
      </div>
    </>
  )
}
