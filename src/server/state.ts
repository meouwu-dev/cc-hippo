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
