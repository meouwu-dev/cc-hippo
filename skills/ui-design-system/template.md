# DESIGN.md Output Template

This is the canonical structure for every design system document produced by this skill. Follow this structure exactly, adapting section depth to the complexity of the project. Every section is required unless marked (optional).

---

## Template Structure

````markdown
# [Product Name]

## Product Overview

**The Pitch:** One-sentence description of what the product does and why it exists.

**For:** Target user persona(s) — be specific about who they are and what they care about.

**Device:** Primary device context (desktop / mobile / tablet / responsive / all).

**Design Direction:** [Primary Aesthetic] + [Secondary Aesthetic if blended]. One sentence describing the overall feel.

**Inspired by:** 2-4 real products or brands whose visual language is a reference point.

---

## Screens

Bulleted list of every screen/view in the application, with a short description of purpose:

- **[Screen Name]:** [What the user does here]
- **[Screen Name]:** [What the user does here]
- ...

---

## Key Flows

For each major user journey, write a numbered step-by-step narrative. These flows anchor the design decisions — they show _how_ screens connect and _why_ components exist.

**[Flow Name]:** [One-line goal, e.g., "User wants to create a new project"]

1. User is on [Screen] → sees [what they see]
2. User [action] → [what happens visually]
3. [Continue until flow completes]

Repeat for each key flow. Typically 2-5 flows.

---

<details>
<summary>Design System</summary>

## Color Palette

Define every color with its semantic role. Use this exact format:

