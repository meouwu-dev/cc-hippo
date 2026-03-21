import { useState, useRef, useEffect } from 'react';

const MODELS = [
  { value: '', label: 'Default' },
  { value: 'claude-opus-4-6', label: 'Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
];

const EFFORTS = [
  { value: '', label: 'Default' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];

export function ChatPane({ messages, isStreaming, onSend, onStop }) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    onSend(text, {
      model: model || undefined,
      effort: effort || undefined,
    });
  };

  return (
    <div className="chat-pane">
      <div className="chat-header">
        <h2>Design Chat</h2>
        <div className="chat-options">
          <select value={model} onChange={e => setModel(e.target.value)} disabled={isStreaming}>
            {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={effort} onChange={e => setEffort(e.target.value)} disabled={isStreaming}>
            {EFFORTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Describe the app you want to design.</p>
            <p className="chat-hint">e.g. "Design a cozy recipe app with warm earthy tones"</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message chat-message--${msg.role}`}>
            <div className="chat-message__label">
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className="chat-message__content">
              {msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Describe your app..."
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button type="button" onClick={onStop} className="btn-stop">Stop</button>
        ) : (
          <button type="submit" disabled={!input.trim()}>Send</button>
        )}
      </form>
    </div>
  );
}
