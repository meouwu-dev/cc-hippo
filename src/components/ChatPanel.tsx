import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import {
  Send,
  Square,
  ChevronDown,
  ChevronUp,
  Trash2,
  Brain,
  ChevronRight,
} from "lucide-react";
import type { ChatMessage, ArtifactFile, StreamStatus } from "../hooks/useChat.js";
import type { Project } from "../hooks/useProject.js";

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  status: StreamStatus;
  projects: Project[];
  currentProjectId: string;
  onSwitchProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onSend: (text: string, opts: { model?: string; effort?: string }) => void;
  onStop: () => void;
  onArtifactClick: (file: ArtifactFile) => void;
}

const MODELS = [
  { value: "", label: "Default" },
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
];

const EFFORTS = [
  { value: "", label: "Default" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
];

function StatusIndicator({ status }: { status: StreamStatus }) {
  if (status.phase === "idle") return null;

  const labels: Record<string, string> = {
    connecting: "Connecting to Claude...",
    responding: "Writing response...",
  };

  let label: string;
  let icon: React.ReactNode = null;

  switch (status.phase) {
    case "thinking":
      label = "Thinking...";
      icon = <Brain size={12} className="status-icon spin" />;
      break;
    case "tool":
      label = status.detail;
      icon = <span className="status-dot pulse" />;
      break;
    case "error":
      label = status.message;
      icon = <span className="status-dot error" />;
      break;
    default:
      label = labels[status.phase] || status.phase;
      icon = <span className="status-dot pulse" />;
  }

  return (
    <div className={`chat-status ${status.phase === "error" ? "chat-status-error" : ""}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  // Show a truncated preview
  const preview =
    content.length > 120 ? content.slice(0, 120) + "..." : content;

  return (
    <div className="chat-thinking-block">
      <button
        className="chat-thinking-toggle"
        onClick={() => setExpanded((e) => !e)}
      >
        <ChevronRight
          size={12}
          className={`thinking-chevron ${expanded ? "expanded" : ""}`}
        />
        <Brain size={12} />
        <span>Internal reasoning</span>
      </button>
      <div className={`chat-thinking-content ${expanded ? "expanded" : ""}`}>
        {expanded ? content : preview}
      </div>
    </div>
  );
}

interface ChoiceData {
  question: string;
  options: string[];
}

const CHOICE_RE = /\[CHOICE\]\s*([\s\S]*?)\s*\[\/CHOICE\]/g;

function parseContentWithChoices(content: string) {
  const parts: ({ type: "text"; text: string } | { type: "choice"; data: ChoiceData })[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(CHOICE_RE)) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: content.slice(lastIndex, match.index) });
    }
    try {
      const data = JSON.parse(match[1]) as ChoiceData;
      if (data.question && Array.isArray(data.options)) {
        parts.push({ type: "choice", data });
      }
    } catch {
      parts.push({ type: "text", text: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", text: content.slice(lastIndex) });
  }

  // Fallback: detect markdown option lists that should have been [CHOICE] blocks
  // Pattern: 3+ lines starting with bold text (numbered or bulleted)
  if (!content.includes("[CHOICE]")) {
    const OPTION_RE = /^(?:\d+\.\s+|\*\s+|-\s+)\*\*(.+?)\*\*/gm;
    const options = [...content.matchAll(OPTION_RE)].map((m) => m[1]);
    if (options.length >= 3) {
      // Find where the list starts to split text vs choices
      const firstMatch = content.match(OPTION_RE);
      if (firstMatch) {
        const listStart = content.indexOf(firstMatch[0]);
        const textBefore = content.slice(0, listStart).trim();
        // Extract question from text before the list (last non-empty line)
        const lines = textBefore.split("\n").filter((l) => l.trim());
        const question = lines[lines.length - 1]?.replace(/[*#]/g, "").trim() || "Choose an option:";
        return [
          ...(textBefore ? [{ type: "text" as const, text: textBefore }] : []),
          { type: "choice" as const, data: { question, options } },
        ];
      }
    }
  }

  return parts;
}

function ChoiceBlock({
  data,
  onSelect,
  disabled,
}: {
  data: ChoiceData;
  onSelect: (option: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="chat-choice-block">
      <div className="chat-choice-question">{data.question}</div>
      <div className="chat-choice-options">
        {data.options.map((opt) => (
          <button
            key={opt}
            className="chat-choice-btn"
            onClick={() => onSelect(opt)}
            disabled={disabled}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel({
  messages,
  isStreaming,
  status,
  projects,
  currentProjectId,
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
  onSend,
  onStop,
  onArtifactClick,
}: ChatPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSend(text, {
      model: model || undefined,
      effort: effort || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-panel" data-collapsed={collapsed}>
      <div className="chat-header">
        <div className="chat-project-bar">
          <select
            value={currentProjectId}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                const name = window.prompt('Project name:')
                if (name?.trim()) onCreateProject(name.trim())
              } else {
                onSwitchProject(e.target.value)
              }
            }}
            className="chat-select chat-project-select"
            title="Project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="__new__">+ New Project...</option>
          </select>
          {projects.length > 1 && (
            <button
              onClick={() => {
                if (window.confirm('Delete this project and all its data?')) {
                  onDeleteProject(currentProjectId)
                }
              }}
              className="chat-icon-btn"
              title="Delete project"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <div className="chat-header-controls">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="chat-select"
            title="Model"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className="chat-select"
            title="Effort"
          >
            {EFFORTS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="chat-icon-btn"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="chat-collapsed-island">
          {isStreaming && <StatusIndicator status={status} />}
          <div className="chat-input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what to design..."
              className="chat-textarea"
              rows={1}
              disabled={isStreaming}
            />
            <button
              onClick={isStreaming ? onStop : handleSubmit}
              className="chat-send-btn"
              disabled={!isStreaming && !input.trim()}
            >
              {isStreaming ? <Square size={16} /> : <Send size={16} />}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                Send a message to start designing.
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-msg chat-msg-${msg.role}`}>
                <div className="chat-msg-role">
                  {msg.role === "user" ? "You" : "Claude"}
                </div>
                {msg.thinking && <ThinkingBlock content={msg.thinking} />}
                <div className="chat-msg-content prose prose-invert">
                  {msg.content
                    ? parseContentWithChoices(msg.content).map((part, i) =>
                        part.type === "text" ? (
                          <Markdown key={i}>{part.text}</Markdown>
                        ) : (
                          <ChoiceBlock
                            key={i}
                            data={part.data}
                            onSelect={(opt) =>
                              onSend(opt, {
                                model: model || undefined,
                                effort: effort || undefined,
                              })
                            }
                            disabled={isStreaming}
                          />
                        ),
                      )
                    : null}
                </div>
                {msg.artifacts?.map((file) => (
                  <button
                    key={file.path}
                    className="chat-artifact-card"
                    onClick={() => onArtifactClick(file)}
                  >
                    <span className="chat-artifact-icon">📄</span>
                    <span className="chat-artifact-name">{file.filename}</span>
                  </button>
                ))}
              </div>
            ))}
            {isStreaming && <StatusIndicator status={status} />}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what to design..."
              className="chat-textarea"
              rows={2}
              disabled={isStreaming}
            />
            <button
              onClick={isStreaming ? onStop : handleSubmit}
              className="chat-send-btn"
              disabled={!isStreaming && !input.trim()}
            >
              {isStreaming ? <Square size={16} /> : <Send size={16} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
