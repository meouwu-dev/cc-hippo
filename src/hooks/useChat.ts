import { useState, useCallback, useRef, useEffect } from "react";
import { chatStream } from "../server/chat.js";
import { idbGet, idbSet, idbDelete } from "../lib/storage.js";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  artifacts?: ArtifactFile[];
}

export interface ArtifactFile {
  path: string;
  filename: string;
  version: number;
  content: string;
}

export type StreamStatus =
  | { phase: "idle" }
  | { phase: "connecting" }
  | { phase: "thinking"; content: string }
  | { phase: "tool"; detail: string }
  | { phase: "responding" }
  | { phase: "error"; message: string };

interface UseChatOptions {
  onFileCreated?: (file: ArtifactFile) => void;
}

export function useChat({ onFileCreated }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<StreamStatus>({ phase: "idle" });
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const onFileCreatedRef = useRef(onFileCreated);
  onFileCreatedRef.current = onFileCreated;

  // Load from IndexedDB on mount
  useEffect(() => {
    Promise.all([
      idbGet<ChatMessage[]>("messages"),
      idbGet<ArtifactFile[]>("artifacts"),
    ]).then(([msgs, arts]) => {
      if (msgs) setMessages(msgs);
      if (arts) setArtifacts(arts);
      setLoaded(true);
    });
  }, []);

  const persistMessages = useCallback((msgs: ChatMessage[]) => {
    idbSet("messages", msgs);
  }, []);

  const persistArtifacts = useCallback((arts: ArtifactFile[]) => {
    idbSet("artifacts", arts);
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      opts: { model?: string; effort?: string } = {},
    ) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        thinking: "",
        artifacts: [],
      };

      setMessages((prev) => {
        const next = [...prev, userMsg, assistantMsg];
        persistMessages(next);
        return next;
      });

      setIsStreaming(true);
      setStatus({ phase: "connecting" });
      const controller = new AbortController();
      abortRef.current = controller;

      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await chatStream({
          data: {
            message: text,
            history,
            model: opts.model,
            effort: opts.effort,
          },
          signal: controller.signal,
        });

        if (!(res instanceof Response) || !res.ok) {
          throw new Error(
            res instanceof Response
              ? `Server error: ${res.status}`
              : "Unexpected response type",
          );
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buf = "";
        let fullText = "";
        let fullThinking = "";
        const msgArtifacts: ArtifactFile[] = [];
        let gotFirstContent = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "thinking") {
                fullThinking = data.content;
                if (!gotFirstContent) {
                  setStatus({ phase: "thinking", content: data.content });
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, thinking: fullThinking }
                      : m,
                  ),
                );
              }

              if (data.type === "text") {
                fullText = data.content;
                if (!gotFirstContent) {
                  gotFirstContent = true;
                  setStatus({ phase: "responding" });
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: fullText }
                      : m,
                  ),
                );
              }

              if (data.type === "status") {
                setStatus({ phase: "tool", detail: data.event });
              }

              if (data.type === "file") {
                const file: ArtifactFile = {
                  path: data.path,
                  filename: data.filename,
                  version: Date.now(),
                  content: data.content || "",
                };
                const existingIdx = msgArtifacts.findIndex(
                  (a) => a.path === file.path,
                );
                if (existingIdx !== -1) {
                  msgArtifacts[existingIdx] = file;
                } else {
                  msgArtifacts.push(file);
                }
                setArtifacts((prev) => {
                  const exists = prev.some((a) => a.path === file.path);
                  const next = exists
                    ? prev.map((a) => (a.path === file.path ? file : a))
                    : [...prev, file];
                  persistArtifacts(next);
                  return next;
                });
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, artifacts: [...msgArtifacts] }
                      : m,
                  ),
                );
                onFileCreatedRef.current?.(file);
              }

              if (data.type === "error") {
                setStatus({ phase: "error", message: data.message });
              }

              if (data.type === "done") {
                if (data.code !== 0) {
                  setStatus({
                    phase: "error",
                    message: `Process exited with code ${data.code}`,
                  });
                }
                setMessages((prev) => {
                  persistMessages(prev);
                  return prev;
                });
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const errMsg = (err as Error).message;
          setStatus({ phase: "error", message: errMsg });
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + `\n\n**Error:** ${errMsg}` }
                : m,
            );
            persistMessages(next);
            return next;
          });
        }
      } finally {
        setIsStreaming(false);
        setStatus({ phase: "idle" });
        abortRef.current = null;
      }
    },
    [messages, persistMessages, persistArtifacts],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setArtifacts([]);
    idbDelete("messages");
    idbDelete("artifacts");
  }, []);

  return {
    messages,
    isStreaming,
    status,
    artifacts,
    loaded,
    sendMessage,
    stop,
    clearHistory,
  };
}
