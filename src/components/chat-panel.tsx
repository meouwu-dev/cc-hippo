import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import {
  Square,
  ChevronDown,
  ChevronUp,
  Brain,
  ChevronRight,
  Plus,
  Trash2,
  SendHorizonal,
} from 'lucide-react'
import { Button } from './ui/button.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.js'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog.js'

import { Input } from './ui/input.js'
import { Textarea } from './ui/textarea.js'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible.js'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js'
import type {
  ChatMessage,
  ArtifactFile,
  StreamStatus,
  UsageInfo,
  UserQuestion,
} from '../hooks/useChat.js'
import type { Conversation } from '../hooks/useConversation.js'

interface ChatPanelProps {
  messages: ChatMessage[]
  isStreaming: boolean
  status: StreamStatus
  conversations: Conversation[]
  currentConversationId: string
  currentModel: string
  currentEffort: string
  onSwitchConversation: (id: string) => void
  onCreateConversation: (name?: string) => void
  onDeleteConversation: (id: string) => void
  onModelChange: (model: string) => void
  onEffortChange: (effort: string) => void
  usage: UsageInfo | null
  onSend: (text: string, opts: { model?: string; effort?: string }) => void
  onStop: () => void
  onArtifactClick: (file: ArtifactFile) => void
  pendingQuestions: UserQuestion[] | null
  dismissQuestions: () => void
}

const MODELS = [
  { value: 'default', label: 'Default' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
]

const EFFORTS = [
  { value: 'default', label: 'Default' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
]

function StatusIndicator({ status }: { status: StreamStatus }) {
  if (status.phase === 'idle') return null

  const labels: Record<string, string> = {
    connecting: 'Connecting to Claude...',
    responding: 'Writing response...',
  }

  let label: string
  let icon: React.ReactNode = null

  switch (status.phase) {
    case 'thinking':
      label = 'Thinking...'
      icon = (
        <Brain
          size={12}
          className="shrink-0 animate-spin text-muted-foreground"
        />
      )
      break
    case 'tool':
      label = status.detail
      icon = (
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-muted-foreground" />
      )
      break
    case 'error':
      label = status.message
      icon = <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
      break
    default:
      label = labels[status.phase] || status.phase
      icon = (
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-muted-foreground" />
      )
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${
        status.phase === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-muted/50 text-muted-foreground'
      }`}
    >
      {icon}
      <span>{label}</span>
    </div>
  )
}

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)

  if (!content) return null

  const preview = content.length > 120 ? content.slice(0, 120) + '...' : content

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="my-1 overflow-hidden rounded-md border bg-muted/30">
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/50">
          <ChevronRight
            size={12}
            className={`shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
          <Brain size={12} />
          <span>Internal reasoning</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-[400px] overflow-auto whitespace-pre-wrap break-words px-2 pb-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {expanded ? content : preview}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function QuestionForm({
  questions,
  onSubmit,
  onDismiss,
}: {
  questions: UserQuestion[]
  onSubmit: (response: string) => void
  onDismiss: () => void
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({})

  const setAnswer = (idx: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [idx]: value }))
    // Clear custom input when picking a predefined option
    setCustomInputs((prev) => ({ ...prev, [idx]: '' }))
  }

  const setCustom = (idx: number, value: string) => {
    setCustomInputs((prev) => ({ ...prev, [idx]: value }))
    setAnswers((prev) => ({ ...prev, [idx]: value }))
  }

  const allAnswered = questions.every((_, i) => answers[i]?.trim())

  const handleSubmit = () => {
    const lines = questions.map(
      (q, i) => `Q: ${q.question}  \nA: ${answers[i] || '(no answer)'}`,
    )
    onSubmit(lines.join('\n\n'))
    onDismiss()
  }

  return (
    <div className="my-2 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      {questions.map((q, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="text-xs font-semibold text-foreground">
            {q.question}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((opt) => (
              <Button
                key={opt}
                variant={
                  answers[i] === opt && !customInputs[i] ? 'default' : 'outline'
                }
                size="sm"
                onClick={() => setAnswer(i, opt)}
              >
                {opt}
              </Button>
            ))}
          </div>
          <Input
            className="mt-1 h-7 text-xs"
            placeholder="Or type your own..."
            value={customInputs[i] || ''}
            onChange={(e) => setCustom(i, e.target.value)}
          />
        </div>
      ))}
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Skip
        </Button>
        <Button size="sm" disabled={!allAnswered} onClick={handleSubmit}>
          Submit
        </Button>
      </div>
    </div>
  )
}

