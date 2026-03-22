import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { chatStream } from '../server/chat.js'
import {
  loadChatMessages,
  saveChatMessagesFn,
  clearChatMessagesFn,
} from '../server/state.js'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
  thinking?: string[]
  artifacts?: ArtifactFile[]
  questions?: UserQuestion[]
}

export interface ArtifactFile {
  path: string
  filename: string
  version: number
  content: string
}

export interface UserQuestion {
  question: string
  options: (string | { label: string; description?: string })[]
  allowCustom?: boolean
}

export type StreamStatus =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'thinking'; content: string }
  | { phase: 'tool'; detail: string }
  | { phase: 'responding' }
  | { phase: 'error'; message: string }

export interface UsageInfo {
  duration_ms: number
  total_cost_usd: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
}

export interface ArtifactEdge {
  source: string
  target: string
  kind?: string
}

interface UseChatOptions {
  projectId: string
  conversationId: string
  onFileCreated?: (file: ArtifactFile) => void
  onEdgeCreated?: (edge: ArtifactEdge) => void
  onBatchCreated?: (files: ArtifactFile[]) => void
  onStartNewRow?: () => void
  onSwitchPage?: (pageId: string) => void
  onRenamePage?: (pageId: string, name: string) => void
  onDevicePreset?: (path: string, preset: string) => void
  onMoveArtifact?: (path: string, x: number, y: number) => void
}

