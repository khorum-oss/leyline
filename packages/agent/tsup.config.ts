import { defineConfig } from 'tsup';
import base from '../../tsup.base';

// Two entry points: the transport-free surface, and the MCP adapter that needs
// an optional peer. Anyone who does not speak MCP never loads the second.
export default defineConfig({ ...base, entry: ['src/index.ts', 'src/mcp.ts'] });
