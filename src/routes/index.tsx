import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ChatPanel from "../components/ChatPanel.js";
import ArtifactNode from "../components/ArtifactNode.js";
import { useChat } from "../hooks/useChat.js";
import { useCanvasNodes } from "../hooks/useCanvasNodes.js";
import type { ArtifactFile } from "../hooks/useChat.js";

export const Route = createFileRoute("/")({
  component: () => (
    <ReactFlowProvider>
      <CanvasApp />
    </ReactFlowProvider>
  ),
});

function CanvasApp() {
  const { nodes, onNodesChange, openArtifact, closeArtifact, clearCanvas } =
    useCanvasNodes();
  const { setCenter } = useReactFlow();

  const handleFileCreated = useCallback(
    (file: ArtifactFile) => {
      openArtifact(file);
    },
    [openArtifact],
  );

  const { messages, isStreaming, status, sendMessage, stop, clearHistory } =
    useChat({ onFileCreated: handleFileCreated });

  // Listen for close-artifact events from nodes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      closeArtifact(detail.id);
    };
    window.addEventListener("close-artifact", handler);
    return () => window.removeEventListener("close-artifact", handler);
  }, [closeArtifact]);

  const nodeTypes: NodeTypes = useMemo(
    () => ({ artifact: ArtifactNode }),
    [],
  );

  const handleArtifactClick = useCallback(
    (file: ArtifactFile) => {
      openArtifact(file);
      // Pan to the node after a tick so React Flow has the node
      requestAnimationFrame(() => {
        const nodeId = `artifact-${file.path}`;
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          const w = (node.style?.width as number) || 480;
          const h = (node.style?.height as number) || 400;
          setCenter(node.position.x + w / 2, node.position.y + h / 2, {
            zoom: 1,
            duration: 300,
          });
        }
      });
    },
    [openArtifact, nodes, setCenter],
  );

  const handleClear = useCallback(() => {
    clearHistory();
    clearCanvas();
  }, [clearHistory, clearCanvas]);

  return (
    <div className="canvas-app">
      <ChatPanel
        messages={messages}
        isStreaming={isStreaming}
        status={status}
        onSend={sendMessage}
        onStop={stop}
        onClear={handleClear}
        onArtifactClick={handleArtifactClick}
      />
      <ReactFlow
        nodes={nodes}
        edges={[]}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView={false}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