export function useChat({
  projectId,
  conversationId,
  onFileCreated,
  onEdgeCreated,
  onBatchCreated,
  onStartNewRow,
  onSwitchPage,
  onRenamePage,
  onDevicePreset,
  onMoveArtifact,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState<StreamStatus>({ phase: 'idle' })
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([])
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pendingQuestions, setPendingQuestions] = useState<
    UserQuestion[] | null
  >(null)
  const abortRef = useRef<AbortController | null>(null)
  const onFileCreatedRef = useRef(onFileCreated)
  onFileCreatedRef.current = onFileCreated
  const onEdgeCreatedRef = useRef(onEdgeCreated)
  onEdgeCreatedRef.current = onEdgeCreated
  const onBatchCreatedRef = useRef(onBatchCreated)
  onBatchCreatedRef.current = onBatchCreated
  const onStartNewRowRef = useRef(onStartNewRow)
  onStartNewRowRef.current = onStartNewRow
  const onSwitchPageRef = useRef(onSwitchPage)
  onSwitchPageRef.current = onSwitchPage
  const onRenamePageRef = useRef(onRenamePage)
  onRenamePageRef.current = onRenamePage
  const onDevicePresetRef = useRef(onDevicePreset)
  onDevicePresetRef.current = onDevicePreset
  const onMoveArtifactRef = useRef(onMoveArtifact)
  onMoveArtifactRef.current = onMoveArtifact

  // Load from SQLite on mount / conversation switch
  useEffect(() => {
    setMessages([])
    setArtifacts([])
    setUsage(null)
    setStatus({ phase: 'idle' })
    setLoaded(false)
    loadChatMessages({ data: { conversationId } }).then((msgs) => {
      if (msgs?.length) {
        setMessages(msgs as ChatMessage[])
        const allArtifacts: ArtifactFile[] = []
        for (const m of msgs) {
          if (m.artifacts?.length) {
            for (const a of m.artifacts as ArtifactFile[]) {
              const exists = allArtifacts.some((e) => e.path === a.path)
              if (exists) {
                const idx = allArtifacts.findIndex((e) => e.path === a.path)
                allArtifacts[idx] = a
              } else {
                allArtifacts.push(a)
              }
            }
          }
        }
        if (allArtifacts.length) setArtifacts(allArtifacts)
        // Restore pending questions if last assistant msg has unanswered questions
        const lastMsg = msgs[msgs.length - 1] as ChatMessage | undefined
        if (lastMsg?.role === 'assistant' && lastMsg.questions?.length) {
          setPendingQuestions(lastMsg.questions)
        }
      }
      setLoaded(true)
    })
  }, [conversationId])

  const persistMessages = useCallback(
    (msgs: ChatMessage[]) => {
      saveChatMessagesFn({ data: { conversationId, messages: msgs } })
    },
    [conversationId],
  )

  // Debounced persist for use during streaming (saves partial progress)
  const debouncedPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedPersist = useMemo(
    () => (msgs: ChatMessage[]) => {
      if (debouncedPersistRef.current) clearTimeout(debouncedPersistRef.current)
      debouncedPersistRef.current = setTimeout(() => {
        persistMessages(msgs)
        debouncedPersistRef.current = null
      }, 2000)
    },
    [persistMessages],
  )
  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debouncedPersistRef.current) clearTimeout(debouncedPersistRef.current)
    }
  }, [])

  const sendMessage = useCallback(
    async (
      text: string,
      opts: {
        model?: string
        effort?: string
        currentPageId?: string
        currentPageName?: string
        references?: string[]
      } = {},
    ) => {
      const now = Date.now()
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: now,
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: now,
        thinking: [],
        artifacts: [],
      }

      setMessages((prev) => {
        const next = [...prev, userMsg, assistantMsg]
        persistMessages(next)
        return next
      })

      setIsStreaming(true)
      setUsage(null)
      setStatus({ phase: 'connecting' })
      onStartNewRowRef.current?.()
      const controller = new AbortController()
      abortRef.current = controller

      // First message = no prior messages in this session
      const isFirstMessage = messages.length === 0

      try {
        const res = await chatStream({
          data: {
            message: text,
            isFirstMessage,
            model: opts.model,
            effort: opts.effort,
            projectId,
            conversationId,
            currentPageId: opts.currentPageId,
            currentPageName: opts.currentPageName,
            references: opts.references,
          },
          signal: controller.signal,
        })

        if (!(res instanceof Response) || !res.ok) {
          throw new Error(
            res instanceof Response
              ? `Server error: ${res.status}`
              : 'Unexpected response type',
          )
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buf = ''
        let fullText = ''
        const thinkingBlocks: string[] = []
        const msgArtifacts: ArtifactFile[] = []
        let gotFirstContent = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'thinking') {
                const blocks = data.blocks as string[]
                thinkingBlocks.length = 0
                thinkingBlocks.push(...blocks)
                if (!gotFirstContent) {
                  setStatus({
                    phase: 'thinking',
                    content: blocks[blocks.length - 1],
                  })
                }
                setMessages((prev) => {
                  const next = prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, thinking: [...thinkingBlocks] }
                      : m,
                  )
                  debouncedPersist(next)
                  return next
                })
              }

              if (data.type === 'text') {
                fullText = data.content
                if (!gotFirstContent) {
                  gotFirstContent = true
                  setStatus({ phase: 'responding' })
                }
                setMessages((prev) => {
                  const next = prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: fullText } : m,
                  )
                  debouncedPersist(next)
                  return next
                })
              }

              if (data.type === 'status') {
                setStatus({ phase: 'tool', detail: data.event })
              }

              if (data.type === 'file') {
                const file: ArtifactFile = {
                  path: data.path,
                  filename: data.filename,
                  version: Date.now(),
                  content: data.content || '',
                }
                const existingIdx = msgArtifacts.findIndex(
                  (a) => a.path === file.path,
                )
                if (existingIdx !== -1) {
                  msgArtifacts[existingIdx] = file
                } else {
                  msgArtifacts.push(file)
                }
                setArtifacts((prev) => {
                  const exists = prev.some((a) => a.path === file.path)
                  const next = exists
                    ? prev.map((a) => (a.path === file.path ? file : a))
                    : [...prev, file]
                  return next
                })
                setMessages((prev) => {
                  const next = prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, artifacts: [...msgArtifacts] }
                      : m,
                  )
                  debouncedPersist(next)
                  return next
                })
                onFileCreatedRef.current?.(file)
              }

              if (data.type === 'edge') {
                onEdgeCreatedRef.current?.({
                  source: data.source,
                  target: data.target,
                  kind: data.kind,
                })
              }

              if (data.type === 'askUser') {
                const qs = data.questions as UserQuestion[]
                setPendingQuestions(qs)
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, questions: qs } : m,
                  ),
                )
              }

              if (data.type === 'switchPage') {
                onSwitchPageRef.current?.(data.pageId as string)
              }

              if (data.type === 'renamePage') {
                onRenamePageRef.current?.(
                  data.pageId as string,
                  data.name as string,
                )
              }

              if (data.type === 'devicePreset') {
                onDevicePresetRef.current?.(
                  data.path as string,
                  data.preset as string,
                )
              }

              if (data.type === 'moveArtifact') {
                onMoveArtifactRef.current?.(
                  data.path as string,
                  data.x as number,
                  data.y as number,
                )
              }

              if (data.type === 'usage') {
                const u = data.usage as Record<string, number>
                setUsage((prev) => ({
                  duration_ms:
                    (data.duration_ms as number) ?? prev?.duration_ms ?? 0,
                  total_cost_usd:
                    (data.total_cost_usd as number) ??
                    prev?.total_cost_usd ??
                    0,
                  input_tokens: u?.input_tokens ?? prev?.input_tokens ?? 0,
                  output_tokens: u?.output_tokens ?? prev?.output_tokens ?? 0,
                  cache_read_tokens:
                    u?.cache_read_input_tokens ?? prev?.cache_read_tokens ?? 0,
                  cache_creation_tokens:
                    u?.cache_creation_input_tokens ??
                    prev?.cache_creation_tokens ??
                    0,
                }))
              }

              if (data.type === 'error') {
                setStatus({ phase: 'error', message: data.message })
              }

              if (data.type === 'done') {
                // Cancel any pending debounced persist — we'll do a final one
                if (debouncedPersistRef.current) {
                  clearTimeout(debouncedPersistRef.current)
                  debouncedPersistRef.current = null
                }
                if (data.code !== 0) {
                  setStatus({
                    phase: 'error',
                    message: `Process exited with code ${data.code}`,
                  })
                }
                // Fire batch callback if multiple artifacts were created
                if (msgArtifacts.length > 1) {
                  onBatchCreatedRef.current?.([...msgArtifacts])
                }
                setMessages((prev) => {
                  persistMessages(prev)
                  return prev
                })
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        // Flush debounced persist so partial progress is saved
        if (debouncedPersistRef.current) {
          clearTimeout(debouncedPersistRef.current)
          debouncedPersistRef.current = null
        }
        if ((err as Error).name === 'AbortError') {
          // User stopped — persist partial progress
          setMessages((prev) => {
            persistMessages(prev)
            return prev
          })
        } else {
          const errMsg = (err as Error).message
          setStatus({ phase: 'error', message: errMsg })
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + `\n\n**Error:** ${errMsg}` }
                : m,
            )
            persistMessages(next)
            return next
          })
        }
      } finally {
        setIsStreaming(false)
        setStatus({ phase: 'idle' })
        abortRef.current = null
      }
    },
    [messages, persistMessages, debouncedPersist],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearHistory = useCallback(() => {
    setMessages([])
    setArtifacts([])
    clearChatMessagesFn({ data: { conversationId } })
  }, [conversationId])

  const retry = useCallback(
    (messageId: string, opts: { model?: string; effort?: string } = {}) => {
      if (isStreaming) return
      const idx = messages.findIndex(
        (m) => m.id === messageId && m.role === 'user',
      )
      if (idx === -1) return
      const userMsg = messages[idx]
      // Remove this user message + everything after it from UI
      const trimmed = messages.slice(0, idx)
      setMessages(trimmed)
      persistMessages(trimmed)
      // Resend the same message
      sendMessage(userMsg.content, opts)
    },
    [isStreaming, messages, persistMessages, sendMessage],
  )

  const dismissQuestions = useCallback(() => {
    setPendingQuestions(null)
    // Clear questions from the message so they don't reappear on refresh
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.questions ? { ...m, questions: undefined } : m,
      )
      persistMessages(next)
      return next
    })
  }, [persistMessages])

  return {
    messages,
    isStreaming,
    status,
    usage,
    artifacts,
    loaded,
    pendingQuestions,
    dismissQuestions,
    sendMessage,
    stop,
    retry,
    clearHistory,
  }
}
