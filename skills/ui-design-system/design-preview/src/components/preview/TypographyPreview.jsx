import { useEffect } from 'react';

export function TypographyPreview({ typography }) {
  // Extract font families to load from Google Fonts
  const fonts = [];
  for (const [key, val] of Object.entries(typography)) {
    if (key.includes('family') || key.startsWith('_')) {
      // Clean up value (remove fallbacks like ", sans-serif")
      const font = val.split(',')[0].trim().replace(/['"]/g, '');
      if (font && !fonts.includes(font)) fonts.push(font);
    }
  }

  useEffect(() => {
    if (fonts.length === 0) return;
    const query = fonts.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&');
    const id = 'design-preview-fonts';
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  }, [fonts.join(',')]);

  // Find relevant size tokens
  const sizes = {};
  for (const [key, val] of Object.entries(typography)) {
    if (key.includes('size') || key.includes('font-size')) {
      sizes[key] = val;
    }
  }

  const primaryFont = typography['_primary-font']
    || Object.entries(typography).find(([k]) => k.includes('family-body'))?.[1]
    || Object.entries(typography).find(([k]) => k.includes('family'))?.[1]
    || 'inherit';

  const headingFont = typography['_heading-font']
    || Object.entries(typography).find(([k]) => k.includes('family-heading'))?.[1]
    || primaryFont;

  return (
    <section className="preview-section">
      <h3>Typography</h3>

      <div className="type-specimens">
        <div className="type-specimen" style={{ fontFamily: headingFont }}>
          <span className="type-specimen__label">Heading</span>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>
            The quick brown fox
          </p>
          <code>{headingFont}</code>
        </div>

        <div className="type-specimen" style={{ fontFamily: primaryFont }}>
          <span className="type-specimen__label">Body</span>
          <p style={{ fontSize: '1rem', margin: 0 }}>
            The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
          </p>
          <code>{primaryFont}</code>
        </div>

        {Object.keys(sizes).length > 0 && (
          <div className="type-scale">
            <span className="type-specimen__label">Scale</span>
            {Object.entries(sizes).map(([name, val]) => (
              <div key={name} className="type-scale__step" style={{ fontSize: val, fontFamily: primaryFont }}>
                <code>--{name}: {val}</code>
                <span style={{ fontSize: val }}>Aa</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
