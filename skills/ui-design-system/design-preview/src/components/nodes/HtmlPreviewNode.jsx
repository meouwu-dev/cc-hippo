import { NodeShell } from './NodeShell'

export function HtmlPreviewNode({ data }) {
  const { url, filename } = data

  return (
    <NodeShell
      title={filename || 'Preview'}
      color="#06b6d4"
      minWidth={400}
      minHeight={350}
    >
      <div className="html-preview-node">
        <div className="html-preview-node__toolbar">
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open in new tab
          </a>
        </div>
        <iframe
          src={url}
          className="html-preview-node__iframe"
          sandbox="allow-scripts allow-same-origin"
          title={filename}
        />
      </div>
    </NodeShell>
  )
}
