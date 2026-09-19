import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { serveOverMcp } from '@khorum-oss/leyline-agent/mcp';
import type { Session } from './session.js';

/**
 * The same surface, over MCP, for a CLI that already has a model.
 *
 * `claude` and `codex` sign in on their own and speak MCP for external tools,
 * so pointing one at this server is the cheapest way to watch a real model
 * drive the control plane — no API key, and nothing to configure beyond naming
 * the command.
 *
 * There is no adapter here worth the name. `serveOverMcp` publishes the
 * surface's operations with their JSON Schema passed through verbatim, which
 * leaves this file responsible for a transport and nothing else — the point
 * being that a second tool-calling format cost the library no second surface.
 */

/**
 * Under stdio, stdout *is* the protocol.
 *
 * A stray `console.log` lands in the middle of a JSON-RPC frame and the client
 * disconnects with a parse error that names nothing useful. Every human-facing
 * byte in this mode goes to stderr, which the CLIs surface as server logs.
 */
export function note(message: string): void {
  process.stderr.write(`${message}\n`);
}

export async function runMcp(session: Session): Promise<void> {
  const server = new Server({ name: 'leyline', version: '0.0.0' }, { capabilities: { tools: {} } });

  serveOverMcp(server, session.surface, {
    listToolsRequestSchema: ListToolsRequestSchema,
    callToolRequestSchema: CallToolRequestSchema,
  });

  await server.connect(new StdioServerTransport());

  const tier = String(session.workflow.getSnapshot().context.tier);
  note(`leyline: ${String(session.surface.tools().length)} tools, tier ${tier}`);

  // The transport owns the process from here: it holds stdin open and keeps
  // reading until the client hangs up. Waiting on that — rather than returning
  // into `process.exit` — is what keeps the server alive.
  await new Promise<void>((resolve) => {
    // A client hangs up by closing the pipe, not by signalling: stdin reaching
    // EOF is the one that actually fires. The signals are here for a human who
    // started this by hand and pressed Ctrl-C.
    process.stdin.once('end', resolve);
    server.onclose = resolve;
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });

  await server.close();
}
