import { NodeShell } from './NodeShell'
import { ColorPalette } from '../preview/ColorPalette'

export function ColorPaletteNode({ data }) {
  return (
    <NodeShell
      title="Color Palette"
      color="#f59e0b"
      minWidth={300}
      minHeight={200}
    >
      <div className="preview-node">
        <ColorPalette colors={data.colors || {}} />
      </div>
    </NodeShell>
  )
}
