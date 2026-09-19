import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { OPERATIONS, type AgentSurface, type ToolResult } from '@khorum-oss/leyline-agent';
import { serveOverMcp } from '@khorum-oss/leyline-agent/mcp';

/**
 * What `claude` talks to when it changes the open page.
 *
 * This process holds no workflow either. The surface handed to `serveOverMcp`
 * below is a stand-in whose `handle` posts to the relay and waits for the page
 * to answer — so the operation really does run against the workflow the browser
 * is drawing, and the result really is that workflow's.
 *
 * The tool definitions come from `OPERATIONS`, which is the same static
 * contract the in-process surface publishes and needs no workflow to read. That
 * is what lets the tools exist before anyone opens a page.
 */

const RELAY = `http://localhost:${String(process.env['LEYLINE_RELAY_PORT'] ?? 5180)}`;

const remote: AgentSurface = {
  tools: () => OPERATIONS.map((operation) => operation.definition),

  handle: async (name: string, input?: unknown): Promise<ToolResult> => {
    try {
      const response = await fetch(`${RELAY}/agent/call`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, input: input ?? {} }),
      });
      return (await response.json()) as ToolResult;
    } catch {
      // The relay being down is this adapter's failure to report, not the
      // page's — and it is still an answer rather than a thrown call.
      return {
        ok: false,
        error: {
          code: 'relay.unreachable',
          message: `No relay at ${RELAY}.`,
          issues: [],
          suggestion: 'Run `pnpm --filter @leyline-examples/react-workspace live` first.',
        },
      } as ToolResult;
    }
  },
} as AgentSurface;

const server = new Server(
  { name: 'leyline-live', version: '0.0.0' },
  { capabilities: { tools: {} } },
);

serveOverMcp(server, remote, {
  listToolsRequestSchema: ListToolsRequestSchema,
  callToolRequestSchema: CallToolRequestSchema,
});

await server.connect(new StdioServerTransport());
process.stderr.write(`leyline-live: ${String(remote.tools().length)} tools, relay ${RELAY}\n`);

await new Promise<void>((resolve) => {
  process.stdin.once('end', resolve);
  server.onclose = resolve;
  process.once('SIGINT', resolve);
  process.once('SIGTERM', resolve);
});
await server.close();
