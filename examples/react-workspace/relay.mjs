import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * The wire between a CLI agent and the page it is changing.
 *
 * The workflow lives in the browser, because that is where the components are:
 * a render plan resolves each surface to an actual component function, so it is
 * not a thing that can be serialised and posted somewhere else. That settles
 * the topology — whoever wants to change the UI has to reach the page.
 *
 * So this process holds no workflow and no Leyline import at all. It carries
 * tool calls down to the page over SSE and carries results back up, and that is
 * the whole of it.
 */

const RELAY_PORT = Number(process.env['LEYLINE_RELAY_PORT'] ?? 5180);
const CALL_TIMEOUT_MS = 15_000;

/** The page, if one is open. Last connection wins; a reload replaces it. */
let page;
let nextId = 0;
const pending = new Map();

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readJson = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${String(RELAY_PORT)}`);

  // The page subscribes here and stays subscribed.
  if (req.method === 'GET' && url.pathname === '/agent/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    page = res;
    const beat = setInterval(() => res.write(': beat\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(beat);
      if (page === res) page = undefined;
    });
    return;
  }

  // The page answering a call it was asked to run.
  if (req.method === 'POST' && url.pathname === '/agent/result') {
    void readJson(req)
      .then((body) => {
        pending.get(body.id)?.(body.result);
        send(res, 200, { ok: true });
      })
      .catch(() => send(res, 400, { error: 'bad json' }));
    return;
  }

  // The MCP bridge asking for a call to be run in the page.
  if (req.method === 'POST' && url.pathname === '/agent/call') {
    void readJson(req)
      .then((body) => {
        // A refusal beats a hang: an agent that is told no page is open can say
        // so, where one left waiting on a dead socket can only time out.
        if (page === undefined) {
          send(res, 200, {
            ok: false,
            error: {
              code: 'relay.no-page',
              message: 'No page is open, so there is nothing to change.',
              issues: [],
              suggestion: `Run \`pnpm --filter @leyline-examples/react-workspace live\` and leave the page open.`,
            },
          });
          return;
        }

        nextId += 1;
        const id = `call_${String(nextId)}`;
        const timer = setTimeout(() => {
          pending.delete(id);
          send(res, 200, {
            ok: false,
            error: {
              code: 'relay.timeout',
              message: 'The page did not answer in time.',
              issues: [],
            },
          });
        }, CALL_TIMEOUT_MS);

        pending.set(id, (result) => {
          clearTimeout(timer);
          pending.delete(id);
          send(res, 200, result);
        });

        page.write(`data: ${JSON.stringify({ id, name: body.name, input: body.input })}\n\n`);
      })
      .catch(() => send(res, 400, { error: 'bad json' }));
    return;
  }

  send(res, 404, { error: 'not found' });
});

server.listen(RELAY_PORT, () => {
  process.stderr.write(`relay on http://localhost:${String(RELAY_PORT)}\n`);
});

// One command and one Ctrl-C: vite is a child of this process rather than a
// second terminal the reader has to be told about.
//
// Resolved from this package and run through the Node already executing, rather
// than looked up on PATH: a demo that starts should not depend on what happens
// to be earlier in someone's PATH than the vite they installed.
const viteBin = fileURLToPath(new URL('node_modules/vite/bin/vite.js', import.meta.url));
const vite = spawn(process.execPath, [viteBin, '--open'], { stdio: 'inherit', shell: false });
const stop = () => {
  vite.kill();
  server.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
vite.on('exit', stop);
