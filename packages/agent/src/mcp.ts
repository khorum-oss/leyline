import type { AgentSurface } from './types.js';

/**
 * The MCP adapter (brief §6).
 *
 * Thin on purpose. It lists the surface's operations as MCP tools, passing the
 * published JSON Schema through verbatim so that what an agent sees is the
 * contract rather than a translation of it, and forwards each call.
 *
 * Transport and auth stay the host application's concern. This function takes a
 * server it can register handlers on and hands it back; the host decides
 * whether that server speaks over stdio, over HTTP, or over something it wrote
 * itself, and what it authenticated before constructing the surface.
 */

/**
 * The subset of an MCP server this adapter uses.
 *
 * Loose on purpose. The SDK's own signature is generic over its request schemas
 * and would drag those types across this boundary; naming only the method keeps
 * the adapter compatible with the SDK without depending on it.
 */
export interface McpServerLike {
  setRequestHandler(...args: never[]): void;
}

type RegisterHandler = (schema: unknown, handler: (request: unknown) => Promise<unknown>) => void;

interface ToolCall {
  readonly params: { readonly name: string; readonly arguments?: unknown };
}

export interface McpAdapterOptions {
  /**
   * The SDK's `ListToolsRequestSchema` and `CallToolRequestSchema`.
   *
   * Passed in rather than imported, so this module carries no dependency on the
   * SDK at all: a host that has it supplies them, and one that does not never
   * loads this file.
   */
  readonly listToolsRequestSchema: unknown;
  readonly callToolRequestSchema: unknown;
}

/**
 * Registers a Leyline surface's operations on an MCP server.
 *
 * ```ts
 * import { Server } from '@modelcontextprotocol/sdk/server/index.js';
 * import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
 *
 * const server = new Server({ name: 'leyline', version: '1' }, { capabilities: { tools: {} } });
 * serveOverMcp(server, surface, {
 *   listToolsRequestSchema: ListToolsRequestSchema,
 *   callToolRequestSchema: CallToolRequestSchema,
 * });
 * ```
 */
export function serveOverMcp<TServer extends McpServerLike>(
  server: TServer,
  surface: AgentSurface,
  options: McpAdapterOptions,
): TServer {
  const register = (server.setRequestHandler as unknown as RegisterHandler).bind(server);

  register(options.listToolsRequestSchema, async () => ({
    tools: surface.tools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: !tool.mutates },
    })),
  }));

  register(options.callToolRequestSchema, async (request: unknown) => {
    const call = request as ToolCall;
    const result = await surface.handle(call.params.name, call.params.arguments);

    // A refused change is an answer, not a transport failure: `isError` would
    // tell an agent the call went wrong, when in fact the call worked and the
    // change was rejected for a reason it can read and act on.
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.ok ? result.value : result.error, null, 2),
        },
      ],
      isError: false,
    };
  });

  return server;
}
