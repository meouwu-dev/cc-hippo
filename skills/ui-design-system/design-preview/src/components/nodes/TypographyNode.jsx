import { NodeShell } from './NodeShell';
import { TypographyPreview } from '../preview/TypographyPreview';

export function TypographyNode({ data }) {
  return (
    <NodeShell title="Typography" color="#8b5cf6" minWidth={300} minHeight={200}>
      <div className="preview-node">
        <TypographyPreview typography={data.typography || {}} />
      </div>
    </NodeShell>
  );
}
