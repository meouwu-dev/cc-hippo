import { useState, useRef, useEffect } from "react";
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

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  status: StreamStatus;
  onSend: (text: string, opts: { model?: string; effort?: string }) => void;
  onStop: () => void;
  onClear: () => void;
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

export default function ChatPanel({
  messages,
  isStreaming,
  status,
  onSend,
  onStop,
  onClear,
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
        <span className="chat-title">Chat</span>
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
            onClick={onClear}
            className="chat-icon-btn"
            title="Clear history"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="chat-icon-btn"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {!collapsed && (
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
                <div className="chat-msg-content">
                  {msg.content || null}
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
