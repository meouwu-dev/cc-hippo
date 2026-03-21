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

export const loadCanvasDataFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string; pageId: string }) => input)
  .handler(async ({ data }) => {
    const { getArtifactsByPage, getEdgesByPage, getSections, getDb } =
      await import('../mcp/db.js')
    const db = getDb()
    const page = db
      .prepare('SELECT viewport_x, viewport_y, viewport_zoom FROM pages WHERE id = ?')
      .get(data.pageId) as {
      viewport_x: number | null
      viewport_y: number | null
      viewport_zoom: number | null
    } | undefined
    return {
      artifacts: getArtifactsByPage(data.projectId, data.pageId),
      edges: getEdgesByPage(data.projectId, data.pageId),
      sections: getSections(data.projectId, data.pageId),
      viewport: page?.viewport_x != null
        ? { x: page.viewport_x, y: page.viewport_y!, zoom: page.viewport_zoom! }
        : null,
    }
  })

export const savePageViewportFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { pageId: string; x: number; y: number; zoom: number }) => input,
  )
  .handler(async ({ data }) => {
    const { savePageViewport } = await import('../mcp/db.js')
    savePageViewport(data.pageId, data.x, data.y, data.zoom)
    return { ok: true }
  })

export const saveArtifactPositionFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      artifactId: string
      x: number
      y: number
      w: number
      h: number
    }) => input,
  )
  .handler(async ({ data }) => {
    const { updateArtifactPosition } = await import('../mcp/db.js')
    updateArtifactPosition(data.artifactId, data.x, data.y, data.w, data.h)
    return { ok: true }
  })

export const saveArtifactMinimizedFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      artifactId: string
      minimized: boolean
      preMinimizeHeight?: number | null
    }) => input,
  )
  .handler(async ({ data }) => {
    const { updateArtifactMinimized } = await import('../mcp/db.js')
    updateArtifactMinimized(
      data.artifactId,
      data.minimized,
      data.preMinimizeHeight,
    )
    return { ok: true }
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
    renamePage(data.pageId, data.name, true)
    return { ok: true }
  })

export const getArtifactPageFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string; artifactPath: string }) => input)
  .handler(async ({ data }) => {
    const { getArtifactByPath } = await import('../mcp/db.js')
    const artifact = getArtifactByPath(data.projectId, data.artifactPath)
    return { pageId: artifact?.page_id ?? null }
  })

// ---- Conversations ----

export const loadConversations = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const { getConversations } = await import('../mcp/db.js')
    return getConversations(data.projectId)
  })

export const createConversationFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      projectId: string
      name?: string
      model?: string
      effort?: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const { createConversation } = await import('../mcp/db.js')
    return createConversation(
      data.projectId,
      data.name,
      data.model,
      data.effort,
    )
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
      thinking: r.thinking
        ? (() => {
            try {
              const parsed = JSON.parse(r.thinking)
              return Array.isArray(parsed) ? parsed : [r.thinking]
            } catch {
              return [r.thinking]
            }
          })()
        : undefined,
      artifacts: r.artifacts ? JSON.parse(r.artifacts) : [],
      questions: r.questions ? JSON.parse(r.questions) : undefined,
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
        thinking?: string[]
        artifacts?: unknown[]
        questions?: unknown[]
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