- **Primary:** `#hexval` ([Color Name]) - [Where/how it's used]
- **Secondary:** `#hexval` ([Color Name]) - [Where/how it's used]
- **Background:** `#hexval` ([Color Name]) - [Page/app background]
- **Surface:** `#hexval` ([Color Name]) - [Cards, modals, elevated containers]
- **Text:** `#hexval` ([Color Name]) - [Body text]
- **Text Secondary:** `#hexval` ([Color Name]) - [Muted/supporting text]
- **Muted:** `#hexval` ([Color Name]) - [Placeholders, borders, disabled]
- **Accent:** `#hexval` ([Color Name]) - [Hover states, highlights]
- **Success:** `#hexval` - [Positive feedback]
- **Warning:** `#hexval` - [Caution states]
- **Error:** `#hexval` - [Error/destructive states]

Add or remove semantic colors as the product requires. Every color must have a clear role.

## Typography

Define the type system with font family, weight, and size for each level:

- **Display:** `[Font]`, [weight], [size range] — [Where used]
- **Headings:** `[Font]`, [weight], [size range]
- **Body:** `[Font]`, [weight], [size]
- **Small text:** `[Font]`, [weight], [size]
- **Buttons/Labels:** `[Font]`, [weight], [size]
- **Monospace (if needed):** `[Font]`, [weight], [size]

**Style notes:** Describe any distinctive typographic treatments — letter-spacing, text-transform, line-height ratios, drop caps, etc.

## Spacing & Layout

- **Base unit:** [e.g., 4px or 8px]
- **Spacing scale:** [e.g., 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96]
- **Max content width:** [e.g., 1200px]
- **Grid:** [e.g., 12-column, 24px gutter]
- **Section padding:** [e.g., 64px vertical on desktop]

## Shape & Elevation

- **Border radius:** Describe the radius strategy — pill buttons? Rounded cards? Sharp edges? Give specific values.
- **Shadows:** Describe the shadow philosophy and provide 2-3 elevation levels with exact values.
- **Borders:** Describe when borders appear and their style (thickness, color, opacity).

## Design Tokens (CSS)

Provide a complete `:root` block with ALL tokens — colors, fonts, radii, shadows, spacing — as CSS custom properties. This is the machine-readable summary of everything above.

```css
:root {
  /* Colors */
  --color-primary: #...;
  --color-secondary: #...;
  --color-background: #...;
  --color-surface: #...;
  --color-text: #...;
  --color-text-secondary: #...;
  --color-muted: #...;
  --color-accent: #...;
  --color-success: #...;
  --color-warning: #...;
  --color-error: #...;

  /* Typography */
  --font-display: '...', ...;
  --font-heading: '...', ...;
  --font-body: '...', ...;

  /* Spacing */
  --space-xs: ...;
  --space-sm: ...;
  --space-md: ...;
  --space-lg: ...;
  --space-xl: ...;
  --space-2xl: ...;

  /* Shape */
  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;
  --radius-pill: ...;

  /* Elevation */
  --shadow-sm: ...;
  --shadow-md: ...;
  --shadow-lg: ...;
  --shadow-hover: ...;
}
```
````

</details>

---

<details>
<summary>Screen Specifications</summary>

For EACH screen listed in the Screens section, provide a specification block:

### [Screen Name]

**Purpose:** What is this screen's job? One clear sentence.

**Layout:** High-level spatial description — where elements sit, column structure, centering, sticky regions.

**Key Elements:**
Describe each visual element on the screen with enough precision that a developer can build it without guesswork:

- **[Element Name]:** [Dimensions], [colors], [typography], [radius], [shadow]. Describe how it looks.
- Repeat for all visible elements.

**States:**
Define each meaningful state the screen can be in:

- **Empty:** What the user sees before content exists.
- **Loading:** Skeleton/shimmer behavior.
- **Populated:** Default state with content.
- **Error:** How errors appear on this screen.
- (Add more states as needed — focused, hover, disabled, selected, etc.)

**Components:**
List reusable UI components visible on this screen. Describe each:

- **[Component Name]:** Appearance, dimensions, variants.

**Interactions:**
Describe every interactive behavior:

- **[Trigger] (e.g., Hover Card):** [What happens visually]
- **[Trigger] (e.g., Click Submit):** [What happens visually]

**Responsive (if applicable):**

- **Desktop:** [Layout behavior]
- **Tablet:** [Layout behavior]
- **Mobile:** [Layout behavior]

Repeat for each screen.

</details>

---

<details>
<summary>Component Library</summary>

For each reusable component, provide a specification:

### [Component Name]

**Variants:** [e.g., primary / secondary / ghost / danger]

**Anatomy:**

- [Sub-element]: [Appearance description]
- [Sub-element]: [Appearance description]

**Dimensions:** [Width, height, padding, icon size]

**States:**

- **Default:** [Appearance]
- **Hover:** [What changes]
- **Active/Pressed:** [What changes]
- **Focused:** [What changes — especially keyboard focus rings]
- **Disabled:** [What changes]

**Spacing rules:** [Margin between instances, gap from other elements]

Repeat for each component. Common components to specify:

- Button (+ variants)
- Input / Text Field
- Card
- Modal / Dialog
- Tag / Chip / Pill
- Navigation (top bar, sidebar, tabs)
- Toast / Notification
- Dropdown / Select
- Avatar
- Badge
- Tooltip

Only specify components the product actually uses.

</details>

---

<details>
<summary>Interaction & Animation System</summary>

## Motion Principles

Describe the overall motion philosophy in 2-3 sentences. Is motion bouncy? Restrained? Cinematic? Functional-only?

## Easing Curves

- **Default:** [e.g., `cubic-bezier(0.4, 0, 0.2, 1)` — standard material]
- **Enter:** [e.g., `cubic-bezier(0, 0, 0.2, 1)` — decelerate]
- **Exit:** [e.g., `cubic-bezier(0.4, 0, 1, 1)` — accelerate]
- **Bounce (if applicable):** [e.g., `cubic-bezier(0.34, 1.56, 0.64, 1)`]

## Duration Scale

- **Instant:** [e.g., 100ms — button state changes]
- **Quick:** [e.g., 200ms — hover effects, toggles]
- **Standard:** [e.g., 300ms — panel reveals, card transitions]
- **Slow:** [e.g., 500ms — page transitions, modal open/close]
- **Cinematic:** [e.g., 800-1200ms — hero reveals, loading sequences]

## Interaction Catalog

For each significant interaction pattern:

### [Interaction Name, e.g., "Card Hover Lift"]

- **Trigger:** [e.g., mouse enter on card]
- **Properties animated:** [e.g., transform, box-shadow]
- **From → To:** [e.g., `translateY(0) → translateY(-4px)`, shadow-md → shadow-hover]
- **Duration:** [e.g., 200ms]
- **Easing:** [e.g., default]

### [Interaction Name, e.g., "Modal Open"]

- **Trigger:** [e.g., click detail link]
- **Sequence:**
  1. Backdrop fades in (opacity 0→1, 200ms)
  2. Modal scales up (scale 0.95→1, 300ms, enter easing)
- **Reverse on close:** [yes/no, with any differences]

Repeat for each interaction.

## Scroll Behaviors (if applicable)

- **Sticky elements:** [What sticks and when]
- **Parallax:** [Which elements, speed ratios]
- **Scroll-triggered reveals:** [Animation type, trigger threshold]

## Loading Patterns

- **Skeleton screens:** [Shimmer direction, color, shape]
- **Spinners/Progress:** [Style, placement]
- **Content transitions:** [How content fades/slides in when loaded]

</details>

---

<details>
<summary>Build Guide</summary>

**Stack:** [Recommended technology stack — framework, CSS approach, key libraries]

**Build Order:**
Numbered list of which screens/components to build first and why. Order should minimize rework:

1. **[First thing]:** [Why this goes first]
2. **[Second thing]:** [Why this goes next]
3. Continue...

**Key Technical Notes:**
Any implementation-specific guidance:

- Font loading strategy
- Image/asset handling
- Accessibility requirements
- Performance considerations
- Third-party dependencies

</details>
```

---

## Section Depth Guidelines

Not every project needs the same level of detail:

**Small project (1-3 screens):** Product Overview, Design System, Screen Specifications, Build Guide. Skip Component Library and Interaction System unless the UI is interaction-heavy.

**Medium project (4-8 screens):** All sections. Component Library can be brief — focus on components that appear on 2+ screens.

**Large project (9+ screens):** All sections at full depth. Component Library should be comprehensive. Consider splitting Screen Specifications into logical groups.

## Writing Style

- Be precise with numbers — exact hex values, pixel dimensions, font weights. Vague descriptions like "a nice blue" or "rounded corners" are useless.
- Use the product's actual terminology, not generic labels.
- Write Screen Specifications as if briefing a developer who has never seen the product but is skilled enough to build it from your description alone.
- Collapsible `<details>` blocks keep the document scannable while preserving depth.
