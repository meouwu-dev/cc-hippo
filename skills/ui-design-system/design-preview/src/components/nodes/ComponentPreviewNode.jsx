import { NodeShell } from './NodeShell';
import { ComponentPreview } from '../preview/ComponentPreview';
import { downloadTokensCSS, downloadTokensJSON } from '../../lib/exportDesign';

export function ComponentPreviewNode({ data }) {
  const { tokens } = data;

  return (
    <NodeShell title="Components" color="#ec4899" minWidth={340} minHeight={280}>
      <div className="preview-node">
        <div className="preview-node__toolbar">
          <button onClick={() => downloadTokensCSS(tokens)}>Export .css</button>
          <button onClick={() => downloadTokensJSON(tokens)}>Export .json</button>
        </div>
        <ComponentPreview tokens={tokens || { colors: {}, typography: {}, radii: {}, shadows: {} }} />
      </div>
    </NodeShell>
  );
}
