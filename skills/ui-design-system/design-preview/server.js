import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// Serve output directory statically so HTML previews can be loaded in iframes
app.use('/output', express.static(resolve(__dirname, 'output')));

app.post('/api/chat', (req, res) => {
  const { message, history, model, effort } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Build prompt from history + current message
  const conversationParts = [];
  if (history?.length) {
    for (const msg of history) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      conversationParts.push(`${role}: ${msg.content}`);
    }
  }
  const outputDir = resolve(__dirname, 'output');
  conversationParts.push(`User: Use the /ui-design-system skill to handle this request: ${message}\n\nWhen generating files, write them to: ${outputDir}`);
  const fullPrompt = conversationParts.join('\n\n');

  const skillDir = resolve(__dirname, '..');

  const args = [
    '-p', fullPrompt,
    '--add-dir', skillDir,
    '--add-dir', outputDir,
    '--output-format', 'stream-json',
    '--allowedTools', `Edit Write Read Glob Grep Bash(mkdir:*) Bash(ls:*)`,
  ];
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort);
  console.log('[spawn] claude args:', args);

  const claude = spawn('claude', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let buffer = '';

  function extractText(event) {
    if (event.type === 'assistant' && event.message?.content) {
      const parts = event.message.content
        .filter(b => b.type === 'text')
        .map(b => b.text);
      if (parts.length) return parts.join('');
    }
    if (event.type === 'result') return null;
    return null;
  }

  function extractFiles(event) {
    // Detect Write/Edit tool use to find created files
    if (event.type === 'assistant' && event.message?.content) {
      const files = [];
      for (const block of event.message.content) {
        if (block.type === 'tool_use' && (block.name === 'Write' || block.name === 'Edit')) {
          const filePath = block.input?.file_path;
          if (filePath && filePath.startsWith(outputDir)) {
            // Convert absolute path to relative URL
            const relative = filePath.slice(outputDir.length);
            files.push({ path: filePath, url: `/output${relative}` });
          }
        }
      }
      return files;
    }
    return [];
  }

  function processLine(line) {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      // Forward any event type as a status hint
      if (event.type && event.type !== 'assistant' && event.type !== 'result') {
        res.write(`data: ${JSON.stringify({ type: 'status', event: event.type })}\n\n`);
      }
      // Detect file writes
      const files = extractFiles(event);
      for (const file of files) {
        res.write(`data: ${JSON.stringify({ type: 'file', ...file })}\n\n`);
      }
      const text = extractText(event);
      if (text) {
        res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  // Heartbeat every 5s so connection stays alive and frontend knows we're working
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
  }, 5000);

  claude.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      processLine(line);
    }
  });

  claude.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    if (text.trim()) {
      console.error('[claude stderr]', text);
    }
  });

  claude.on('close', (code, signal) => {
    clearInterval(heartbeat);
    console.log(`[claude] exited code=${code} signal=${signal}`);
    if (buffer.trim()) {
      processLine(buffer);
    }
    res.write(`data: ${JSON.stringify({ type: 'done', code, signal })}\n\n`);
    res.end();
  });

  claude.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
    res.end();
  });

});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Design preview server running on http://localhost:${PORT}`);
  console.log(`Using skill dir: ${resolve(__dirname, '..')}`);
});
