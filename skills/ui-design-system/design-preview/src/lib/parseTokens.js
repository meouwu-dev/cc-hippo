/**
 * Parse design tokens from the streamed markdown response.
 * Looks for CSS custom properties in :root {} blocks and
 * structured design information.
 */
export function parseDesignTokens(markdown) {
  if (!markdown) return null

  const tokens = {
    colors: {},
    typography: {},
    spacing: {},
    radii: {},
    shadows: {},
    raw: null,
  }

  // Extract :root { ... } CSS custom properties
  const rootMatch = markdown.match(/:root\s*\{([^}]+)\}/s)
  if (rootMatch) {
    tokens.raw = rootMatch[0]
    const declarations = rootMatch[1]
    const propRegex = /--([\w-]+)\s*:\s*([^;]+);/g
    let match
    while ((match = propRegex.exec(declarations))) {
      const [, name, value] = match
      const val = value.trim()
      if (
        name.match(
          /color|bg|text|primary|secondary|accent|surface|border|success|warning|error|neutral/i,
        )
      ) {
        tokens.colors[name] = val
      } else if (
        name.match(
          /font|text|heading|body|size|weight|line-height|letter-spacing|family/i,
        )
      ) {
        tokens.typography[name] = val
      } else if (name.match(/space|gap|padding|margin/i)) {
        tokens.spacing[name] = val
      } else if (name.match(/radius|rounded/i)) {
        tokens.radii[name] = val
      } else if (name.match(/shadow|elevation/i)) {
        tokens.shadows[name] = val
      } else {
        // Fallback: try to categorize by value
        if (val.match(/^#|^rgb|^hsl/)) {
          tokens.colors[name] = val
        } else if (val.match(/px$|rem$|em$/)) {
          tokens.spacing[name] = val
        } else {
          tokens.colors[name] = val // default bucket
        }
      }
    }
  }

  // Extract font families mentioned in markdown (e.g., **Font:** Inter)
  const fontMatch = markdown.match(
    /\*\*(?:Primary\s+)?Font(?:.*?):\*\*\s*(.+)/i,
  )
  if (fontMatch) {
    tokens.typography['_primary-font'] = fontMatch[1].trim()
  }
  const headingFontMatch = markdown.match(
    /\*\*Heading\s+Font(?:.*?):\*\*\s*(.+)/i,
  )
  if (headingFontMatch) {
    tokens.typography['_heading-font'] = headingFontMatch[1].trim()
  }

  // Extract aesthetic direction
  const aestheticMatch = markdown.match(
    /\*\*Aesthetic(?:\s+Direction)?:\*\*\s*(.+)/i,
  )
  if (aestheticMatch) {
    tokens.aesthetic = aestheticMatch[1].trim()
  }

  const hasContent =
    Object.keys(tokens.colors).length > 0 ||
    Object.keys(tokens.typography).length > 0 ||
    Object.keys(tokens.spacing).length > 0

  return hasContent ? tokens : null
}
