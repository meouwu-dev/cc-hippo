import { useState, useCallback, useEffect } from 'react'
import {
  loadConversations,
  createConversationFn,
  deleteConversationFn,
  updateConversationSettingsFn,
  getAppStateFn,
  setAppStateFn,
} from '../server/state.js'

export interface Conversation {
  id: string
  project_id: string
  name: string
  session_id: string | null
  model: string
  effort: string
  created_at: string
}

function stateKey(projectId: string) {
  return `active_conversation:${projectId}`
}

export function useConversation(projectId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const key = stateKey(projectId)
    Promise.all([
      loadConversations({ data: { projectId } }),
      getAppStateFn({ data: { key } }),
    ]).then(async ([list, { value: saved }]) => {
      if (list.length === 0) {
        const created = await createConversationFn({
          data: { projectId, name: 'Chat 1' },
        })
        list = [created as Conversation]
      }
      setConversations(list as Conversation[])

      const valid = list.find((c) => c.id === saved)
      const active = valid ? valid.id : list[0].id
      setCurrentConversationId(active)
      await setAppStateFn({ data: { key, value: active } })
      setLoading(false)
    })
  }, [projectId])

  const currentConversation =
    conversations.find((c) => c.id === currentConversationId) ?? null

  const switchConversation = useCallback(
    (id: string) => {
      setCurrentConversationId(id)
      setAppStateFn({ data: { key: stateKey(projectId), value: id } })
    },
    [projectId],
  )

  const createConversation = useCallback(
    async (name?: string) => {
      const label = name || `Chat ${conversations.length + 1}`
      const created = (await createConversationFn({
        data: { projectId, name: label },
      })) as Conversation
      setConversations((prev) => [...prev, created])
      setCurrentConversationId(created.id)
      await setAppStateFn({
        data: { key: stateKey(projectId), value: created.id },
      })
      return created
    },
    [projectId, conversations.length],
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      await deleteConversationFn({ data: { conversationId: id } })
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id)
        if (next.length === 0) {
          loadConversations({ data: { projectId } }).then(async (list) => {
            if (list.length === 0) {
              const created = (await createConversationFn({
                data: { projectId, name: 'Chat 1' },
              })) as Conversation
              setConversations([created])
              setCurrentConversationId(created.id)
              await setAppStateFn({
                data: { key: stateKey(projectId), value: created.id },
              })
            }
          })
          return next
        }
        if (id === currentConversationId) {
          const newActive = next[0].id
          setCurrentConversationId(newActive)
          setAppStateFn({
            data: { key: stateKey(projectId), value: newActive },
          })
        }
        return next
      })
    },
    [projectId, currentConversationId],
  )

  const updateSettings = useCallback(
    async (model: string, effort: string) => {
      if (!currentConversationId) return
      await updateConversationSettingsFn({
        data: { conversationId: currentConversationId, model, effort },
      })
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId ? { ...c, model, effort } : c,
        ),
      )
    },
    [currentConversationId],
  )

  return {
    conversations,
    currentConversationId,
    currentConversation,
    loading,
    switchConversation,
    createConversation,
    deleteConversation,
    updateSettings,
  }
}
