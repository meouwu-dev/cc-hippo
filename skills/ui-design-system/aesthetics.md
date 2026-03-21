# Aesthetic Direction Reference Library

This file contains a curated catalog of design aesthetics. Each entry defines the *feeling* of the direction plus its characteristic design tokens. Use these as starting points — blend, remix, and adapt them to the product's context. Never copy them verbatim; every product deserves a tailored system.

## Table of Contents
1. Kawaii Minimalist
2. Brutalist / Raw
3. Glassmorphism
4. Neo-Brutalism (Figma-era)
5. Editorial / Magazine
6. Retro-Futurism / Cyberpunk
7. Organic / Nature
8. Luxury / Refined
9. Playful / Toy-like
10. Soft UI (Neumorphism)
11. Vaporwave / Retrowave
12. Swiss / International Style
13. Claymorphism
14. Dark Mode Elegance
15. Maximalist Chaos
16. Scandinavian Minimal
17. Art Deco / Geometric
18. Y2K Revival
19. Paper / Stationery
20. Terminal / Hacker

---

## 1. Kawaii Minimalist
**Feeling:** Effortlessly cute, soft, approachable. Like a well-designed Japanese stationery product.
**When to use:** Consumer apps aimed at younger audiences, creative tools, fan communities, lifestyle apps.
- **Palette:** Pastel pinks, sky blues, lavenders, mint greens on snow-white backgrounds. Never saturated.
- **Typography:** Rounded sans-serifs (Nunito, Quicksand, Varela Round). Heavy weights for headings, medium for body.
- **Radius:** Maximum roundness — `999px` for pills/buttons, `16-24px` for cards.
- **Shadows:** Deeply blurred, tinted with palette colors (e.g. `0 12px 32px rgba(255,183,197,0.15)`). Zero harsh lines.
- **Motion:** Bouncy spring easings, subtle scale-on-hover, gentle float animations.
- **Signature detail:** Tinted shadows that match the element's accent color.

## 2. Brutalist / Raw
**Feeling:** Unapologetically honest. Raw structure exposed. Anti-polish as a deliberate aesthetic choice.
**When to use:** Art portfolios, experimental projects, dev tools that embrace rawness, counterculture brands.
- **Palette:** Black, white, one or two screaming accent colors (electric yellow, hot red). High contrast.
- **Typography:** Monospace or grotesque sans-serifs (Space Mono, IBM Plex Mono, Helvetica Neue). Mixed sizes aggressively.
- **Radius:** `0px` everywhere. Sharp corners are the point.
- **Shadows:** None, or extremely hard (`4px 4px 0 #000`). No blur.
- **Borders:** Thick, visible (`2-4px solid black`). Borders ARE the design.
- **Motion:** Minimal or jarring — instant state changes, no easing.
- **Signature detail:** Visible grid lines, exposed structure, monospace everything.

## 3. Glassmorphism
**Feeling:** Layered, translucent, depth without weight. Like frosted glass panels floating over a rich background.
**When to use:** Dashboards, media apps, overlay-heavy UIs, anything that benefits from layered depth.
- **Palette:** Translucent whites/darks over vibrant gradient backgrounds. Surface colors use `rgba` with 0.1-0.3 alpha.
- **Typography:** Clean geometric sans-serifs (Inter, SF Pro, Outfit). Light to medium weights.
- **Radius:** `12-20px`. Rounded but not pill-shaped.
- **Shadows:** Large, soft, layered (`0 8px 32px rgba(0,0,0,0.1)`).
- **Backdrop:** `backdrop-filter: blur(16-24px)` on surfaces. This is the defining feature.
- **Borders:** `1px solid rgba(255,255,255,0.18)` — the subtle light edge.
- **Motion:** Smooth parallax, fade-through transitions, gentle depth shifts.
- **Signature detail:** The frosted-glass surface with a luminous border edge.

