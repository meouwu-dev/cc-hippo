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
      `You are a UI design system assistant working inside "Design Preview", a canvas-based design tool.`,
      ``,
      `CRITICAL RULES:`,
      `- Write ALL output files to: ${outputDir}/`,
      `- You have access to the ui-design-system skill via /ui-design-system — use it when the user asks for design work.`,
      `- For design requests: first create a DESIGN.md, then create HTML preview files.`,
      `- HTML files should be self-contained (inline CSS/JS) so they render in an iframe preview.`,
      `- Always create files — the user sees your work as artifacts on a canvas, not as chat text.`,
      `- NEVER mention the output directory, file paths, or tell the user to "see it on the canvas". Files you create automatically appear as artifacts — the user already sees them. Just describe what you created and why.`,
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
      `- After writing each file, call saveArtifact to register it with its type and pageId:`,
      `  - "requirement" for requirement docs, specs, or constraints`,
      `  - "design" for design documents, style guides, or design specs`,
      `  - "preview" for HTML preview files`,
      `  - "component" for reusable components`,
      `  - "other" for anything else`,
      `- When saving HTML preview artifacts, set devicePreset to match the intended viewport:`,
      `  - "mobile" (390×844) for mobile-first or phone layouts`,
      `  - "tablet" (768×1024) for tablet layouts`,
      `  - "desktop" (1440×1024) for full-width desktop layouts`,
      `- After saving artifacts, call linkArtifacts to declare relationships between them:`,
      `  - "references" when one doc references another`,
      `  - "implements" when a preview implements a design or requirement`,
      `  - "derives" when one artifact is derived from another`,
      `  - "extends" when one artifact extends another`,
      `- Call getArtifacts at the start to see what already exists so you can build on previous work.`,
      `- ALWAYS save artifacts and create links — this is how the canvas shows relationships between your work.`,
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
      'Edit Write Read Glob Grep Bash(mkdir:*) Bash(ls:*) mcp__seal__askUser mcp__seal__saveArtifact mcp__seal__linkArtifacts mcp__seal__getArtifacts mcp__seal__getRelationships mcp__seal__listPages mcp__seal__createPage mcp__seal__renamePage mcp__seal__switchPage',
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
            // Intercept saveArtifact MCP tool to forward devicePreset
            if (
              block.name === 'mcp__seal__saveArtifact' &&
              input?.devicePreset
            ) {
              send({
                type: 'devicePreset',
                path: input.path,
                preset: input.devicePreset,
              })
            }
            // Intercept switchPage MCP tool to emit page navigation event
            if (block.name === 'mcp__seal__switchPage' && input?.pageId) {
              send({ type: 'switchPage', pageId: input.pageId })
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
