import { useState, useCallback, useEffect } from "react";
import type { Node, NodeChange } from "@xyflow/react";
import { applyNodeChanges } from "@xyflow/react";
import type { ArtifactFile } from "./useChat.js";
import { idbGet, idbSet, idbDelete } from "../lib/storage.js";

export interface ArtifactNodeData extends Record<string, unknown> {
  file: ArtifactFile;
  label: string;
}

const STORAGE_KEY = "canvas-nodes";

export function useCanvasNodes() {
  const [nodes, setNodes] = useState<Node<ArtifactNodeData>[]>([]);

  // Load from IndexedDB on mount
  useEffect(() => {
    idbGet<Node<ArtifactNodeData>[]>(STORAGE_KEY).then((saved) => {
      if (saved) setNodes(saved);
    });
  }, []);

  const persist = useCallback((next: Node<ArtifactNodeData>[]) => {
    idbSet(STORAGE_KEY, next);
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<ArtifactNodeData>>[]) => {
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const openArtifact = useCallback(
    (file: ArtifactFile) => {
      setNodes((prev) => {
        const existingIdx = prev.findIndex(
          (n) => (n.data as ArtifactNodeData).file.path === file.path,
        );
        if (existingIdx !== -1) {
          const next = prev.map((n, i) =>
            i === existingIdx ? { ...n, data: { ...n.data, file } } : n,
          );
          persist(next);
          return next;
        }

        const newNode: Node<ArtifactNodeData> = {
          id: `artifact-${file.path}`,
          type: "artifact",
          position: {
            x: 100 + prev.length * 40,
            y: 100 + prev.length * 40,
          },
          data: { file, label: file.filename },
          style: { width: 480, height: 400 },
        };

        const next = [...prev, newNode];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const closeArtifact = useCallback(
    (id: string) => {
      setNodes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearCanvas = useCallback(() => {
    setNodes([]);
    idbDelete(STORAGE_KEY);
  }, []);

  return { nodes, onNodesChange, openArtifact, closeArtifact, clearCanvas };
}
