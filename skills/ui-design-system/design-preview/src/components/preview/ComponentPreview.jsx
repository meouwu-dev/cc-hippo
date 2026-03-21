export function ComponentPreview({ tokens }) {
  const { colors, typography, radii, shadows } = tokens

  // Resolve tokens to use
  const primary =
    colors['color-primary'] ||
    colors['primary'] ||
    colors['color-primary-500'] ||
    Object.entries(colors).find(([k]) => k.includes('primary'))?.[1] ||
    '#6366f1'
  const primaryText = colors['color-primary-text'] || '#ffffff'
  const surface =
    colors['color-surface'] ||
    colors['surface'] ||
    colors['color-bg'] ||
    Object.entries(colors).find(([k]) => k.match(/surface|bg/))?.[1] ||
    '#ffffff'
  const textColor =
    colors['color-text'] ||
    colors['text'] ||
    colors['color-text-primary'] ||
    Object.entries(colors).find(([k]) => k.match(/text(?!.*bg)/))?.[1] ||
    '#1a1a1a'
  const border =
    colors['color-border'] ||
    colors['border'] ||
    Object.entries(colors).find(([k]) => k.includes('border'))?.[1] ||
    '#e5e7eb'
  const radius =
    radii['radius-md'] ||
    radii['border-radius'] ||
    Object.values(radii)[0] ||
    '8px'
  const shadow =
    shadows['shadow-md'] ||
    shadows['shadow'] ||
    Object.values(shadows)[0] ||
    '0 1px 3px rgba(0,0,0,0.1)'
  const font =
    typography['_primary-font'] ||
    Object.entries(typography).find(([k]) => k.includes('family'))?.[1] ||
    'inherit'

  const baseStyle = { fontFamily: font, color: textColor }

  return (
    <section className="preview-section">
      <h3>Sample Components</h3>

      <div className="component-grid" style={baseStyle}>
        {/* Button */}
        <div className="component-card">
          <h4>Button</h4>
          <div className="component-card__demo">
            <button
              style={{
                backgroundColor: primary,
                color: primaryText,
                border: 'none',
                borderRadius: radius,
                padding: '10px 24px',
                fontFamily: font,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: shadow,
              }}
            >
              Primary Action
            </button>
            <button
              style={{
                backgroundColor: 'transparent',
                color: primary,
                border: `1.5px solid ${primary}`,
                borderRadius: radius,
                padding: '10px 24px',
                fontFamily: font,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Secondary
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="component-card">
          <h4>Card</h4>
          <div className="component-card__demo">
            <div
              style={{
                backgroundColor: surface,
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding: '20px',
                boxShadow: shadow,
                maxWidth: 280,
              }}
            >
              <div
                style={{ fontWeight: 600, fontSize: '16px', marginBottom: 8 }}
              >
                Card Title
              </div>
              <div style={{ fontSize: '14px', opacity: 0.7 }}>
                This is a sample card component using the generated design
                tokens.
              </div>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="component-card">
          <h4>Input</h4>
          <div className="component-card__demo">
            <input
              type="text"
              placeholder="Type something..."
              style={{
                backgroundColor: surface,
                color: textColor,
                border: `1.5px solid ${border}`,
                borderRadius: radius,
                padding: '10px 14px',
                fontFamily: font,
                fontSize: '14px',
                outline: 'none',
                width: 220,
              }}
              readOnly
            />
          </div>
        </div>
      </div>
    </section>
  )
}
