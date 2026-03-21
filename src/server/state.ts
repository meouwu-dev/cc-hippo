import { createServerFn } from '@tanstack/react-start'

export const loadState = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const {
      getAllArtifacts,
      getAllEdges,
      ensureDefaultPage,
      getPages,
      getSections,
    } = await import('../mcp/db.js')
    const defaultPage = ensureDefaultPage(data.projectId)
    return {
      pages: getPages(data.projectId),
      defaultPageId: defaultPage.id,
      sections: getSections(data.projectId),
      artifacts: getAllArtifacts(data.projectId),
      edges: getAllEdges(data.projectId),
    }
  })

export const loadProjects = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getAllProjects } = await import('../mcp/db.js')
    return getAllProjects()
  },
)

export const createProjectFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data }) => {
    const { createProject } = await import('../mcp/db.js')
    return createProject(data.name)
  })

export const deleteProjectFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const { deleteProject } = await import('../mcp/db.js')
    deleteProject(data.projectId)
    return { ok: true }
  })

// ---- Pages ----

export const loadPages = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const { getPages, ensureDefaultPage } = await import('../mcp/db.js')
    ensureDefaultPage(data.projectId)
    return getPages(data.projectId)
  })

export const createPageFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string; name: string }) => input)
  .handler(async ({ data }) => {
    const { createPage, getPages } = await import('../mcp/db.js')
    const existing = getPages(data.projectId)
    return createPage(data.projectId, data.name, existing.length)
  })

export const deletePageFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { pageId: string }) => input)
  .handler(async ({ data }) => {
    const { deletePage } = await import('../mcp/db.js')
    deletePage(data.pageId)
    return { ok: true }
  })

export const renamePageFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { pageId: string; name: string }) => input)
  .handler(async ({ data }) => {
    const { renamePage } = await import('../mcp/db.js')
    renamePage(data.pageId, data.name)
    return { ok: true }
  })

// ---- Conversations ----

export const loadConversations = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const { getConversations } = await import('../mcp/db.js')
    return getConversations(data.projectId)
  })

export const createConversationFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string; name?: string }) => input)
  .handler(async ({ data }) => {
    const { createConversation } = await import('../mcp/db.js')
    return createConversation(data.projectId, data.name)
  })

export const deleteConversationFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data }) => {
    const { deleteConversation } = await import('../mcp/db.js')
    deleteConversation(data.conversationId)
    return { ok: true }
  })

export const renameConversationFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { conversationId: string; name: string }) => input)
  .handler(async ({ data }) => {
    const { renameConversation } = await import('../mcp/db.js')
    renameConversation(data.conversationId, data.name)
    return { ok: true }
  })

export const updateConversationSettingsFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { conversationId: string; model: string; effort: string }) => input,
  )
  .handler(async ({ data }) => {
    const { updateConversationSettings } = await import('../mcp/db.js')
    updateConversationSettings(data.conversationId, data.model, data.effort)
    return { ok: true }
  })

// ---- Chat Messages ----

export const loadChatMessages = createServerFn({ method: 'POST' })
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data }) => {
    const { getChatMessages } = await import('../mcp/db.js')
    const rows = getChatMessages(data.conversationId)
    return rows.map((r) => ({
      id: r.id,
      role: r.role as 'user' | 'assistant',
      content: r.content,
      thinking: r.thinking ?? undefined,
      artifacts: r.artifacts ? JSON.parse(r.artifacts) : [],
    }))
  })

export const saveChatMessagesFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      conversationId: string
      messages: {
        id: string
        role: string
        content: string
        thinking?: string
        artifacts?: unknown[]
      }[]
    }) => input,
  )
  .handler(async ({ data }) => {
    const { saveChatMessages } = await import('../mcp/db.js')
    saveChatMessages(data.conversationId, data.messages)
    return { ok: true }
  })

export const clearChatMessagesFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data }) => {
    const { deleteChatMessages } = await import('../mcp/db.js')
    deleteChatMessages(data.conversationId)
    return { ok: true }
  })

// ---- Canvas State ----

export const loadCanvasStateFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string; pageId: string }) => input)
  .handler(async ({ data }) => {
    const { getCanvasState } = await import('../mcp/db.js')
    const row = getCanvasState(data.projectId, data.pageId)
    if (!row) return { nodes: [], edges: [] }
    return { nodes: JSON.parse(row.nodes), edges: JSON.parse(row.edges) }
  })

export const saveCanvasStateFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      projectId: string
      pageId: string
      nodes: unknown[]
      edges: unknown[]
    }) => input,
  )
  .handler(async ({ data }) => {
    const { saveCanvasState } = await import('../mcp/db.js')
    saveCanvasState(data.projectId, data.pageId, data.nodes, data.edges)
    return { ok: true }
  })

export const clearCanvasStateFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string; pageId: string }) => input)
  .handler(async ({ data }) => {
    const { deleteCanvasState } = await import('../mcp/db.js')
    deleteCanvasState(data.projectId, data.pageId)
    return { ok: true }
  })

// ---- App State ----

export const getAppStateFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { key: string }) => input)
  .handler(async ({ data }) => {
    const { getAppState } = await import('../mcp/db.js')
    return { value: getAppState(data.key) }
  })

export const setAppStateFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { key: string; value: string }) => input)
  .handler(async ({ data }) => {
    const { setAppState } = await import('../mcp/db.js')
    setAppState(data.key, data.value)
    return { ok: true }
  })
