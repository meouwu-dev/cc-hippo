import { memo, useState, useCallback } from 'react'
import { NodeResizer } from '@xyflow/react'
import { X } from 'lucide-react'
import { Button } from './ui/button.js'
import { Input } from './ui/input.js'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js'
import type { NodeProps } from '@xyflow/react'

export interface SectionNodeData extends Record<string, unknown> {
  label: string
  sectionId: string
  pageId: string
}

function SectionNodeInner({ data, id }: NodeProps & { data: SectionNodeData }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(data.label)

  const handleClose = useCallback(() => {
    window.dispatchEvent(new CustomEvent('close-section', { detail: { id } }))
  }, [id])

  const handleDoubleClick = useCallback(() => {
    setEditing(true)
  }, [])

  const handleBlur = useCallback(() => {
    setEditing(false)
    if (name.trim() && name !== data.label) {
      window.dispatchEvent(
        new CustomEvent('rename-section', {
          detail: { id, name: name.trim() },
        }),
      )
    }
  }, [id, name, data.label])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        ;(e.target as HTMLInputElement).blur()
      }
      if (e.key === 'Escape') {
        setName(data.label)
        setEditing(false)
      }
    },
    [data.label],
  )

  return (
    <>
      <NodeResizer
        minWidth={400}
        minHeight={300}
        handleStyle={{ opacity: 0, width: 10, height: 10 }}
        lineStyle={{ opacity: 0 }}
      />
      <div className="size-full min-h-[300px] rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.04]">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          {editing ? (
            <Input
              className="flex-1 text-sm font-semibold nodrag"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <span
              className="cursor-default text-sm font-semibold text-muted-foreground select-none"
              onDoubleClick={handleDoubleClick}
            >
              {data.label}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleClose}
                  className="opacity-40 hover:opacity-100"
                />
              }
            >
              <X size={14} />
            </TooltipTrigger>
            <TooltipContent>Remove section</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  )
}

export default memo(SectionNodeInner)
