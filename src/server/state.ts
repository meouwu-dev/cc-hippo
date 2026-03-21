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

// ---- Chat Messages ----

export const loadChatMessages = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const { getChatMessages } = await import('../mcp/db.js')
    const rows = getChatMessages(data.projectId)
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
      projectId: string
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
    saveChatMessages(data.projectId, data.messages)
    return { ok: true }
  })

export const clearChatMessagesFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const { deleteChatMessages } = await import('../mcp/db.js')
    deleteChatMessages(data.projectId)
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
