/**
 * `@leyline/agent` — the control plane, packaged for machine consumers.
 *
 * This package adds no capability the control plane lacks (G9). It packages
 * introspection that reads like documentation, operation descriptors carrying
 * the published JSON Schema, structured errors an agent can act on, and the
 * identity boundary between an untrusted caller and the control plane.
 *
 * Nothing here speaks a transport. `@leyline/agent/mcp` builds an MCP server
 * from this surface, and its SDK is an optional peer — anyone targeting a
 * different tool-calling format uses the definitions directly.
 */

export { createAgentSurface } from './surface.js';
export { introspect, type Introspection } from './introspection.js';
export { OPERATIONS, OPERATIONS_BY_NAME, type Operation } from './operations.js';
export type {
  AgentSurface,
  AgentSurfaceOptions,
  ToolDefinition,
  ToolFailure,
  ToolResult,
} from './types.js';
