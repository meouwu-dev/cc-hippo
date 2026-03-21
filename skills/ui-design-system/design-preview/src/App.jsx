import { useCallback, useEffect } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useChat } from './hooks/useChat';
import { useCanvasNodes } from './hooks/useCanvasNodes';
import { ChatNode } from './components/nodes/ChatNode';
import { MarkdownNode } from './components/nodes/MarkdownNode';
import { ColorPaletteNode } from './components/nodes/ColorPaletteNode';
import { TypographyNode } from './components/nodes/TypographyNode';
import { ComponentPreviewNode } from './components/nodes/ComponentPreviewNode';
import { HtmlPreviewNode } from './components/nodes/HtmlPreviewNode';
import './App.css';

const nodeTypes = {
  markdown: MarkdownNode,
  colorPalette: ColorPaletteNode,
  typography: TypographyNode,
  componentPreview: ComponentPreviewNode,
  htmlPreview: HtmlPreviewNode,
};

export default function App() {
  const {
    nodes,
    onNodesChange,
    addNode,
    updateNodeData,
    resetCanvas,
    persistNow,
  } = useCanvasNodes();

  const onStreamUpdate = useCallback((content, tokens) => {
    // Only show in markdown node — this is the design system output
    addNode('markdown', { content });

    if (tokens) {
      if (Object.keys(tokens.colors).length > 0) {
        addNode('colorPalette', { colors: tokens.colors });
      }
      if (Object.keys(tokens.typography).length > 0) {
        addNode('typography', { typography: tokens.typography });
      }
      if (Object.keys(tokens.colors).length > 0) {
        addNode('componentPreview', { tokens });
      }
    }
  }, [addNode]);

  const onFileCreated = useCallback((file) => {
    // Spawn an HTML preview node for .html files
    if (file.url.endsWith('.html')) {
      const filename = file.url.split('/').pop();
      // Use filename as a unique key so multiple HTML files get separate nodes
      addNode(`htmlPreview_${filename}`, {
        url: file.url,
        filename,
      });
    }
  }, [addNode]);

  const onStreamComplete = useCallback(() => {
    persistNow();
  }, [persistNow]);

  const { messages, isStreaming, sendMessage, stop } = useChat({
    onStreamUpdate,
    onStreamComplete,
    onFileCreated,
  });

  // Keep markdown node messages in sync for download
  useEffect(() => {
    updateNodeData('markdown', { messages });
  }, [messages, updateNodeData]);

  return (
    <div className="app">
      <div className="canvas-toolbar">
        <h1>Design Preview</h1>
        <span className="canvas-toolbar__sub">UI Design System &middot; Canvas</span>
        <div className="canvas-toolbar__actions">
          <button className="btn-clear" onClick={resetCanvas} disabled={isStreaming}>
            Reset
          </button>
        </div>
      </div>

      {/* Sticky chat overlay - pinned top-left */}
      <div className="chat-overlay">
        <ChatNode data={{ messages, isStreaming, onSend: sendMessage, onStop: stop }} />
      </div>

      <div className="canvas-container">
        <ReactFlow
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant="dots" gap={20} size={1} color="var(--border)" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
