import { useState, useCallback, useEffect } from "react";
import type { Node, NodeChange, Edge, EdgeChange, Connection } from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { ArtifactFile } from "./useChat.js";
import { idbGet, idbSet, idbDelete } from "../lib/storage.js";

export interface ArtifactNodeData extends Record<string, unknown> {
  file: ArtifactFile;
  label: string;
}

const STORAGE_KEY = "canvas-nodes";
const EDGES_KEY = "canvas-edges";

const EDGE_COLORS: Record<string, string> = {
  references: '#888',
  implements: '#818cf8',
  derives: '#f59e0b',
  extends: '#10b981',
};

function getEdgeStyle(kind?: string) {
  const color = (kind && EDGE_COLORS[kind]) || '#666';
  return {
    style: { stroke: color, strokeWidth: 2 },
    labelStyle: { fill: color, fontSize: 10 },
  };
}

export function useCanvasNodes(projectId: string) {
  const [nodes, setNodes] = useState<Node<ArtifactNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const nodesKey = `${STORAGE_KEY}-${projectId}`;
  const edgesKey = `${EDGES_KEY}-${projectId}`;

  // Load from IndexedDB on mount
  useEffect(() => {
    Promise.all([
      idbGet<Node<ArtifactNodeData>[]>(nodesKey),
      idbGet<Edge[]>(edgesKey),
    ]).then(([savedNodes, savedEdges]) => {
      if (savedNodes) setNodes(savedNodes);
      if (savedEdges) setEdges(savedEdges);
    });
  }, [nodesKey, edgesKey]);

  const persistNodes = useCallback(
    (next: Node<ArtifactNodeData>[]) => {
      idbSet(nodesKey, next);
    },
    [nodesKey],
  );

  const persistEdges = useCallback(
    (next: Edge[]) => {
      idbSet(edgesKey, next);
    },
    [edgesKey],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<ArtifactNodeData>>[]) => {
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev);
        persistNodes(next);
        return next;
      });
    },
    [persistNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((prev) => {
        const next = applyEdgeChanges(changes, prev);
        persistEdges(next);
        return next;
      });
    },
    [persistEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        animated: true,
        style: { stroke: '#666', strokeWidth: 2 },
      };
      setEdges((prev) => {
        // Don't add duplicate edges
        if (prev.some((e) => e.source === edge.source && e.target === edge.target)) {
          return prev;
        }
        const next = [...prev, edge];
        persistEdges(next);
        return next;
      });
    },
    [persistEdges],
  );

  const addEdge = useCallback(
    (sourcePath: string, targetPath: string, kind?: string) => {
      const sourceId = `artifact-${sourcePath}`;
      const targetId = `artifact-${targetPath}`;
      setEdges((prev) => {
        if (prev.some((e) => e.source === sourceId && e.target === targetId)) {
          return prev;
        }
        const edgeStyle = getEdgeStyle(kind);
        const edge: Edge = {
          id: `e-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          label: kind || undefined,
          animated: kind === 'implements',
          ...edgeStyle,
        };
        const next = [...prev, edge];
        persistEdges(next);
        return next;
      });
    },
    [persistEdges],
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
          persistNodes(next);
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
        persistNodes(next);
        return next;
      });
    },
    [persistNodes],
  );

  const closeArtifact = useCallback(
    (id: string) => {
      setNodes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        persistNodes(next);
        return next;
      });
      // Also remove edges connected to this node
      setEdges((prev) => {
        const next = prev.filter(
          (e) => e.source !== id && e.target !== id,
        );
        persistEdges(next);
        return next;
      });
    },
    [persistNodes, persistEdges],
  );

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    idbDelete(nodesKey);
    idbDelete(edgesKey);
  }, [nodesKey, edgesKey]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addEdge,
    openArtifact,
    closeArtifact,
    clearCanvas,
  };
}
