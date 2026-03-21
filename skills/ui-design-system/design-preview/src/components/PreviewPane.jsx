import { ColorPalette } from './preview/ColorPalette';
import { TypographyPreview } from './preview/TypographyPreview';
import { SpacingPreview } from './preview/SpacingPreview';
import { ComponentPreview } from './preview/ComponentPreview';
import { downloadDesignMd, downloadTokensCSS, downloadTokensJSON } from '../lib/exportDesign';

export function PreviewPane({ tokens, messages }) {
  if (!tokens) {
    return (
      <div className="preview-pane">
        <div className="preview-empty">
          <div className="preview-empty__icon">🎨</div>
          <h3>Design Preview</h3>
          <p>Design tokens will appear here as the AI generates them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-pane">
      <div className="preview-header">
        <div className="preview-header__left">
          <h2>Live Preview</h2>
          {tokens.aesthetic && <span className="preview-aesthetic">{tokens.aesthetic}</span>}
        </div>
        <div className="preview-downloads">
          <button onClick={() => downloadDesignMd(messages)} title="Download full design as markdown">
            DESIGN.md
          </button>
          <button onClick={() => downloadTokensCSS(tokens)} title="Download CSS custom properties">
            .css
          </button>
          <button onClick={() => downloadTokensJSON(tokens)} title="Download tokens as JSON">
            .json
          </button>
        </div>
      </div>

      <div className="preview-content">
        {Object.keys(tokens.colors).length > 0 && (
          <ColorPalette colors={tokens.colors} />
        )}

        {Object.keys(tokens.typography).length > 0 && (
          <TypographyPreview typography={tokens.typography} />
        )}

        {Object.keys(tokens.spacing).length > 0 && (
          <SpacingPreview spacing={tokens.spacing} radii={tokens.radii} />
        )}

        {Object.keys(tokens.colors).length > 0 && (
          <ComponentPreview tokens={tokens} />
        )}
      </div>
    </div>
  );
}
