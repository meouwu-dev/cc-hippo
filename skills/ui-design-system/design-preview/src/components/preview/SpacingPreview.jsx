export function SpacingPreview({ spacing, radii }) {
  return (
    <section className="preview-section">
      <h3>Spacing & Radii</h3>

      {Object.keys(spacing).length > 0 && (
        <div className="spacing-vis">
          <h4>Spacing</h4>
          <div className="spacing-blocks">
            {Object.entries(spacing).map(([name, val]) => (
              <div key={name} className="spacing-block">
                <div
                  className="spacing-block__bar"
                  style={{ width: val, height: val, minWidth: 8, minHeight: 8 }}
                />
                <code>
                  --{name}: {val}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(radii).length > 0 && (
        <div className="radii-vis">
          <h4>Border Radius</h4>
          <div className="radii-blocks">
            {Object.entries(radii).map(([name, val]) => (
              <div key={name} className="radii-block">
                <div
                  className="radii-block__box"
                  style={{ borderRadius: val }}
                />
                <code>
                  --{name}: {val}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
