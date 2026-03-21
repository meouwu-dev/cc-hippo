import { useState, useCallback, useRef } from 'react';
import { parseDesignTokens } from '../lib/parseTokens';

const API_URL = '/api/chat';

export function useChat({ onStreamUpdate, onStreamComplete, onFileCreated } = {}) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [designTokens, setDesignTokens] = useState(null);
  const abortRef = useRef(null);
  const fullResponseRef = useRef('');
  const onStreamUpdateRef = useRef(onStreamUpdate);
  const onStreamCompleteRef = useRef(onStreamComplete);
  const onFileCreatedRef = useRef(onFileCreated);
  onStreamUpdateRef.current = onStreamUpdate;
  onStreamCompleteRef.current = onStreamComplete;
  onFileCreatedRef.current = onFileCreated;

  const sendMessage = useCallback(async (text, { model, effort } = {}) => {
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    fullResponseRef.current = '';

    const assistantMsg = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const history = [...messages, userMsg].slice(-10);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, model, effort }),
        signal: abort.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'status') {
              // Show tool activity in the streaming message
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant' && !last.content) {
                  updated[updated.length - 1] = { role: 'assistant', content: `[${event.event}...]` };
                }
                return updated;
              });
            } else if (event.type === 'file') {
              onFileCreatedRef.current?.(event);
            } else if (event.type === 'text') {
              fullResponseRef.current += event.content;
              const accumulated = fullResponseRef.current;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                return updated;
              });
              const tokens = parseDesignTokens(accumulated);
              if (tokens) setDesignTokens(tokens);
              // Notify canvas
              onStreamUpdateRef.current?.(accumulated, tokens);
            } else if (event.type === 'error') {
              fullResponseRef.current += `\n\n**Error:** ${event.content}`;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullResponseRef.current };
                return updated;
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `**Connection error:** ${err.message}`,
          };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      onStreamCompleteRef.current?.(fullResponseRef.current, designTokens);
    }
  }, [messages, designTokens]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, designTokens, sendMessage, stop };
}