## 4. Neo-Brutalism (Figma-era)
**Feeling:** Bold, confident, graphic. Like a modern poster — thick outlines, solid fills, punchy colors. Not the same as classic Brutalism.
**When to use:** SaaS landing pages, productivity tools, startup marketing sites, educational platforms.
- **Palette:** Saturated primaries and secondaries (bold yellow, coral, electric blue) on off-white or light cream.
- **Typography:** Bold grotesque sans-serifs (Satoshi, General Sans, DM Sans). Very heavy headings (800-900).
- **Radius:** `8-16px` — rounded but still blocky. Not pills.
- **Shadows:** Hard offset shadows with no blur (`4px 4px 0 #1a1a1a` or `6px 6px 0 <accent-color>`).
- **Borders:** Thick (`2-3px solid #1a1a1a`). Every interactive element is outlined.
- **Motion:** Snappy, 100-200ms transitions. Offset shadows shift on hover.
- **Signature detail:** The hard-offset colored drop shadow.

## 5. Editorial / Magazine
**Feeling:** Sophisticated, content-first, typographically rich. Like a well-designed print publication on screen.
**When to use:** Blogs, news sites, portfolios, content-heavy platforms, brand storytelling.
- **Palette:** Restrained — cream/off-white backgrounds, black text, one distinguished accent (burgundy, navy, forest green).
- **Typography:** Serif headings (Playfair Display, Fraunces, Lora) paired with clean sans-serif body (Source Sans, Libre Franklin). Large type scale ratios (48-72px headings).
- **Radius:** `0-4px`. Minimal rounding. Sharpness conveys editorial authority.
- **Shadows:** Barely present. Depth comes from typography scale and whitespace, not elevation.
- **Layout:** Asymmetric grids, generous margins, pull quotes, drop caps, full-bleed images.
- **Motion:** Subtle — smooth scroll reveals, gentle fade-ins. Nothing flashy.
- **Signature detail:** Dramatic type scale contrast and generous whitespace.

