import { useState, useCallback, useEffect } from 'react'
import {
  loadProjects,
  createProjectFn,
  deleteProjectFn,
} from '../server/state.js'

export interface Project {
  id: string
  name: string
  created_at: string
}

const LS_KEY = 'seal-current-project'

export function useProject() {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjects().then(async (list) => {
      if (list.length === 0) {
        const created = await createProjectFn({ data: { name: 'Default' } })
        list = [created]
      }
      setProjects(list)

      const saved = localStorage.getItem(LS_KEY)
      const valid = list.find((p) => p.id === saved)
      const active = valid ? valid.id : list[0].id
      setCurrentProjectId(active)
      localStorage.setItem(LS_KEY, active)
      setLoading(false)
    })
  }, [])

  const switchProject = useCallback((id: string) => {
    setCurrentProjectId(id)
    localStorage.setItem(LS_KEY, id)
  }, [])

  const createProject = useCallback(async (name: string) => {
    const created = await createProjectFn({ data: { name } })
    setProjects((prev) => [...prev, created])
    setCurrentProjectId(created.id)
    localStorage.setItem(LS_KEY, created.id)
    return created
  }, [])

  const deleteProject = useCallback(
    async (id: string) => {
      await deleteProjectFn({ data: { projectId: id } })
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id)
        if (next.length === 0) {
          // Will be handled by re-init
          loadProjects().then(async (list) => {
            if (list.length === 0) {
              const created = await createProjectFn({
                data: { name: 'Default' },
              })
              setProjects([created])
              setCurrentProjectId(created.id)
              localStorage.setItem(LS_KEY, created.id)
            }
          })
          return next
        }
        if (id === currentProjectId) {
          const newActive = next[0].id
          setCurrentProjectId(newActive)
          localStorage.setItem(LS_KEY, newActive)
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
