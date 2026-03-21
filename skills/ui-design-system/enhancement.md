# UI Design System Skill — Enhancement Plan

## Context

This document captures a conversation about reviewing the `ui-design-system` skill and planning a major enhancement: a live preview app powered by the local Claude Code CLI.

---

## Skill Review

### What's Strong

**Clear separation of concerns.** The design-before-code philosophy is sound — producing a DESIGN.md spec that feeds into a `frontend-design` code-generation skill is a smart pipeline. Most AI-generated UIs look generic precisely because design decisions happen implicitly during coding rather than explicitly beforehand.

**The aesthetics library is excellent.** 20 well-characterized directions with concrete tokens (not vibes) is the most valuable part of this skill. The blending guidance (primary + accent) prevents the common failure mode of mixing aesthetics incoherently. The token specificity (exact `cubic-bezier` values, exact rgba shadows) is what makes this actionable rather than decorative.

**The template is implementation-ready.** CSS custom properties block, exact hex values, states for every screen — this bridges the gap between "design doc" and "something a developer can actually build from." The collapsible `<details>` structure is a nice touch for scanability.

### Issues to Address

1. **The skill may be too heavy for its trigger point.** The full output (7 steps, every screen specced with all states, full component library, animation catalog) is a LOT of document for what might be a user saying "design me a todo app." The "Scaling" section acknowledges this with quick/full/iterative modes, but it's buried. Should promote this decision to Step 1 — ask or infer the scope _before_ doing anything else.

2. **Screen specifications before any visual validation is risky.** The process is waterfall: understand product → pick aesthetic → build full design system → spec every screen → define components → animation → build guide. Should validate the aesthetic direction and color palette _before_ spending thousands of tokens speccing 8 screens in detail.

3. **The output path `/mnt/user-data/outputs/DESIGN.md` is Claude.ai-specific.** In Claude Code, that path doesn't exist. Should use the project's working directory or let the user decide.

4. **Missing: how to handle existing brand constraints.** Many real users already have a brand color, a logo, an existing product. The skill assumes greenfield. Need a section on "if the user has existing brand assets, start from those and extend."

5. **The aesthetic library could use a "no aesthetic" option.** Sometimes the answer is "clean, professional, unremarkable UI" — internal tools, admin panels. A pragmatic default that says "just make it look competent" would cover a large chunk of use cases.

6. **Font verification is aspirational.** The model can't reliably verify Google Fonts exist without web access. Consider bundling a curated safe list per aesthetic, or dropping the verification claim.

### Recommended Process Change

Restructure to be checkpoint-based rather than waterfall:

1. Understand product → pick aesthetic → output a **mini preview** (palette + typography + one example component described)
2. User confirms direction
3. Full design system + screen specs

This prevents the most expensive failure mode: generating a 500-line DESIGN.md in the wrong aesthetic direction.

---

## Enhancement: Live Preview App (Stitch-like)

### Concept

A React app with a split-screen layout:

- **Left pane:** AI chat interface that calls the local `claude` CLI under the hood
- **Right pane:** Live design system preview that renders tokens as they're generated

The chat invokes the `ui-design-system` skill to generate design tokens, which render live in the preview pane. Similar to Google Stitch's DESIGN.md preview experience.

### Architecture

```
┌─────────────────────────────────────────────────┐
│  React App (Vite)                               │
│  ┌──────────────┐  ┌─────────────────────────┐  │
│  │   Chat Pane  │  │    Design Preview Pane   │  │
│  │              │  │                          │  │
│  │  User: "make │  │  ┌─ Palette ──────────┐  │  │
│  │  a cozy      │  │  │ ██ ██ ██ ██ ██     │  │  │
│  │  recipe app" │  │  ├─ Typography ───────┤  │  │
│  │              │  │  │ Aa Heading         │  │  │
│  │  AI: "I've   │  │  │ Aa Body text       │  │  │
│  │  designed…"  │  │  ├─ Components ───────┤  │  │
│  │              │  │  │ [Button] [Card]     │  │  │
│  │  [input___]  │  │  └────────────────────┘  │  │
│  └──────────────┘  └─────────────────────────┘  │
│                                                  │
│  Node Backend (Express)                          │
│  └─ spawns: claude -p "..." --allowedTools ...   │
│     └─ streams response back via SSE             │
│     └─ parses design tokens from output          │
└──────────────────────────────────────────────────┘
```

### How It Works

1. User types in chat → backend spawns `claude -p` with the ui-design-system skill
2. Response streams back to chat pane via SSE (Server-Sent Events)
3. As tokens/DESIGN.md content appears in the stream, the app parses out the CSS custom properties and design decisions
4. Preview pane updates live with the extracted tokens — swatches, type scale, sample components

### Open Questions

1. **Monorepo or separate?** Should this live inside the `ui-design-system` skill folder (as a `preview-app/` subdirectory), or as a separate sibling project?

2. **Claude CLI invocation** — Planning to use `claude -p "prompt" -s "path/to/SKILL.md"` to pass the skill as a system prompt. Need to confirm how skills are being invoked (CLI flag vs `claude skill add`).

3. **Preview scope for v1:**
   - Color palette swatches
   - Typography scale with live Google Fonts
   - Spacing/radius visualizer
   - Sample components (button, card, input) styled with the tokens
   - Full screen layout mockups deferred to v2

### Tech Stack

- **Frontend:** Vite + React
- **Backend:** Express (Node)
- **CLI integration:** Spawns `claude -p` as child process, streams stdout
- **Communication:** SSE for streaming responses to frontend
- **Token parsing:** Extract `:root { ... }` CSS custom properties block from streamed markdown
