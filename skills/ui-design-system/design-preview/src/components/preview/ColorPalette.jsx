export function ColorPalette({ colors }) {
  // Group colors by semantic category
  const groups = {}
  for (const [name, value] of Object.entries(colors)) {
    const category = name.match(/primary/i)
      ? 'Primary'
      : name.match(/secondary/i)
        ? 'Secondary'
        : name.match(/accent/i)
          ? 'Accent'
          : name.match(/neutral|gray|grey/i)
            ? 'Neutral'
            : name.match(/success/i)
              ? 'Success'
              : name.match(/warning/i)
                ? 'Warning'
                : name.match(/error|danger/i)
                  ? 'Error'
                  : name.match(/surface|bg|background/i)
                    ? 'Surface'
                    : name.match(/text|foreground/i)
                      ? 'Text'
                      : 'Other'
    if (!groups[category]) groups[category] = []
    groups[category].push({ name, value })
  }

  return (
    <section className="preview-section">
      <h3>Color Palette</h3>
      <div className="color-groups">
        {Object.entries(groups).map(([group, swatches]) => (
          <div key={group} className="color-group">
            <h4>{group}</h4>
            <div className="color-swatches">
              {swatches.map(({ name, value }) => (
                <div key={name} className="color-swatch">
                  <div
                    className="color-swatch__color"
                    style={{ backgroundColor: value }}
                    title={value}
                  />
                  <div className="color-swatch__info">
                    <code>--{name}</code>
                    <span>{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
