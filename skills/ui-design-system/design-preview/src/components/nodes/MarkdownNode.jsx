import Markdown from 'react-markdown'
import { NodeShell } from './NodeShell'
import { downloadDesignMd } from '../../lib/exportDesign'

export function MarkdownNode({ data }) {
  const { content, messages } = data

  return (
    <NodeShell title="DESIGN.md" color="#22c55e" minWidth={400} minHeight={300}>
      <div className="markdown-node">
        <div className="markdown-node__toolbar">
          <button
            onClick={() =>
              downloadDesignMd(messages || [{ role: 'assistant', content }])
            }
          >
            Download .md
          </button>
        </div>
        <div className="markdown-node__content">
          {content ? (
            <Markdown>{content}</Markdown>
          ) : (
            <p className="markdown-node__empty">Waiting for design output...</p>
          )}
        </div>
      </div>
    </NodeShell>
  )
}
