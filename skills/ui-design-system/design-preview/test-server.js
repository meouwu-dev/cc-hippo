// Quick test: start server, send a request, print output, exit
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = spawn('node', [`${__dirname}/server.js`], { stdio: ['pipe', 'pipe', 'pipe'] });

let serverReady = false;
server.stderr.on('data', d => process.stderr.write('[srv err] ' + d));
server.stdout.on('data', d => {
  const s = d.toString();
  process.stderr.write('[srv] ' + s + '\n');
  if (s.includes('running on') && !serverReady) {
    serverReady = true;
    runTest();
  }
});

async function runTest() {
  try {
    const res = await fetch('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'just say hello in 3 words' }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      process.stdout.write(chunk);
    }
    console.log('\n\n=== DONE ===');
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
  server.kill();
  process.exit(0);
}

setTimeout(() => { console.error('TIMEOUT'); server.kill(); process.exit(1); }, 60000);
