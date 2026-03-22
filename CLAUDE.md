# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Design Preview** — a Claude-artifacts-style canvas app for UI design system work. Users describe designs in a chat panel, the app spawns the local `claude` CLI to generate files, and artifacts appear on an infinite canvas (React Flow). Built with TanStack Start (full-stack SSR React framework).

## Commands

```bash
npm run dev          # Dev server on port 3000, auto-opens browser
npm run build        # Production build (client + server)
npm run test         # Vitest
npm run check        # Prettier auto-fix + ESLint fix
```

## Architecture

### Server Function (`src/server/chat.ts`)

The core backend — a TanStack Start `createServerFn` that:

1. Receives chat message + history from the client
2. Spawns `claude` CLI with `--output-format stream-json`
3. Parses newline-delimited JSON events from stdout
4. Returns an SSE `ReadableStream` with event types: `text`, `thinking`, `file`, `status`, `heartbeat`, `done`, `error`

All Node.js imports (`child_process`, `fs`, `path`) **must** live inside the `.handler()` callback (dynamic imports). Top-level Node.js code breaks the client bundle since `createServerFn` modules are imported on both client and server.

**Claude CLI gotchas captured in requirement.md:**

- stdin MUST be `'ignore'` — otherwise claude hangs
- Do NOT use `--include-partial-messages` — causes extreme slowness
- Skip `result` events to avoid duplicate text
- Do NOT use `req.on('close')` to kill claude — Express 5 fires close immediately

### MCP Server (`src/mcp/server.ts`)

An MCP (Model Context Protocol) server that gives the claude CLI tools to control the canvas. Spawned as a subprocess via `npx tsx`, configured through `--mcp-config`. Tools:

- **`saveArtifact`** — Pre-registers artifact metadata (type, devicePreset, x, y) BEFORE the file is written, so the node spawns at the correct position/size
- **`calcPosition`** — Server-side math helper: AI says "below design.md" or "right of login.html", tool returns exact x,y coordinates. Exists because LLMs are bad at arithmetic.
- **`moveArtifact`** — Repositions an existing node on the canvas
- **`getArtifacts`** — Returns all artifacts with position, size, device preset
- **`linkArtifacts`** — Creates directional relationships (edges) between artifacts
- **`askUser`** — Presents questions with clickable options to the user
- **`listPages`** / **`createPage`** / **`renamePage`** / **`switchPage`** — Page management

### Database (`src/mcp/db.ts`)

SQLite (better-sqlite3) at `data/app.db`. Tables: projects, conversations, pages, artifacts (with position_x, position_y, width, height, device_preset), edges, sections, chat_messages, app_state.

### Frontend

- **`src/routes/index.tsx`** — Main page: React Flow canvas + ChatPanel overlay
- **`src/components/ChatPanel.tsx`** — Sticky top-left overlay with messages, artifact cards, model/effort selectors, streaming status indicator, collapsible thinking blocks
- **`src/components/ArtifactNode.tsx`** — React Flow node: renders `.html` (iframe), `.md` (react-markdown), other (code view)
- **`src/hooks/useChat.ts`** — Streams SSE from server function, manages messages/artifacts/status, routes MCP events (devicePreset, moveArtifact) to callbacks
- **`src/hooks/useCanvasNodes.ts`** — React Flow node state, open/close artifacts, `plannedLayoutRef` for pre-planned positions from AI
- **`src/lib/storage.ts`** — IndexedDB key-value helper (`idbGet`, `idbSet`, `idbDelete`)

### Data Flow

Artifact content is streamed directly from the server to the client — the app never reads from the filesystem. The server intercepts claude CLI's `Write`/`Edit` tool_use events, maintains file contents in-memory, and sends full content via SSE. The client renders content inline (srcDoc for HTML, react-markdown for .md) and uses blob URLs for "open in new tab" / download. The `output/` directory is only used as a scratch space for the claude CLI subprocess and is cleaned on each request.

**Node spawn lifecycle — critical ordering:**
1. AI calls `calcPosition` → server returns x, y coordinates
2. AI calls `saveArtifact` (with type, devicePreset, x, y) → server emits `devicePreset` + `moveArtifact` SSE → client buffers in `plannedLayoutRef`
3. AI calls `Write` → server emits `file` SSE → `openArtifact` checks `plannedLayoutRef` → node spawns at pre-registered position/size
4. If no pre-planned layout exists, falls back to auto-layout (place right of rightmost node)

Nodes spawn on `Write`, NOT on `saveArtifact`. The `saveArtifact` → `Write` order is critical to avoid nodes spawning at wrong positions then jumping.

### Skill Integration

The app works with a `ui-design-system` skill directory at `skills/ui-design-system/`. The server function passes it to claude via `--add-dir`. The system prompt instructs claude to use `/ui-design-system` for design work.

## Code Style

- Prettier: no semicolons, single quotes, trailing commas
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`
- Path alias: `#/*` maps to `src/*`
- Route tree (`src/routeTree.gen.ts`) is auto-generated — do not edit