function formatTokens(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatCost(usd: number) {
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function UsageBanner({ usage }: { usage: UsageInfo }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
      {usage.duration_ms > 0 && (
        <span>{formatDuration(usage.duration_ms)}</span>
      )}
      <span title="Input tokens">{formatTokens(usage.input_tokens)} in</span>
      <span title="Output tokens">{formatTokens(usage.output_tokens)} out</span>
      {usage.cache_read_tokens > 0 && (
        <span title="Cache read tokens">
          {formatTokens(usage.cache_read_tokens)} cached
        </span>
      )}
      {usage.total_cost_usd > 0 && (
        <span className="ml-auto">{formatCost(usage.total_cost_usd)}</span>
      )}
    </div>
  )
}

export default function ChatPanel({
  messages,
  isStreaming,
  status,
  conversations,
  currentConversationId,
  currentModel,
  currentEffort,
  onSwitchConversation,
  onCreateConversation,
  onDeleteConversation,
  onModelChange,
  onEffortChange,
  usage,
  onSend,
  onStop,
  onArtifactClick,
  pendingQuestions,
  dismissQuestions,
}: ChatPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [input, setInput] = useState('')
  const model = currentModel
  const effort = currentEffort
  const setModel = (v: string) => onModelChange(v === 'default' ? 'default' : v)
  const setEffort = (v: string) =>
    onEffortChange(v === 'default' ? 'default' : v)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  const handleSubmit = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    onSend(text, {
      model: model === 'default' ? undefined : model,
      effort: effort === 'default' ? undefined : effort,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className={`absolute m-4  z-40 flex w-[380px] flex-col gap-2 ${collapsed ? 'max-h-fit' : 'max-h-[calc(100vh-68px)]'}`}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-[var(--bg-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Header with conversation switcher */}
        <div className="flex shrink-0 items-center gap-1 border-b border-border/50 bg-card px-3 py-2">
          <Select
            value={currentConversationId}
            onValueChange={(val: string | null) => {
              if (val) onSwitchConversation(val)
            }}
          >
            <SelectTrigger size="sm" className="flex-1 text-xs">
              <SelectValue>
                {conversations.find((c) => c.id === currentConversationId)
                  ?.name ?? 'Chat'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {conversations.map((c) => (
                <SelectItem key={c.id} value={c.id} label={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 shrink-0"
                  onClick={() => onCreateConversation()}
                />
              }
            >
              <Plus size={12} />
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
          {conversations.length > 1 && (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-5 shrink-0"
                        />
                      }
                    />
                  }
                >
                  <Trash2 size={11} />
                </TooltipTrigger>
                <TooltipContent>Delete chat</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete conversation</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this conversation and all its
                    messages. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => onDeleteConversation(currentConversationId)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setCollapsed((c) => !c)}
                  className="ml-auto"
                />
              }
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </TooltipTrigger>
            <TooltipContent>{collapsed ? 'Expand' : 'Collapse'}</TooltipContent>
          </Tooltip>
        </div>

        {!collapsed && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex min-h-[200px] flex-col gap-3 p-3">
                {messages.length === 0 && (
                  <div className="mt-10 text-center text-xs text-muted-foreground">
                    Send a message to start designing.
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-1">
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-wider ${
                        msg.role === 'user'
                          ? 'text-muted-foreground'
                          : 'text-primary'
                      }`}
                    >
                      {msg.role === 'user' ? 'You' : 'Claude'}
                    </div>
                    {msg.thinking && <ThinkingBlock content={msg.thinking} />}
                    <div className="prose prose-invert break-words text-[13px] leading-relaxed text-foreground">
                      {msg.content ? <Markdown>{msg.content}</Markdown> : null}
                    </div>
                    {msg.artifacts?.map((file) => (
                      <button
                        key={file.path}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                        onClick={() => onArtifactClick(file)}
                      >
                        <span>📄</span>
                        <span>{file.filename}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {pendingQuestions && (
                  <QuestionForm
                    questions={pendingQuestions}
                    onSubmit={(response) =>
                      onSend(response, {
                        model: model || undefined,
                        effort: effort || undefined,
                      })
                    }
                    onDismiss={dismissQuestions}
                  />
                )}
                {isStreaming && <StatusIndicator status={status} />}
                {usage && <UsageBanner usage={usage} />}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 rounded-xl border border-border/50 bg-[var(--bg-surface)] p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what to design..."
          className="min-h-0 flex-1"
          rows={2}
          disabled={isStreaming}
        />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">Model</span>
            <Select
              value={model}
              onValueChange={(v) => setModel(v ?? 'default')}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">Effort</span>
            <Select
              value={effort}
              onValueChange={(v) => setEffort(v ?? 'default')}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EFFORTS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={isStreaming ? 'destructive' : 'outline'}
            size="icon-sm"
            onClick={isStreaming ? onStop : handleSubmit}
            disabled={!isStreaming && !input.trim()}
            className="ml-auto"
          >
            {isStreaming ? <Square size={14} /> : <SendHorizonal size={14} />}
          </Button>
        </div>
      </div>
    </div>
  )
}
