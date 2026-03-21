Here's the handover prompt:

---

## Prompt: Build "Design Preview" — A Claude-Artifacts-Style Canvas App for UI Design Systems

### What To Build

A local web app (Vite + React + Express) that provides a **Claude web artifacts-like experience** on an **infinite canvas**, focused on UI design system work. It spawns the local `claude` CLI to generate design artifacts.

### Architecture

```
┌─────────────────────────────────────────────────┐
│  React App (Vite)                               │
│                                                 │
│  ┌─ Chat Panel (sticky top-left overlay) ─────┐ │
│  │ Conversation + inline artifact cards       │ │
│  │ Model selector (opus/sonnet/haiku)         │ │
│  │ Effort selector (low/medium/high/max)      │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Infinite Canvas (React Flow) ─────────────┐ │
│  │                                            │ │
│  │  [📄 DESIGN.md]    [📄 index.html]        │ │
│  │  (rendered md)      (iframe preview)       │ │
│  │                                            │ │
│  │  [📄 tokens.css]                           │ │
│  │  (code view)                               │ │
│  │                                            │ │
│  │  Pan/zoom/drag/resize nodes                │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  Express Backend (port 3002)                    │
│  ├─ POST /api/chat → spawns claude CLI, SSE    │
│  └─ GET /output/** → serves generated files    │
└─────────────────────────────────────────────────┘
```

### Core Concepts

**Chat Panel** — The only place showing conversation. Sticky overlay, top-left, collapsible, resizable (CSS `resize: vertical`, no visible handle — cursor change only). When the AI writes files to `output/`, an **artifact card** appears inline in the chat showing the filename. Clicking the card opens/focuses the artifact on the canvas.

**Canvas** — Infinite pannable/zoomable canvas (`@xyflow/react`). Shows **opened artifacts only** — no conversation text. Nodes are draggable (by title bar only) and resizable (invisible handles, cursor-only). Node body allows text selection and scrolling (use `nowheel nodrag nopan` classes).

**Artifacts** — Any file the AI writes to `output/`. Rendering by file type:

- `.md` → rendered markdown (`react-markdown`)
- `.html` → iframe preview (served from `/output/`)
- `.css` / `.js` / other text → code view with syntax highlighting

### Backend: Express Server

```
POST /api/chat
  Body: { message, history, model?, effort? }
  Response: SSE stream with events:
    - { type: "text", content: "..." }        ← AI response text (append to chat)
    - { type: "file", url, path, filename }   ← artifact created
    - { type: "status", event: "..." }        ← tool use activity hint
    - { type: "heartbeat" }                   ← keep-alive every 5s
    - { type: "done", code, signal }          ← stream ended

GET /output/**  → express.static serving the output directory
```

**Claude CLI invocation:**

```js
spawn(
  "claude",
  [
    "-p",
    prompt,
    "--add-dir",
    skillDir, // parent dir with .skill file
    "--add-dir",
    outputDir, // output/ directory
    "--output-format",
    "stream-json",
    "--allowedTools",
    "Edit Write Read Glob Grep Bash(mkdir:*) Bash(ls:*)",
    "--model",
    model, // if provided
    "--effort",
    effort, // if provided
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
```

**Important CLI details learned from debugging:**

- stdin MUST be `'ignore'` — otherwise claude waits for stdin and outputs nothing
- `stream-json` emits `assistant` events with `message.content[]` array of content blocks — extract text from `block.type === 'text'` blocks via `block.text`
- `result` event contains the same full text — skip it to avoid duplicates
- Do NOT use `--include-partial-messages` — causes extreme slowness (5min+ to first response)
- Do NOT use `req.on('close')` to kill the claude process — Express 5 fires `close` immediately after request body is read, killing claude before it responds. If cleanup is needed, track a `claudeDone` flag from `claude.on('exit')`.
- The prompt should tell the AI to write files to the output directory path, and to use the `/ui-design-system` skill

**File write detection:** Parse `assistant` events for `tool_use` content blocks where `block.name === 'Write'` or `block.name === 'Edit'`. Extract `block.input.file_path`, check it starts with the output dir, emit as `file` event.

### Frontend Components

**ChatPanel** (not a canvas node — sticky overlay)

- Messages list with auto-scroll
- Inline artifact cards when `file` events arrive (store artifacts in state, match by position in message flow)
- Click artifact card → calls `openArtifact(file)` which spawns/focuses the node on canvas
- Model/effort dropdowns in header
- Collapsible with +/- toggle

**ArtifactNode** (canvas node — generic, rendered per file type)

- NodeShell wrapper: title bar (drag handle), close button, NodeResizer (invisible handles)
- Body renders based on file extension:
  - `.md` → `<Markdown>` from react-markdown
  - `.html` → `<iframe src={url} sandbox="allow-scripts allow-same-origin">`
  - default → `<pre><code>` with the file content (fetch from `/output/...`)
- Title bar shows filename
- Toolbar: "Open in new tab" link, download button

### State Management

**useChat hook:**

- `messages[]`, `isStreaming`, `artifacts[]` (files created during conversation)
- `sendMessage(text, { model, effort })`
- `stop()` — aborts fetch
- Callbacks: `onFileCreated(file)` for canvas integration

**useCanvasNodes hook (or just useState in App):**

- React Flow nodes state
- `openArtifact(file)` — adds or focuses a node
- `closeArtifact(id)` — removes node
- Persist node layout (positions/sizes) + artifact refs to localStorage

**localStorage persistence:**

- Chat messages + artifacts list
- Canvas node positions/sizes + which artifacts are open
- Clear all on "Reset"

### Styling

Dark theme. CSS custom properties:

```css
--bg: #0f0f13;
--bg-surface: #1a1a22;
--bg-elevated: #22222e;
--border: #2e303a;
--text: #9ca3af;
--text-bright: #f3f4f6;
--accent: #818cf8;
--accent-dim: rgba(129, 140, 248, 0.15);
```

- React Flow attribution: `display: none`
- Resize handles: invisible (`opacity: 0`), cursor-only
- Node hover: subtle border glow to hint resizability
- Node body: `user-select: text` for copy
- Canvas background: dots pattern

### Tech Stack

- **Frontend:** Vite + React 19, @xyflow/react, react-markdown
- **Backend:** Express 5, cors
- **Dev:** nodemon for server hot-reload
- **CLI:** `claude` (Claude Code CLI, already installed at `~/.local/bin/claude`)

### Scripts

```json
{
  "dev": "npx nodemon server.js & vite --open",
  "dev:frontend": "vite",
  "dev:server": "npx nodemon server.js",
  "build": "vite build"
}
```

Vite proxy config:

```js
server: {
  proxy: {
    '/api': 'http://localhost:3002',
    '/output': 'http://localhost:3002',
  }
}
```

### Project Context

This app lives alongside a `ui-design-system` skill (a Claude Code custom skill). The skill directory contains `SKILL.md`, `aesthetics.md`, `template.md`, and a `.skill` package. The server uses `--add-dir` to point claude at this skill directory so it's discovered automatically.

---

Copy this to a file and feed it to claude in your new project folder. It captures every gotcha we hit.
