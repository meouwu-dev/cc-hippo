import { useState, useCallback, useRef, useEffect } from 'react'
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
  thinking?: string
  artifacts?: ArtifactFile[]
}

export interface ArtifactFile {
  path: string
  filename: string
  version: number
  content: string
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
  onSwitchPage?: (pageId: string) => void
}

export function useChat({
  projectId,
  conversationId,
  onFileCreated,
  onEdgeCreated,
  onBatchCreated,
  onSwitchPage,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [status, setStatus] = useState<StreamStatus>({ phase: 'idle' })
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([])
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const onFileCreatedRef = useRef(onFileCreated)
  onFileCreatedRef.current = onFileCreated
  const onEdgeCreatedRef = useRef(onEdgeCreated)
  onEdgeCreatedRef.current = onEdgeCreated
  const onBatchCreatedRef = useRef(onBatchCreated)
  onBatchCreatedRef.current = onBatchCreated
  const onSwitchPageRef = useRef(onSwitchPage)
  onSwitchPageRef.current = onSwitchPage

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

  const sendMessage = useCallback(
    async (
      text: string,
      opts: {
        model?: string
        effort?: string
        currentPageId?: string
        currentPageName?: string
      } = {},
    ) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        thinking: '',
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
        let fullThinking = ''
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
                fullThinking = data.content
                if (!gotFirstContent) {
                  setStatus({ phase: 'thinking', content: data.content })
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, thinking: fullThinking }
                      : m,
                  ),
                )
              }

              if (data.type === 'text') {
                fullText = data.content
                if (!gotFirstContent) {
                  gotFirstContent = true
                  setStatus({ phase: 'responding' })
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: fullText } : m,
                  ),
                )
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
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, artifacts: [...msgArtifacts] }
                      : m,
                  ),
                )
                onFileCreatedRef.current?.(file)
              }

              if (data.type === 'edge') {
                onEdgeCreatedRef.current?.({
                  source: data.source,
                  target: data.target,
                  kind: data.kind,
                })
              }

              if (data.type === 'switchPage') {
                onSwitchPageRef.current?.(data.pageId as string)
              }

              if (data.type === 'usage') {
                const u = data.usage as Record<string, number>
                setUsage({
                  duration_ms: data.duration_ms as number,
                  total_cost_usd: data.total_cost_usd as number,
                  input_tokens: (u?.input_tokens) || 0,
                  output_tokens: (u?.output_tokens) || 0,
                  cache_read_tokens:
                    (u?.cache_read_input_tokens) || 0,
                  cache_creation_tokens:
                    (u?.cache_creation_input_tokens) || 0,
                })
              }

              if (data.type === 'error') {
                setStatus({ phase: 'error', message: data.message })
              }

              if (data.type === 'done') {
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
        if ((err as Error).name !== 'AbortError') {
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
    [messages, persistMessages],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearHistory = useCallback(() => {
    setMessages([])
    setArtifacts([])
    clearChatMessagesFn({ data: { conversationId } })
  }, [conversationId])

  return {
    messages,
    isStreaming,
    status,
    usage,
    artifacts,
    loaded,
    sendMessage,
    stop,
    clearHistory,
  }
}
