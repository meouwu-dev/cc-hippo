import { NodeResizer } from '@xyflow/react'

export function NodeShell({
  title,
  children,
  onClose,
  minWidth = 280,
  minHeight = 200,
  color,
}) {
  return (
    <>
      <NodeResizer minWidth={minWidth} minHeight={minHeight} />
      <div className="node-shell">
        <div
          className="node-shell__header dragHandle"
          style={color ? { borderColor: color } : undefined}
        >
          <span className="node-shell__title">{title}</span>
          {onClose && (
            <button className="node-shell__close" onClick={onClose}>
              &times;
            </button>
          )}
        </div>
        <div className="node-shell__body nowheel nodrag nopan">{children}</div>
      </div>
    </>
  )
}
