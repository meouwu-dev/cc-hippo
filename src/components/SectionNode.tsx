import { memo, useState, useCallback } from 'react'
import { NodeResizer } from '@xyflow/react'
import { X } from 'lucide-react'
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
      <div className="section-node">
        <div className="section-header">
          {editing ? (
            <input
              className="section-name-input nodrag"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <span className="section-name" onDoubleClick={handleDoubleClick}>
              {data.label}
            </span>
          )}
          <button
            onClick={handleClose}
            className="section-close-btn"
            title="Remove section"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  )
}

export default memo(SectionNodeInner)
