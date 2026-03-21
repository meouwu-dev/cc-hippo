import { createServerFn } from "@tanstack/react-start";

interface ChatInput {
  message: string;
  history?: { role: string; content: string }[];
  model?: string;
  effort?: string;
}

export const chatStream = createServerFn({ method: "POST" })
  .inputValidator((input: ChatInput) => input)
  .handler(async ({ data }) => {
    const { spawn } = await import("node:child_process");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const { fileURLToPath } = await import("node:url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(__dirname, "../..");
    const outputDir = path.resolve(projectRoot, "output");
    const skillDir = path.resolve(projectRoot, "../ui-design-system");

    // Debug logging
    const skillExists = fs.existsSync(skillDir);
    console.log(`[chat] Skill dir: ${skillDir} | exists: ${skillExists}`);
    if (skillExists) {
      console.log(`[chat] Skill contents:`, fs.readdirSync(skillDir));
    } else {
      console.warn(`[chat] WARNING: Skill directory not found!`);
    }

    // Clean and recreate output dir each request — files are only needed
    // temporarily for the claude CLI subprocess; we stream content to the
    // client via SSE and persist in IndexedDB, so nothing reads from disk.
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    const { message, history, model, effort } = data;
    console.log(`[chat] Request: model=${model || "default"}, effort=${effort || "default"}, msg="${message.slice(0, 80)}..."`);

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
    ].join("\n");

    const historyText = (history || [])
      .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const prompt = historyText
      ? `${systemInstruction}\n\n${historyText}\n\nHuman: ${message}`
      : `${systemInstruction}\n\n${message}`;

    const args = [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--allowedTools",
      "Edit Write Read Glob Grep Bash(mkdir:*) Bash(ls:*)",
    ];

    if (skillExists) {
      args.push("--add-dir", skillDir);
      console.log(`[chat] Added skill dir to claude args`);
    }
    args.push("--add-dir", outputDir);

    if (model) args.push("--model", model);
    if (effort) args.push("--effort", effort);

    console.log(`[chat] Spawning claude, pid pending...`);

    const formatToolStatus = (block: Record<string, unknown>) => {
      const name = block.name as string;
      const input = (block.input as Record<string, string>) || {};
      switch (name) {
        case "Write":
          return `Writing ${path.basename(input.file_path || "file")}`;
        case "Edit":
          return `Editing ${path.basename(input.file_path || "file")}`;
        case "Read":
          return `Reading ${path.basename(input.file_path || "file")}`;
        case "Glob":
          return `Searching files: ${input.pattern || ""}`;
        case "Grep":
          return `Searching for: ${input.pattern || ""}`;
        case "Bash":
          return `Running command...`;
        default:
          return `Using ${name}...`;
      }
    };

    // In-memory file contents so we can apply Edit diffs without filesystem
    const fileContents = new Map<string, string>();

    const handleClaudeEvent = (
      event: Record<string, unknown>,
      send: (data: Record<string, unknown>) => void,
    ) => {
      if (event.type === "result") return;

      if (event.type === "assistant") {
        const msg = event.message as Record<string, unknown> | undefined;
        const contentBlocks =
          (msg?.content as Record<string, unknown>[]) || [];
        for (const block of contentBlocks) {
          if (block.type === "text") {
            send({ type: "text", content: block.text });
          }
          if (block.type === "thinking") {
            send({ type: "thinking", content: block.thinking });
          }
          if (block.type === "tool_use") {
            const input = block.input as Record<string, string> | undefined;
            if (input?.file_path?.startsWith(outputDir)) {
              const relativePath = path.relative(outputDir, input.file_path);
              const filename = path.basename(input.file_path);

              if (block.name === "Write") {
                const content = input.content || "";
                fileContents.set(relativePath, content);
                send({
                  type: "file",

                  path: relativePath,
                  filename,
                  content,
                });
              } else if (block.name === "Edit") {
                const existing = fileContents.get(relativePath) || "";
                const oldStr = input.old_string || "";
                const newStr = input.new_string || "";
                const updated = existing.replace(oldStr, newStr);
                fileContents.set(relativePath, updated);
                send({
                  type: "file",

                  path: relativePath,
                  filename,
                  content: updated,
                });
              }
            }
            send({ type: "status", event: formatToolStatus(block) });
          }
        }
      }
    };

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        };

        const claude = spawn("claude", args, {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
        });

        console.log(`[chat] Claude spawned, pid=${claude.pid}`);

        let claudeDone = false;
        const heartbeat = setInterval(() => {
          if (!claudeDone) send({ type: "heartbeat" });
        }, 5000);

        let buffer = "";

        claude.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              handleClaudeEvent(JSON.parse(line), send);
            } catch {
              // ignore malformed lines
            }
          }
        });

        claude.stderr.on("data", (chunk: Buffer) => {
          const text = chunk.toString().trim();
          if (text) {
            console.log(`[chat] Claude stderr: ${text}`);
            send({ type: "status", event: text });
          }
        });

        claude.on("exit", (code, signal) => {
          console.log(`[chat] Claude exited: code=${code}, signal=${signal}`);
          claudeDone = true;
          clearInterval(heartbeat);
          if (buffer.trim()) {
            try {
              handleClaudeEvent(JSON.parse(buffer), send);
            } catch {
              // ignore
            }
          }
          send({ type: "done", code, signal });
          controller.close();
        });

        claude.on("error", (err) => {
          console.error(`[chat] Claude spawn error:`, err.message);
          claudeDone = true;
          clearInterval(heartbeat);
          send({ type: "error", message: err.message });
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });
