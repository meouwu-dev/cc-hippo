/**
 * Build downloadable design system files from chat messages and tokens.
 */

function triggerDownload(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Download the full AI response as DESIGN.md */
export function downloadDesignMd(messages) {
  // Find the last assistant message (the full design output)
  const assistantMsgs = messages.filter(
    (m) => m.role === 'assistant' && m.content,
  )
  if (!assistantMsgs.length) return
  const content = assistantMsgs.map((m) => m.content).join('\n\n---\n\n')
  triggerDownload('DESIGN.md', content)
}

/** Download extracted CSS custom properties as a CSS file */
export function downloadTokensCSS(tokens) {
  if (!tokens) return

  let css = '/* Design System Tokens — auto-extracted */\n\n'

  if (tokens.raw) {
    css += tokens.raw + '\n'
  } else {
    // Build from parsed tokens
    const allTokens = {
      ...tokens.colors,
      ...tokens.typography,
      ...tokens.spacing,
      ...tokens.radii,
      ...tokens.shadows,
    }
    // Remove internal keys (prefixed with _)
    const entries = Object.entries(allTokens).filter(
      ([k]) => !k.startsWith('_'),
    )
    if (!entries.length) return

    css += ':root {\n'
    for (const [name, value] of entries) {
      css += `  --${name}: ${value};\n`
    }
    css += '}\n'
  }

  triggerDownload('design-tokens.css', css, 'text/css')
}

/** Download tokens as JSON */
export function downloadTokensJSON(tokens) {
  if (!tokens) return
  const clean = { ...tokens }
  delete clean.raw
  // Remove internal keys
  for (const group of ['typography']) {
    if (clean[group]) {
      clean[group] = Object.fromEntries(
        Object.entries(clean[group]).filter(([k]) => !k.startsWith('_')),
      )
    }
  }
  triggerDownload(
    'design-tokens.json',
    JSON.stringify(clean, null, 2),
    'application/json',
  )
}
