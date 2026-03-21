import { createServerFn } from '@tanstack/react-start'

interface ChatInput {
  message: string
  isFirstMessage: boolean
  model?: string
  effort?: string
  projectId: string
}

export const chatStream = createServerFn({ method: 'POST' })
  .inputValidator((input: ChatInput) => input)
  .handler(async ({ data }) => {
    const { spawn } = await import('node:child_process')
    const path = await import('node:path')
    const fs = await import('node:fs')
    const { fileURLToPath } = await import('node:url')

    const { getAllEdges, getOrCreateSessionId } = await import('../mcp/db.js')

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const projectRoot = path.resolve(__dirname, '../..')
    const outputDir = path.resolve(projectRoot, 'output')
    const skillDir = path.resolve(projectRoot, 'skills/ui-design-system')

    // Debug logging
    const skillExists = fs.existsSync(skillDir)
    console.log(`[chat] Skill dir: ${skillDir} | exists: ${skillExists}`)
    if (skillExists) {
      console.log(`[chat] Skill contents:`, fs.readdirSync(skillDir))
    } else {
      console.warn(`[chat] WARNING: Skill directory not found!`)
    }

    // Clean and recreate output dir each request — files are only needed
    // temporarily for the claude CLI subprocess; we stream content to the
    // client via SSE and persist in IndexedDB, so nothing reads from disk.
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true })
    }
    fs.mkdirSync(outputDir, { recursive: true })

    const { message, isFirstMessage, model, effort } = data
    console.log(
      `[chat] Request: model=${model || 'default'}, effort=${effort || 'default'}, first=${isFirstMessage}, msg="${message.slice(0, 80)}..."`,
    )

    const sessionId = getOrCreateSessionId(data.projectId)

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
      `ARTIFACT & RELATIONSHIP TRACKING (MCP tools):`,
      `- After writing each file, call saveArtifact to register it with its type:`,
      `  - "requirement" for requirement docs, specs, or constraints`,
      `  - "design" for design documents, style guides, or design specs`,
      `  - "preview" for HTML preview files`,
      `  - "component" for reusable components`,
      `  - "other" for anything else`,
      `- After saving artifacts, call linkArtifacts to declare relationships between them:`,
      `  - "references" when one doc references another`,
      `  - "implements" when a preview implements a design or requirement`,
      `  - "derives" when one artifact is derived from another`,
      `  - "extends" when one artifact extends another`,
      `- Call getArtifacts at the start to see what already exists so you can build on previous work.`,
      `- ALWAYS save artifacts and create links — this is how the canvas shows relationships between your work.`,
      ``,
      `ASKING THE USER QUESTIONS (MANDATORY FORMAT):`,
      `When you present options or ask the user to choose between alternatives, you MUST use this exact format:`,
      ``,
      `[CHOICE]`,
      `{"question": "Your question here", "options": ["Option A", "Option B", "Option C"]}`,
      `[/CHOICE]`,
      ``,
      `IMPORTANT: The app renders [CHOICE] blocks as clickable buttons. The user clicks a button and their selection is sent automatically.`,
      `You MUST use [CHOICE] blocks instead of numbered lists or bullet points when presenting options.`,
      `NEVER present options as markdown lists — always use [CHOICE] blocks.`,
      `Keep option text short (under 50 chars). You can add context before the [CHOICE] block.`,
    ].join('\n')

    // First message: send system instruction with the message
    // Subsequent messages: use --continue to resume session, just send the new message
    const prompt = isFirstMessage
      ? `${systemInstruction}\n\n${message}`
      : message

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
      'Edit Write Read Glob Grep Bash(mkdir:*) Bash(ls:*) mcp__seal__saveArtifact mcp__seal__linkArtifacts mcp__seal__getArtifacts mcp__seal__getRelationships',
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

    if (model) args.push('--model', model)
    if (effort) args.push('--effort', effort)

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
        default:
          return `Using ${name}...`
      }
    }

    // In-memory file contents so we can apply Edit diffs without filesystem
    const fileContents = new Map<string, string>()

    const handleClaudeEvent = (
      event: Record<string, unknown>,
      send: (data: Record<string, unknown>) => void,
    ) => {
      if (event.type === 'result') return

      if (event.type === 'assistant') {
        const msg = event.message as Record<string, unknown> | undefined
        const contentBlocks = (msg?.content as Record<string, unknown>[]) || []
        for (const block of contentBlocks) {
          if (block.type === 'text') {
            send({ type: 'text', content: block.text })
          }
          if (block.type === 'thinking') {
            send({ type: 'thinking', content: block.thinking })
          }
          if (block.type === 'tool_use') {
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
            send({ type: 'status', event: formatToolStatus(block) })
          }
        }
      }
    }

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          )
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
            for (const edge of edges) {
              send({
                type: 'edge',
                source: edge.source_path,
                target: edge.target_path,
                kind: edge.kind,
              })
            }
          } catch (err) {
            console.error('[chat] Failed to read edges from SQLite:', err)
          }

          send({ type: 'done', code, signal })
          controller.close()
        })

        claude.on('error', (err) => {
          console.error(`[chat] Claude spawn error:`, err.message)
          claudeDone = true
          clearInterval(heartbeat)
          send({ type: 'error', message: err.message })
          controller.close()
        })
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
