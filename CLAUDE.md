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

### Frontend

- **`src/routes/index.tsx`** — Main page: React Flow canvas + ChatPanel overlay
- **`src/components/ChatPanel.tsx`** — Sticky top-left overlay with messages, artifact cards, model/effort selectors, streaming status indicator, collapsible thinking blocks
- **`src/components/ArtifactNode.tsx`** — React Flow node: renders `.html` (iframe), `.md` (react-markdown), other (code view)
- **`src/hooks/useChat.ts`** — Streams SSE from server function, manages messages/artifacts/status, persists to IndexedDB via `src/lib/storage.ts`
- **`src/hooks/useCanvasNodes.ts`** — React Flow node state, open/close artifacts, persists to IndexedDB
- **`src/lib/storage.ts`** — IndexedDB key-value helper (`idbGet`, `idbSet`, `idbDelete`)

### Data Flow

Artifact content is streamed directly from the server to the client — the app never reads from the filesystem. The server intercepts claude CLI's `Write`/`Edit` tool_use events, maintains file contents in-memory, and sends full content via SSE. The client renders content inline (srcDoc for HTML, react-markdown for .md) and uses blob URLs for "open in new tab" / download. The `output/` directory is only used as a scratch space for the claude CLI subprocess and is cleaned on each request.

### Skill Integration

The app works with a sibling `ui-design-system` skill directory at `../ui-design-system/`. The server function passes it to claude via `--add-dir`. The system prompt instructs claude to use `/ui-design-system` for design work.

## Code Style

- Prettier: no semicolons, single quotes, trailing commas
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`
- Path alias: `#/*` maps to `src/*`
- Route tree (`src/routeTree.gen.ts`) is auto-generated — do not edit
