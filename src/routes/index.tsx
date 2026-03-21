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
import { useProject } from "../hooks/useProject.js";
import type { ArtifactFile } from "../hooks/useChat.js";
import { loadState } from "../server/state.js";

export const Route = createFileRoute("/")({
  component: () => (
    <ReactFlowProvider>
      <ProjectShell />
    </ReactFlowProvider>
  ),
});

function ProjectShell() {
  const {
    projects,
    currentProjectId,
    loading,
    switchProject,
    createProject,
    deleteProject,
  } = useProject();

  if (loading || !currentProjectId) {
    return <div className="canvas-app" />;
  }

  return (
    <CanvasApp
      key={currentProjectId}
      projectId={currentProjectId}
      projects={projects}
      onSwitchProject={switchProject}
      onCreateProject={createProject}
      onDeleteProject={deleteProject}
    />
  );
}

interface CanvasAppProps {
  projectId: string;
  projects: { id: string; name: string; created_at: string }[];
  onSwitchProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
}

function CanvasApp({
  projectId,
  projects,
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
}: CanvasAppProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addEdge,
    openArtifact,
    closeArtifact,
  } = useCanvasNodes(projectId);
  const { setCenter } = useReactFlow();

  const handleFileCreated = useCallback(
    (file: ArtifactFile) => {
      openArtifact(file);
    },
    [openArtifact],
  );

  const handleEdgeCreated = useCallback(
    (edge: { source: string; target: string; kind?: string }) => {
      addEdge(edge.target, edge.source, edge.kind);
    },
    [addEdge],
  );

  const { messages, isStreaming, status, sendMessage, stop } = useChat({
    projectId,
    onFileCreated: handleFileCreated,
    onEdgeCreated: handleEdgeCreated,
  });

  // Load artifacts and edges from SQLite on mount
  useEffect(() => {
    loadState({ data: { projectId } }).then((state) => {
      if (state.artifacts.length > 0) {
        for (const art of state.artifacts) {
          openArtifact({
            path: art.path,
            filename: art.filename,
            version: new Date(art.updated_at).getTime(),
            content: art.content,
          });
        }
        for (const edge of state.edges) {
          addEdge(edge.target_path, edge.source_path, edge.kind);
        }
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="canvas-app">
      <ChatPanel
        messages={messages}
        isStreaming={isStreaming}
        status={status}
        projects={projects}
        currentProjectId={projectId}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
        onDeleteProject={onDeleteProject}
        onSend={sendMessage}
        onStop={stop}
        onArtifactClick={handleArtifactClick}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
