import { createServerFn } from '@tanstack/react-start'

interface ChatInput {
  message: string
  isFirstMessage: boolean
  model?: string
  effort?: string
  projectId: string
  conversationId: string
  currentPageId?: string
  currentPageName?: string
  references?: string[]
}

export const chatStream = createServerFn({ method: 'POST' })
  .inputValidator((input: ChatInput) => input)
  .handler(async ({ data }) => {
    const { spawn } = await import('node:child_process')
    const path = await import('node:path')
    const fs = await import('node:fs')
    const { fileURLToPath } = await import('node:url')

    const { getAllEdges, getAllArtifacts, getOrCreateSessionId } =
      await import('../mcp/db.js')

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const projectRoot = path.resolve(__dirname, '../..')
    const outputDir = path.resolve(projectRoot, 'output', data.projectId)
    const skillDir = path.resolve(projectRoot, 'skills/ui-design-system')

    // Debug logging
    const skillExists = fs.existsSync(skillDir)
    console.log(`[chat] Skill dir: ${skillDir} | exists: ${skillExists}`)
    if (skillExists) {
      console.log(`[chat] Skill contents:`, fs.readdirSync(skillDir))
    } else {
      console.warn(`[chat] WARNING: Skill directory not found!`)
    }

    // Ensure output dir exists for this project (persisted across messages)
    fs.mkdirSync(outputDir, { recursive: true })

    const { message, isFirstMessage, model, effort } = data
    console.log(
      `[chat] Request: model=${model || 'default'}, effort=${effort || 'default'}, first=${isFirstMessage}, msg="${message.slice(0, 80)}..."`,
    )

    const sessionId = getOrCreateSessionId(data.conversationId)

    const systemInstruction = [
      `You are a friendly design consultant working inside "Design Preview", a canvas-based design tool. Your users are developers who want great-looking UIs but don't have design training. Guide them step-by-step — ask questions, explain your reasoning briefly, and get confirmation before moving to the next phase.`,
      ``,
      `CRITICAL RULES:`,
      `- Write ALL output files to: ${outputDir}/`,
      `- You have access to the ui-design-system skill via /ui-design-system — use it for design work.`,
      `- HTML files should be self-contained (inline CSS/JS) so they render in an iframe preview.`,
      `- NEVER mention the output directory, file paths, or tell the user to "see it on the canvas". Files you create automatically appear as artifacts — the user already sees them. Just describe what you created and why.`,
      ``,
      `INTERACTIVE WORKFLOW — follow these phases in order:`,
      ``,
      `Phase 1: DISCOVERY (chat only — no files yet)`,
      `- When the user describes what they want, use askUser to ask 2-4 focused questions:`,
      `  • What does it do? (core function)`,
      `  • Who uses it? (audience — affects complexity and aesthetic)`,
      `  • What mood/vibe? (offer 3-4 concrete aesthetic choices from your knowledge)`,
      `  • Any apps they like the look of? (visual references)`,
      `- Keep questions short and approachable — devs aren't designers, so use plain language.`,
      `- If the user's request is already very detailed (specific colors, layout, references), skip straight to Phase 2.`,
      ``,
      `Phase 2: DESIGN SYSTEM (generate DESIGN.md + visual preview, then pause for review)`,
      `- Use /ui-design-system to generate a DESIGN.md with: aesthetic direction, color palette, typography, spacing, components.`,
      `- ALSO generate a companion DESIGN-PREVIEW.html — a self-contained HTML file that visually previews the design choices:`,
      `  • Color palette as swatches (colored rectangles with hex labels)`,
      `  • Typography samples rendered in the actual Google Fonts (load via <link>)`,
      `  • Spacing/radius/shadow examples`,
      `  • A mini component preview (e.g. a sample button, card, or input in the chosen style)`,
      `  Place DESIGN.md to the left and DESIGN-PREVIEW.html to its right so the user sees spec + visual side by side.`,
      `- After creating both files, STOP and ask the user to review: "Take a look at the design system and its visual preview. Does the direction feel right? Anything you'd change — colors, fonts, overall vibe?"`,
      `- If the user wants changes, update both files via Edit (don't regenerate from scratch).`,
      `- Do NOT proceed to Phase 3 until the user confirms the design system.`,
      ``,
      `Phase 3: PREVIEW GENERATION (HTML screens, one at a time or in logical groups)`,
      `- Generate HTML preview files based on the confirmed DESIGN.md.`,
      `- After each screen or group: briefly describe what you built and ask if it matches expectations.`,
      `- Use askUser to offer choices when there are meaningful alternatives (layout options, content variations).`,
      ``,
      `Phase 4: ITERATION`,
      `- The user points at specific artifacts and requests changes.`,
      `- Edit existing files rather than regenerating from scratch.`,
      `- Keep iterating until the user is satisfied.`,
      ``,
      `TONE: Be a helpful guide, not a lecture. One sentence of design reasoning is enough — e.g., "I went with a 4px base grid because it keeps spacing consistent without overthinking it." Don't over-explain.`,
      ``,
      `PAGE MANAGEMENT (professional design workflow):`,
      `- Pages are canvas tabs that organize work by feature area, like Figma pages.`,
      `- Examples: "Auth Flow", "Dashboard", "Onboarding", "Settings", "Design System", "Exploration".`,
      `- At the start of a design task, call listPages to see existing pages.`,
      `- Create new pages with createPage when the work belongs to a new feature area.`,
      `- When saving artifacts, pass the pageId to place them on the correct page.`,
      `- Follow this professional pattern:`,
      `  - Group related screens on the same page (e.g. login + signup + forgot password all go on "Auth Flow")`,
      `  - Use an "Exploration" page for rough wireframes and brainstorming`,
      `  - Use a "Design System" page for shared components and tokens`,
      `  - Don't create a new page for every single screen — group by feature area`,
      ``,
      `ARTIFACT & RELATIONSHIP TRACKING (MCP tools):`,
      `- CRITICAL WORKFLOW — follow this exact order for each artifact:`,
      `  1. Call getArtifacts ONCE at the start to see current canvas state`,
      `  2. Plan ALL positions upfront, accounting for each node's size (see below)`,
      `  3. For each artifact: call saveArtifact (with type, devicePreset, x, y) FIRST, then Write the file`,
      `  4. After all files written, call linkArtifacts for relationships`,
      `- saveArtifact pre-registers position and size BEFORE the node spawns, so the node appears at the correct spot.`,
      `- saveArtifact fields:`,
      `  - type: "requirement", "design", "preview", "component", or "other"`,
      `  - devicePreset: "mobile" (390×844), "tablet" (768×1024), or "desktop" (1440×1024) — sets the node size. ONLY use for screen previews that simulate a real device. Do NOT set devicePreset for documents (.md), design style previews (DESIGN-PREVIEW.html), or other reference artifacts — they use a compact default size.`,
      `  - x, y: canvas position — where the node should be placed`,
      `  - content: optional (can be empty when calling before Write)`,
      ``,
      `CANVAS LAYOUT — positioning artifacts:`,
      `- Use calcPosition to get coordinates — do NOT calculate positions manually.`,
      `- calcPosition takes: relativeTo (an existing artifact path), placement ("right", "below", "left", "above"), and devicePreset of the new artifact.`,
      `- For the first artifact: call calcPosition with no relativeTo to get the starting position.`,
      `- For subsequent artifacts: call calcPosition with relativeTo pointing to an existing artifact.`,
      `- Pass the returned x, y values to saveArtifact.`,
      ``,
      `LAYOUT PHILOSOPHY — organize like a professional design canvas:`,
      `The canvas is a flowchart. Think of it as a directed graph with a horizontal spine and vertical branches.`,
      ``,
      `Two axes:`,
      `  HORIZONTAL (left → right) = flow progression. Each column is one step deeper in the user journey.`,
      `  VERTICAL (top → down) = siblings, variants, and branches at the same depth level.`,
      ``,
      `The pattern:`,
      `  1. The HAPPY PATH runs left → right as a horizontal main line.`,
      `     [Login] ──→ [Dashboard] ──→ [Project Detail] ──→ [Edit Modal]`,
      `  2. BRANCHES fork downward from any node on the main line.`,
      `     A branch is: an alternate path, an error state, a sub-flow, or a variant.`,
      `     [Login] ──→ [Dashboard] ──→ [Project Detail]`,
      `        │              │                │`,
      `        ↓              ↓                ↓`,
      `     [Signup]    [Empty State]    [Delete Confirm]`,
      `        │              ↓`,
      `        ↓         [Error State]`,
      `     [Forgot PW]`,
      `  3. RESPONSIVE VARIANTS of the same screen stack vertically: desktop on top, tablet, mobile below.`,
      `  4. SPEC/SOURCE DOCS sit to the LEFT of the screens they describe.`,
      `     [DESIGN.md] ──→ [login.html]`,
      `                 ──→ [signup.html]`,
      `                 ──→ [dashboard.html]`,
      ``,
      `Positioning with calcPosition:`,
      `  - First node in a flow: calcPosition with no relativeTo (starting position).`,
      `  - Next step in flow (happy path): calcPosition("right", relativeTo=previousStep).`,
      `  - Branch/variant/sibling: calcPosition("below", relativeTo=nodeAbove).`,
      `  - Spec doc before its screens: place spec first, then screens to its right.`,
      ``,
      `Grouping:`,
      `  - Cluster by feature/flow (auth, checkout, settings, onboarding).`,
      `  - Within a cluster, the happy path is the top horizontal row.`,
      `  - Shared components or design system artifacts go on a separate page.`,
      ``,
      `Link screens with linkArtifacts to show user flow — arrows represent navigation paths (e.g. Login → Dashboard → Settings).`,
      `- Use short, plain labels that describe the user action: "login", "sign up", "back", "submit", "view detail", etc.`,
      `- Only link screens that the user can navigate between. Don't link spec docs to previews — proximity on the canvas already shows that relationship.`,
      `- Use moveArtifact to rearrange existing artifacts when the user asks to reorganize the canvas.`,
      `- Use setViewport to pan/zoom the canvas so the user can see artifacts you're creating or modifying. Call it after placing artifacts. It only takes effect if the user hasn't moved the canvas recently (~3s idle).`,
      `  - After generating multiple artifacts, call setViewport with mode "fitAll" so the user sees everything at once.`,
      `  - After generating or updating a single artifact, use mode "fitPaths" with that artifact's path.`,
      `- ALWAYS save artifacts and create links — this is how the canvas knows your artifacts' metadata and relationships.`,
      ``,
      `ASKING THE USER QUESTIONS:`,
      `When you need the user to choose between alternatives, call the askUser MCP tool.`,
      `NEVER use the AskUserQuestion tool — it does not work in this app. ONLY use mcp__seal__askUser.`,
      `It supports multiple questions at once — each with predefined options and an optional custom text input.`,
      `Options are plain strings (NOT objects) — e.g. ["Option A", "Option B"], not [{label: "..."}].`,
      `The app renders these as interactive forms with clickable buttons. The user's answers are returned as Q&A pairs.`,
      `NEVER present options as markdown numbered/bulleted lists — always use askUser.`,
      `Keep option text short (under 50 chars). You can ask multiple questions in a single call.`,
      `IMPORTANT: When using askUser, ALWAYS output a short one-liner text message before the tool call explaining what you need (e.g. "Let me ask a few questions to understand your vision."). The text MUST come before the askUser call, not after. Never call askUser with only a thinking block and no visible text.`,
    ].join('\n')

    // Prepend page context (like IDE file context)
    const pageContext = data.currentPageName
      ? `[User is viewing page: "${data.currentPageName}"${data.currentPageId ? ` (id: ${data.currentPageId})` : ''}]\n`
      : ''

    const refContext = data.references?.length
      ? `[User selected these artifacts for reference: ${data.references.join(', ')}]\n`
      : ''

    // First message: send system instruction with the message
    // Subsequent messages: use --continue to resume session, just send the new message
    const prompt = isFirstMessage
      ? `${systemInstruction}\n\n${pageContext}${refContext}\n${message}`
      : `${pageContext}${refContext}\n${message}`

    // Generate MCP config for the seal server
    const dataDir = path.resolve(projectRoot, 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    const mcpConfigPath = path.resolve(dataDir, 'mcp-config.json')
    const mcpConfig = {
      mcpServers: {
        seal: {
          command: 'npx',
          args: ['tsx', path.resolve(projectRoot, 'src/mcp/server.ts')],
        },
      },
    }
    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2))

    const args = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--mcp-config',
      mcpConfigPath,
      '--allowedTools',
      'Edit Write Read Glob Grep Bash(mkdir:*) Bash(ls:*) mcp__seal__askUser mcp__seal__saveArtifact mcp__seal__linkArtifacts mcp__seal__unlinkArtifacts mcp__seal__updateLink mcp__seal__getArtifacts mcp__seal__getRelationships mcp__seal__listPages mcp__seal__createPage mcp__seal__renamePage mcp__seal__switchPage mcp__seal__moveArtifact mcp__seal__calcPosition mcp__seal__setViewport',
    ]

    if (isFirstMessage) {
      // Create a new session with our known ID
      args.push('--session-id', sessionId)
    } else {
      // Resume the existing session
      args.push('--resume', sessionId)
    }

    if (skillExists) {
      args.push('--add-dir', skillDir)
      console.log(`[chat] Added skill dir to claude args`)
    }
    args.push('--add-dir', outputDir)

    if (model && model !== 'default') args.push('--model', model)
    if (effort && effort !== 'default') args.push('--effort', effort)

    console.log(`[chat] Spawning claude, pid pending...`)

    const formatToolStatus = (block: Record<string, unknown>) => {
      const name = block.name as string
      const input = (block.input as Record<string, string>) || {}
      switch (name) {
        case 'Write':
          return `Writing ${path.basename(input.file_path || 'file')}`
        case 'Edit':
          return `Editing ${path.basename(input.file_path || 'file')}`
        case 'Read':
          return `Reading ${path.basename(input.file_path || 'file')}`
        case 'Glob':
          return `Searching files: ${input.pattern || ''}`
        case 'Grep':
          return `Searching for: ${input.pattern || ''}`
        case 'Bash':
          return `Running command...`
        case 'mcp__seal__askUser':
          return 'Asking you a question...'
        case 'mcp__seal__saveArtifact':
          return `Saving artifact: ${input.filename || input.path || ''}`
        case 'mcp__seal__linkArtifacts':
          return 'Linking artifacts...'
        case 'mcp__seal__unlinkArtifacts':
          return 'Removing link...'
        case 'mcp__seal__updateLink':
          return 'Updating link...'
        case 'mcp__seal__getArtifacts':
          return 'Checking existing artifacts...'
        case 'mcp__seal__getRelationships':
          return 'Checking relationships...'
        case 'mcp__seal__listPages':
          return 'Checking pages...'
        case 'mcp__seal__createPage':
          return `Creating page: ${input.name || ''}`
        case 'mcp__seal__renamePage':
          return `Renaming page to: ${input.name || ''}`
        case 'mcp__seal__switchPage':
          return 'Navigating to page...'
        case 'mcp__seal__moveArtifact':
          return `Moving ${input.path || 'artifact'}...`
        case 'mcp__seal__calcPosition':
          return 'Calculating position...'
        case 'mcp__seal__setViewport':
          return 'Adjusting viewport...'
        default:
          return `Using ${name}...`
      }
    }

    // In-memory file contents so we can apply Edit diffs without filesystem
    const fileContents = new Map<string, string>()
    // Accumulate all thinking blocks across assistant events
    const allThinkingBlocks: string[] = []
    // Track processed tool_use block IDs to avoid duplicate SSE events
    const processedToolIds = new Set<string>()

    const handleClaudeEvent = (
      event: Record<string, unknown>,
      send: (data: Record<string, unknown>) => void,
    ) => {
      if (event.type === 'result') {
        send({
          type: 'usage',
          duration_ms: event.duration_ms,
          total_cost_usd: event.total_cost_usd,
          usage: event.usage,
        })
        return
      }

      if (event.type === 'assistant') {
        const msg = event.message as Record<string, unknown> | undefined
        // Stream incremental usage from assistant events
        const msgUsage = msg?.usage as Record<string, number> | undefined
        if (msgUsage) {
          send({ type: 'usage', usage: msgUsage })
        }
        const contentBlocks = (msg?.content as Record<string, unknown>[]) || []
        // Accumulate thinking blocks across all assistant events
        const newThinking = contentBlocks
          .filter((b) => b.type === 'thinking' && b.thinking)
          .map((b) => b.thinking as string)
        if (newThinking.length > 0) {
          allThinkingBlocks.push(...newThinking)
          send({ type: 'thinking', blocks: [...allThinkingBlocks] })
        }
        for (const block of contentBlocks) {
          if (block.type === 'text') {
            send({ type: 'text', content: block.text })
          }
          if (block.type === 'tool_use') {
            const toolId = block.id as string
            if (processedToolIds.has(toolId)) continue
            processedToolIds.add(toolId)
            const input = block.input as Record<string, string> | undefined
            if (input?.file_path?.startsWith(outputDir)) {
              const relativePath = path.relative(outputDir, input.file_path)
              const filename = path.basename(input.file_path)

              if (block.name === 'Write') {
                const content = input.content || ''
                fileContents.set(relativePath, content)
                send({
                  type: 'file',

                  path: relativePath,
                  filename,
                  content,
                })
              } else if (block.name === 'Edit') {
                const existing = fileContents.get(relativePath) || ''
                const oldStr = input.old_string || ''
                const newStr = input.new_string || ''
                const updated = existing.replace(oldStr, newStr)
                fileContents.set(relativePath, updated)
                send({
                  type: 'file',

                  path: relativePath,
                  filename,
                  content: updated,
                })
              }
            }
            // Intercept askUser MCP tool to emit questions to client
            if (block.name === 'mcp__seal__askUser' && input) {
              const questions = (block.input as Record<string, unknown>)
                .questions
              send({ type: 'askUser', questions })
            }
            // Intercept saveArtifact MCP tool to spawn a pending ghost node
            if (block.name === 'mcp__seal__saveArtifact' && input) {
              if (input.x !== undefined && input.y !== undefined) {
                send({
                  type: 'pendingArtifact',
                  path: input.path,
                  filename: input.path.split('/').pop() || input.path,
                  devicePreset: input.devicePreset,
                  x: Number(input.x),
                  y: Number(input.y),
                })
              }
              if (input.devicePreset) {
                send({
                  type: 'devicePreset',
                  path: input.path,
                  preset: input.devicePreset,
                })
              }
              if (input.x !== undefined && input.y !== undefined) {
                send({
                  type: 'moveArtifact',
                  path: input.path,
                  x: Number(input.x),
                  y: Number(input.y),
                })
              }
            }
            // Intercept linkArtifacts MCP tool to emit edge creation in real-time
            if (block.name === 'mcp__seal__linkArtifacts' && input) {
              send({
                type: 'edge',
                source: input.source_path,
                target: input.target_path,
                kind: input.label || '',
              })
            }
            // Intercept unlinkArtifacts MCP tool to emit edge removal
            if (block.name === 'mcp__seal__unlinkArtifacts' && input) {
              send({
                type: 'removeEdge',
                source: input.source_path,
                target: input.target_path,
              })
            }
            // Intercept updateLink MCP tool to emit edge update
            if (block.name === 'mcp__seal__updateLink' && input) {
              send({
                type: 'updateEdge',
                source: input.source_path,
                target: input.target_path,
                label: input.label,
              })
            }
            // Intercept createPage MCP tool to emit page creation event
            if (block.name === 'mcp__seal__createPage' && input?.name) {
              send({ type: 'createPage', name: input.name })
            }
            // Intercept switchPage MCP tool to emit page navigation event
            if (block.name === 'mcp__seal__switchPage' && input?.pageId) {
              send({ type: 'switchPage', pageId: input.pageId })
            }
            // Intercept moveArtifact MCP tool to emit move event
            if (block.name === 'mcp__seal__moveArtifact' && input) {
              send({
                type: 'moveArtifact',
                path: input.path,
                x: Number(input.x),
                y: Number(input.y),
              })
            }
            // Intercept setViewport MCP tool to emit viewport change event
            if (block.name === 'mcp__seal__setViewport' && input) {
              send({
                type: 'setViewport',
                mode: input.mode ?? 'fitAll',
                paths: input.paths,
                x: input.x !== undefined ? Number(input.x) : undefined,
                y: input.y !== undefined ? Number(input.y) : undefined,
                zoom: input.zoom !== undefined ? Number(input.zoom) : undefined,
                padding:
                  input.padding !== undefined ? Number(input.padding) : 80,
              })
            }
            // Intercept renamePage MCP tool to emit page rename event
            if (block.name === 'mcp__seal__renamePage' && input?.pageId) {
              send({
                type: 'renamePage',
                pageId: input.pageId,
                name: input.name,
              })
            }
            send({ type: 'status', event: formatToolStatus(block) })
          }
        }
      }
    }

    let killClaude: (() => void) | undefined

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        let closed = false
        const send = (data: Record<string, unknown>) => {
          if (closed) return
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          )
        }
        const closeController = () => {
          if (closed) return
          closed = true
          controller.close()
        }

        const claude = spawn('claude', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, SEAL_PROJECT_ID: data.projectId },
        })

        console.log(`[chat] Claude spawned, pid=${claude.pid}`)

        let claudeDone = false
        const heartbeat = setInterval(() => {
          if (!claudeDone) send({ type: 'heartbeat' })
        }, 5000)

        killClaude = () => {
          if (!claudeDone) {
            closed = true
            claudeDone = true
            clearInterval(heartbeat)
            claude.kill('SIGTERM')
          }
        }

        let buffer = ''

        claude.stdout.on('data', (chunk: Buffer) => {
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              handleClaudeEvent(JSON.parse(line), send)
            } catch {
              // ignore malformed lines
            }
          }
        })

        claude.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString().trim()
          if (text) {
            console.log(`[chat] Claude stderr: ${text}`)
            send({ type: 'status', event: text })
          }
        })

        claude.on('exit', (code, signal) => {
          console.log(`[chat] Claude exited: code=${code}, signal=${signal}`)
          claudeDone = true
          clearInterval(heartbeat)
          if (buffer.trim()) {
            try {
              handleClaudeEvent(JSON.parse(buffer), send)
            } catch {
              // ignore
            }
          }

          // Read relationships from SQLite (created by MCP server)
          try {
            const edges = getAllEdges(data.projectId)
            const artifacts = getAllArtifacts(data.projectId)
            const artifactById = new Map(artifacts.map((a) => [a.id, a]))
            for (const edge of edges) {
              const source = artifactById.get(edge.source_artifact_id)
              const target = artifactById.get(edge.target_artifact_id)
              if (source && target) {
                send({
                  type: 'edge',
                  source: source.path,
                  target: target.path,
                  kind: edge.kind,
                })
              }
            }
          } catch (err) {
            console.error('[chat] Failed to read edges from SQLite:', err)
          }

          send({ type: 'done', code, signal })
          closeController()
        })

        claude.on('error', (err) => {
          console.error(`[chat] Claude spawn error:`, err.message)
          claudeDone = true
          clearInterval(heartbeat)
          send({ type: 'error', message: err.message })
          closeController()
        })
      },
      cancel() {
        killClaude?.()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  })
