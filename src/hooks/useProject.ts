import { useState, useCallback, useEffect } from 'react'
import {
  loadProjects,
  createProjectFn,
  deleteProjectFn,
  getAppStateFn,
  setAppStateFn,
} from '../server/state.js'

export interface Project {
  id: string
  name: string
  created_at: string
}

const STATE_KEY = 'active_project'

export function useProject() {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      loadProjects(),
      getAppStateFn({ data: { key: STATE_KEY } }),
    ]).then(async ([list, { value: saved }]) => {
      if (list.length === 0) {
        const created = await createProjectFn({ data: { name: 'Default' } })
        list = [created]
      }
      setProjects(list)

      const valid = list.find((p) => p.id === saved)
      const active = valid ? valid.id : list[0].id
      setCurrentProjectId(active)
      await setAppStateFn({ data: { key: STATE_KEY, value: active } })
      setLoading(false)
    })
  }, [])

  const switchProject = useCallback((id: string) => {
    setCurrentProjectId(id)
    setAppStateFn({ data: { key: STATE_KEY, value: id } })
  }, [])

  const createProject = useCallback(async (name: string) => {
    const created = await createProjectFn({ data: { name } })
    setProjects((prev) => [...prev, created])
    setCurrentProjectId(created.id)
    await setAppStateFn({ data: { key: STATE_KEY, value: created.id } })
    return created
  }, [])

  const deleteProject = useCallback(
    async (id: string) => {
      await deleteProjectFn({ data: { projectId: id } })
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id)
        if (next.length === 0) {
          loadProjects().then(async (list) => {
            if (list.length === 0) {
              const created = await createProjectFn({
                data: { name: 'Default' },
              })
              setProjects([created])
              setCurrentProjectId(created.id)
              await setAppStateFn({
                data: { key: STATE_KEY, value: created.id },
              })
            }
          })
          return next
        }
        if (id === currentProjectId) {
          const newActive = next[0].id
          setCurrentProjectId(newActive)
          setAppStateFn({ data: { key: STATE_KEY, value: newActive } })
        }
        return next
      })
    },
    [currentProjectId],
  )

  return {
    projects,
    currentProjectId,
    loading,
    switchProject,
    createProject,
    deleteProject,
  }
}
