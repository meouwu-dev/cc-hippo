import { memo, useMemo, useCallback } from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import Markdown from 'react-markdown'
import {
  X,
  ExternalLink,
  Download,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react'
import type { ArtifactNodeData, DevicePreset } from '../hooks/useCanvasNodes.js'
import type { NodeProps } from '@xyflow/react'

const MIME: Record<string, string> = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  md: 'text/markdown',
  svg: 'image/svg+xml',
  txt: 'text/plain',
}

function ArtifactNodeInner({
  data,
  id,
}: NodeProps & { data: ArtifactNodeData }) {
  const { file, devicePreset } = data
  const ext = file.filename.split('.').pop()?.toLowerCase() || ''

  const handleSetDevice = useCallback(
    (preset: DevicePreset | undefined) => {
      window.dispatchEvent(
        new CustomEvent('set-device-preset', {
          detail: { id, preset },
        }),
      )
    },
    [id],
  )

  const blobUrl = useMemo(() => {
    if (!file.content) return null
    const mime = MIME[ext] || 'text/plain'
    const blob = new Blob([file.content], { type: mime })
    return URL.createObjectURL(blob)
  }, [file.content, ext])

  const handleClose = () => {
    window.dispatchEvent(new CustomEvent('close-artifact', { detail: { id } }))
  }

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="artifact-handle"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="artifact-handle"
      />
      <NodeResizer
        minWidth={280}
        minHeight={200}
        handleStyle={{ opacity: 0, width: 8, height: 8 }}
        lineStyle={{ opacity: 0 }}
      />
      <div className="artifact-node">
        <div className="artifact-titlebar">
          <div className="artifact-title-left">
            <span className="artifact-filename" title={file.filename}>
              {file.filename}
            </span>
            {devicePreset && (
              <span className="device-label">{devicePreset}</span>
            )}
          </div>
          <div className="artifact-toolbar">
            <div className="device-selector nodrag">
              <button
                onClick={() =>
                  handleSetDevice(
                    devicePreset === 'desktop' ? undefined : 'desktop',
                  )
                }
                className={`artifact-tool-btn ${devicePreset === 'desktop' ? 'active' : ''}`}
                title="Desktop (1440×900)"
              >
                <Monitor size={13} />
              </button>
              <button
                onClick={() =>
                  handleSetDevice(
                    devicePreset === 'tablet' ? undefined : 'tablet',
                  )
                }
                className={`artifact-tool-btn ${devicePreset === 'tablet' ? 'active' : ''}`}
                title="Tablet (768×1024)"
              >
                <Tablet size={13} />
              </button>
              <button
                onClick={() =>
                  handleSetDevice(
                    devicePreset === 'mobile' ? undefined : 'mobile',
                  )
                }
                className={`artifact-tool-btn ${devicePreset === 'mobile' ? 'active' : ''}`}
                title="Mobile (375×812)"
              >
                <Smartphone size={13} />
              </button>
            </div>
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="artifact-tool-btn"
                title="Open in new tab"
              >
                <ExternalLink size={13} />
              </a>
            )}
            {blobUrl && (
              <a
                href={blobUrl}
                download={file.filename}
                className="artifact-tool-btn"
                title="Download"
              >
                <Download size={13} />
              </a>
            )}
            <button
              onClick={handleClose}
              className="artifact-tool-btn artifact-close-btn"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>
        <div className="artifact-body nowheel nodrag nopan">
          {ext === 'html' ? (
            <iframe
              srcDoc={file.content}
              sandbox="allow-scripts"
              title={file.filename}
              className="artifact-iframe"
            />
          ) : ext === 'md' ? (
            <div className="artifact-markdown prose prose-invert">
              <Markdown>{file.content}</Markdown>
            </div>
          ) : (
            <pre className="artifact-code">
              <code>{file.content || 'Empty file'}</code>
            </pre>
          )}
        </div>
      </div>
    </>
  )
}

export default memo(ArtifactNodeInner)