## 6. Retro-Futurism / Cyberpunk
**Feeling:** Neon-soaked futures imagined from the past. High-tech, dystopian chic, digital rain.
**When to use:** Gaming platforms, tech showcases, music apps, sci-fi themed products.
- **Palette:** Deep darks (#0a0a0f, #1a1a2e) with neon accents (cyan #00f0ff, magenta #ff00aa, electric green #39ff14).
- **Typography:** Geometric or condensed sans-serifs (Orbitron, Rajdhani, Exo 2). Monospace for data (JetBrains Mono).
- **Radius:** `2-8px`. Slightly rounded, technical feel.
- **Shadows:** Neon glows (`0 0 20px rgba(0,240,255,0.5), 0 0 60px rgba(0,240,255,0.2)`).
- **Borders:** `1px solid` neon colors at reduced opacity. Scanline effects.
- **Motion:** Glitch effects, typing animations, flickering glows, smooth data transitions.
- **Signature detail:** Layered neon glow shadows on key elements.

## 7. Organic / Nature
**Feeling:** Warm, grounded, alive. Inspired by natural forms — wood, leaves, water, earth.
**When to use:** Wellness apps, sustainability brands, food/agriculture, outdoor/travel.
- **Palette:** Earth tones — warm browns, sage greens, terracotta, cream, stone grey. Muted, never electric.
- **Typography:** Humanist sans-serifs (Lato, Cabin, Fira Sans) or warm serifs (Bitter, Merriweather). Organic letter shapes.
- **Radius:** `12-20px`. Soft, natural curves. Occasionally irregular/blob shapes via SVG.
- **Shadows:** Warm-tinted, soft (`0 8px 24px rgba(139,90,43,0.08)`).
- **Texture:** Subtle grain, paper textures, watercolor washes, leaf/botanical illustrations.
- **Motion:** Slow, breathing animations. Gentle parallax. Growth/bloom metaphors.
- **Signature detail:** Organic blob shapes and warm-tinted textures.

## 8. Luxury / Refined
**Feeling:** Understated opulence. Every pixel is considered. Space is the ultimate luxury.
**When to use:** Fashion brands, premium products, high-end services, exclusive platforms.
- **Palette:** Near-black backgrounds (#0c0c0c), warm whites (#f5f0eb), gold/champagne accents (#c9a96e). Minimal color.
- **Typography:** Elegant serifs (Cormorant, Bodoni Moda) for headlines, refined sans (Montserrat light, Jost) for body. Extreme letter-spacing on headings.
- **Radius:** `0-2px`. Sharp edges convey precision.
- **Shadows:** Nearly invisible or none. Depth from layering and spacing.
- **Layout:** Extreme whitespace. Elements breathe. Asymmetric compositions.
- **Motion:** Slow, deliberate (600-1000ms). Cinematic reveals. Smooth parallax.
- **Signature detail:** Ultra-wide letter-spacing, extreme whitespace, gold accents.

## 9. Playful / Toy-like
**Feeling:** Pure joy. Chunky, tactile, like a well-designed toy or children's app. Not childish — joyful.
**When to use:** Family apps, games, educational tools, creative platforms, team collaboration.
- **Palette:** Saturated but friendly — not neon. Primary colors with a twist (warm yellow, poppy red, sky blue).
- **Typography:** Chubby rounded fonts (Baloo, Fredoka, Bubblegum Sans) for headlines. Clean rounded body (Nunito, Poppins).
- **Radius:** `16-24px` for cards, `999px` for buttons. Everything bulbous and touchable.
- **Shadows:** Chunky, slightly colored (`0 6px 0 <darker-shade>` for emboss effect).
- **Borders:** Thick, rounded, sometimes dashed or dotted for decoration.
- **Motion:** Springy, elastic. Overshoot easings. Wobble on interaction. Confetti on success.
- **Signature detail:** The chunky emboss shadow that makes elements feel physically pressable.

## 10. Soft UI (Neumorphism)
**Feeling:** Extruded from the surface itself. Soft, monochromatic, tactile. Elements pushed out of or into the background.
**When to use:** Smart home controls, music players, calculator-type tools, settings panels.
- **Palette:** Monochromatic — one background hue (light grey #e0e5ec or soft color). Elements are the SAME color as background.
- **Typography:** Clean, geometric sans (Inter, Rubik, Outfit). Medium weight.
- **Radius:** `12-20px`. Smooth, extruded feel.
- **Shadows:** The defining feature — dual shadows: light source top-left (`-6px -6px 14px rgba(255,255,255,0.7)`) + shadow bottom-right (`6px 6px 14px rgba(163,177,198,0.5)`).
- **States:** Pressed state inverts shadows to `inset`. This creates the push/pull physicality.
- **Motion:** Subtle depth transitions. Slow shadow shifts.
- **Signature detail:** Dual opposing shadows creating the illusion of physical extrusion.

## 11. Vaporwave / Retrowave
**Feeling:** 80s/90s nostalgia filtered through irony. Sunset gradients, Greek statues, chrome text, lo-fi luxury.
**When to use:** Music platforms, creative/art tools, nostalgic brands, entertainment apps.
- **Palette:** Pink-to-cyan gradients, hot pink (#ff71ce), electric purple (#b967ff), aqua (#01cdfe), sunset orange.
- **Typography:** Retro display (Press Start 2P, VT323, Monoton) for accents. Clean sans for readability.
- **Radius:** Mixed — `0px` for retro sharpness, `999px` for pill-shaped accents.
- **Shadows:** Colorful neon glows on dark backgrounds. Chrome-like gradient text.
- **Texture:** Scanlines, CRT noise, dithering patterns, lo-fi grain.
- **Motion:** Slow horizontal scrolls, VHS-tracking wobble, fade-and-scale reveals.
- **Signature detail:** Horizontal stripe/scanline overlays and sunset gradient backgrounds.

## 12. Swiss / International Style
**Feeling:** Order, clarity, function. The grid is sacred. Information hierarchy is everything.
**When to use:** Data-heavy dashboards, enterprise tools, documentation sites, government/institutional.
- **Palette:** White background, black text, one functional accent (red, blue). Zero decoration.
- **Typography:** Grotesque sans-serifs (Helvetica Neue, Univers, Akkurat). Strict type scale. Bold for hierarchy, not color.
- **Radius:** `0-4px`. Geometric precision.
- **Shadows:** None. Depth from borders and background fills.
- **Layout:** Strict grid systems. Mathematical spacing (4px/8px base). Alignment is absolute.
- **Motion:** Functional only — loading states, reveals. Never decorative.
- **Signature detail:** Rigid grid adherence and typographic hierarchy doing ALL the visual work.

## 13. Claymorphism
**Feeling:** 3D, puffy, rendered. Like UI elements are made of soft clay or inflated rubber.
**When to use:** Fintech apps, onboarding flows, modern consumer apps, gamified interfaces.
- **Palette:** Soft pastels or warm neutrals. Background often gradient. Surface colors slightly lighter than background.
- **Typography:** Rounded, friendly (Nunito, Poppins, Quicksand). Medium to bold.
- **Radius:** `16-24px`. Puffy, inflated feel.
- **Shadows:** Two-layer: outer shadow for depth + inner highlight for the "inflate" effect. `inset 0 -4px 8px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.08)`.
- **Borders:** None or very subtle. Shape is defined by shadow.
- **Motion:** Squish on press (scale 0.95), bounce back (spring easing).
- **Signature detail:** The inset bottom shadow combined with outer shadow creating the puffy 3D look.

## 14. Dark Mode Elegance
**Feeling:** Sophisticated, restful, premium. Not just "colors inverted" — intentionally designed for dark surfaces.
**When to use:** Developer tools, media players, evening-use apps, pro creative tools, crypto/finance.
- **Palette:** Layered greys (surface: #1a1a1a, card: #242424, elevated: #2d2d2d). Text: #e5e5e5 (never pure white). One jewel-tone accent (emerald, sapphire, amber).
- **Typography:** Clean geometric (Inter, Plus Jakarta Sans, Geist). Light-to-medium weights for body (heavy text on dark = visual noise).
- **Radius:** `8-16px`. Moderate, professional.
- **Shadows:** Very subtle or none. Depth via background-color layering, not shadows (shadows are invisible on dark).
- **Borders:** `1px solid rgba(255,255,255,0.06-0.12)` — extremely subtle dividers.
- **Motion:** Smooth, 200-300ms. Subtle opacity and scale changes. Restrained.
- **Signature detail:** Hierarchical surface layering (each z-level = slightly lighter grey).

## 15. Maximalist Chaos
**Feeling:** More is more. Every surface alive. Controlled explosion of pattern, color, type, and imagery.
**When to use:** Festival/event sites, creative agencies, fashion, art platforms, bold brand campaigns.
- **Palette:** Clashing-on-purpose. 4-6 strong colors used simultaneously. Background is never plain.
- **Typography:** Multiple typefaces (3-4). Mixed sizes wildly. Rotated, overlapping, outlined text.
- **Radius:** Mixed deliberately — sharp and rounded in the same view.
- **Shadows:** Colorful, multiple, layered. Decorative, not functional.
- **Layout:** Overlapping elements, broken grids, rotated cards, text wrapping around irregular shapes.
- **Motion:** Constant — hover reveals, scroll-triggered animations, auto-playing loops.
- **Signature detail:** Deliberate visual collision — elements overlapping, rotating, and competing for attention as a conscious design choice.

## 16. Scandinavian Minimal
**Feeling:** Warm minimalism. Clean but cozy. Function-first with human warmth.
**When to use:** Productivity tools, e-commerce (home goods, lifestyle), health/wellness, note-taking apps.
- **Palette:** Warm neutrals — off-white (#faf8f5), warm grey (#8c8c8c), charcoal (#333). One muted accent (dusty blue, sage, terracotta).
- **Typography:** Friendly geometric sans (DM Sans, Outfit, General Sans). Regular to medium weight. Generous line-height.
- **Radius:** `8-12px`. Soft but not cute.
- **Shadows:** Extremely subtle (`0 2px 8px rgba(0,0,0,0.04)`). Barely there.
- **Layout:** Generous whitespace, clear hierarchy, functional grid. Nothing decorative that doesn't serve a purpose.
- **Motion:** Minimal, 150-250ms. Functional transitions only.
- **Signature detail:** Warm color temperature (no cool greys) combined with extreme restraint.

## 17. Art Deco / Geometric
**Feeling:** Glamorous precision. Symmetry, metallic accents, geometric patterns, Gatsby-era opulence.
**When to use:** Luxury events, cocktail/dining apps, awards ceremonies, premium memberships, music venues.
- **Palette:** Rich darks (navy #1a1a3e, black #0d0d0d) with metallic golds (#d4af37, #c9b037). Jewel accents (emerald, ruby).
- **Typography:** Geometric display faces (Poiret One, Josefin Sans, Italiana). All-caps with wide letter-spacing for headlines.
- **Radius:** `0px`. Sharp, geometric precision. Occasional octagonal or diamond shapes.
- **Shadows:** Gold-tinted glows for emphasis. Otherwise minimal.
- **Borders:** Thin gold lines (`1px solid #d4af37`). Decorative geometric border patterns.
- **Texture:** Geometric repeat patterns (chevrons, sunbursts, fan shapes). Metallic gradients.
- **Motion:** Elegant reveals, symmetrical animations, border-drawing effects.
- **Signature detail:** Gold geometric line patterns and symmetrical compositions.

## 18. Y2K Revival
**Feeling:** Early-internet optimism meets chrome. Bubbly 3D, gradients, pixel art, translucency, "the future" as seen from 2001.
**When to use:** Gen-Z consumer apps, social platforms, music/culture, trendy brand campaigns.
- **Palette:** Silver/chrome (#c0c0c0), bubblegum pink (#ff69b4), sky blue (#87ceeb), lime (#32cd32). Lots of gradients.
- **Typography:** Pixel fonts for accents (Silkscreen, Press Start 2P). Futuristic sans for body (Exo 2, Orbitron at light weight).
- **Radius:** `16-999px`. Bubbly, inflated shapes.
- **Shadows:** Glossy highlights (white gradient overlays). Chrome/metallic reflections.
- **Texture:** Lens flares, chrome spheres, translucent colored panels, sticker-like elements.
- **Motion:** Morphing shapes, spinning 3D objects, cursor trails, bouncy hover states.
- **Signature detail:** Glossy chrome textures and bubblegum-colored translucent panels.

## 19. Paper / Stationery
**Feeling:** Analog warmth on digital canvas. Handcrafted, personal, like a beloved notebook.
**When to use:** Note-taking apps, journaling, personal planners, recipe apps, invitation/greeting platforms.
- **Palette:** Paper tones (cream #faf4e8, aged white #f5f1e8). Ink colors (navy #2c3e50, brown #5d4e37). Pencil grey.
- **Typography:** Handwriting fonts for accents (Caveat, Patrick Hand). Clean serif for body (Literata, Source Serif).
- **Radius:** `4-8px`. Slightly rounded, like cut paper corners.
- **Shadows:** Subtle lift shadows suggesting paper elevation (`0 2px 8px rgba(0,0,0,0.06)`).
- **Texture:** Paper grain backgrounds, torn-edge dividers, subtle ruled lines, tape/pin decorations.
- **Borders:** Dashed or dotted. Pencil-line aesthetic.
- **Motion:** Page-turn transitions, stamp/seal effects, writing/drawing animations.
- **Signature detail:** Paper-textured backgrounds with ruled/dotted lines.

## 20. Terminal / Hacker
**Feeling:** Raw power. Monospace everything. The aesthetic of someone who lives in the command line.
**When to use:** Dev tools, CLI wrappers, monitoring dashboards, cybersecurity, technical audiences.
- **Palette:** Dark backgrounds (#0d1117, #1e1e2e). Green (#00ff41) or amber (#ffb000) text. Matrix-inspired.
- **Typography:** Monospace only (JetBrains Mono, Fira Code, IBM Plex Mono). Fixed widths. Syntax highlighting colors.
- **Radius:** `0-4px`. Sharp, technical.
- **Shadows:** None, or subtle terminal glow (`0 0 10px rgba(0,255,65,0.1)`).
- **Borders:** `1px solid` muted color. ASCII box-drawing characters for decoration.
- **Layout:** Single-column or split-pane. Dense information. Blinking cursors.
- **Motion:** Typing/typewriter animations, scrolling logs, cursor blink, matrix rain for loading.
- **Signature detail:** Blinking cursor, monospace type, and terminal-green-on-black palette.

---

## Blending Aesthetics

Rarely will a product fit one direction perfectly. Blending is encouraged:
- **Kawaii + Glassmorphism** → Frosted pastel panels with bouncy interactions
- **Swiss + Dark Mode** → Rigorous grid on dark layered surfaces
- **Neo-Brutalism + Playful** → Chunky outlined elements with saturated toy colors
- **Editorial + Luxury** → Serif-heavy, extreme whitespace, restrained gold accents
- **Terminal + Cyberpunk** → Neon-glowing monospace on deep dark with scanlines

When blending, pick one direction as PRIMARY (drives layout + typography) and one as ACCENT (contributes color palette + texture/detail).
