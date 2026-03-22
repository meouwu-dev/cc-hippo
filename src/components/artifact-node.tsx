import { memo, useMemo, useCallback } from 'react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import Markdown from 'react-markdown'
import {
  Minus,
  Maximize2,
  ExternalLink,
  Download,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react'
import { Button } from './ui/button.js'
import { Badge } from './ui/badge.js'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js'
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
  const { file, devicePreset, minimized, streaming } = data
  const ext = (file.path || file.filename).split('.').pop()?.toLowerCase() || ''

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

  const handleToggleMinimize = () => {
    window.dispatchEvent(
      new CustomEvent('minimize-artifact', { detail: { id } }),
    )
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
      {!minimized && (
        <NodeResizer
          minWidth={280}
          minHeight={200}
          handleStyle={{ opacity: 0, width: 8, height: 8 }}
          lineStyle={{ opacity: 0 }}
        />
      )}
      <div className="flex size-full flex-col overflow-hidden rounded-[10px] border border-border/50 bg-card transition-colors hover:border-primary/40">
        {/* Title bar */}
        <div className="flex shrink-0 cursor-grab items-center justify-between border-b border-border/50 bg-muted/50 px-2.5 py-1.5 select-none active:cursor-grabbing">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className="truncate text-xs font-semibold text-foreground"
              title={file.filename}
            >
              {file.filename}
            </span>
            {streaming && (
              <div className="flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5">
                <div className="size-1.5 animate-pulse rounded-full bg-primary" />
                <span className="text-[10px] font-medium text-primary">
                  Writing
                </span>
              </div>
            )}
            {devicePreset && (
              <Badge variant="secondary" className="h-4 text-[10px] capitalize">
                {devicePreset}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5 nodrag">
            {/* Device selector */}
            {!minimized && (
              <div className="mr-1 flex gap-0.5">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant={
                          devicePreset === 'desktop' ? 'secondary' : 'ghost'
                        }
                        size="icon-xs"
                        onClick={() =>
                          handleSetDevice(
                            devicePreset === 'desktop' ? undefined : 'desktop',
                          )
                        }
                      />
                    }
                  >
                    <Monitor size={13} />
                  </TooltipTrigger>
                  <TooltipContent>Desktop (1440x900)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant={
                          devicePreset === 'tablet' ? 'secondary' : 'ghost'
                        }
                        size="icon-xs"
                        onClick={() =>
                          handleSetDevice(
                            devicePreset === 'tablet' ? undefined : 'tablet',
                          )
                        }
                      />
                    }
                  >
                    <Tablet size={13} />
                  </TooltipTrigger>
                  <TooltipContent>Tablet (768x1024)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant={
                          devicePreset === 'mobile' ? 'secondary' : 'ghost'
                        }
                        size="icon-xs"
                        onClick={() =>
                          handleSetDevice(
                            devicePreset === 'mobile' ? undefined : 'mobile',
                          )
                        }
                      />
                    }
                  >
                    <Smartphone size={13} />
                  </TooltipTrigger>
                  <TooltipContent>Mobile (375x812)</TooltipContent>
                </Tooltip>
              </div>
            )}
            {!minimized && blobUrl && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      render={
                        <a
                          href={blobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    />
                  }
                >
                  <ExternalLink size={13} />
                </TooltipTrigger>
                <TooltipContent>Open in new tab</TooltipContent>
              </Tooltip>
            )}
            {!minimized && blobUrl && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      render={<a href={blobUrl} download={file.filename} />}
                    />
                  }
                >
                  <Download size={13} />
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleToggleMinimize}
                  />
                }
              >
                {minimized ? <Maximize2 size={13} /> : <Minus size={13} />}
              </TooltipTrigger>
              <TooltipContent>
                {minimized ? 'Restore' : 'Minimize'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        {/* Body */}
        {!minimized && (
          <div className="flex-1 cursor-default overflow-auto select-text nowheel nodrag nopan">
            {ext === 'html' ? (
              <iframe
                srcDoc={file.content}
                sandbox="allow-scripts"
                title={file.filename}
                className="size-full border-none bg-white"
              />
            ) : ext === 'md' ? (
              <div className="prose prose-invert p-3 text-[13px] leading-relaxed text-foreground">
                <Markdown>{file.content}</Markdown>
              </div>
            ) : (
              <pre className="m-0 overflow-auto whitespace-pre p-3 font-mono text-xs leading-relaxed text-foreground">
                <code>{file.content || 'Empty file'}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default memo(ArtifactNodeInner)
