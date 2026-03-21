import { createServerFn } from '@tanstack/react-start'

export const loadState = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const { getAllArtifacts, getAllEdges } = await import('../mcp/db.js')
    return {
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
