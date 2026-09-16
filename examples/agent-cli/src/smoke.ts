import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Proof that `pnpm mcp` is a server a real client can talk to.
 *
 * `packages/agent` already tests the adapter against `InMemoryTransport`, which
 * is exactly the part this does not need to re-test. What is untested there is
 * the wiring added here: that the process starts, that stdout carries clean
 * JSON-RPC and no stray logging, and that a client speaking the protocol over a
 * pipe gets the tools back. CI runs this so the mode cannot rot quietly.
 */

const here = dirname(fileURLToPath(import.meta.url));

/**
 * A server's own words, stripped of the ones that are not words.
 *
 * Everything this file prints came back over the wire. A response carrying a
 * newline could forge a line of output that looks like this program's, so the
 * control characters come out before anything is printed and the result is
 * quoted and bounded. What is left is still the server's text, and still
 * useful when the check fails — it just cannot pretend to be ours.
 */
function quoted(text: string): string {
  const flattened = text.replace(/[\p{Cc}\p{Cf}]/gu, ' ');
  return JSON.stringify(flattened.slice(0, 300));
}

/** One tool call, with the text an agent would have parsed out of the result. */
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean | undefined; text: string; json: Record<string, unknown> }> {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
  return {
    isError: result.isError as boolean | undefined,
    text,
    json: JSON.parse(text) as Record<string, unknown>,
  };
}

async function main(): Promise<number> {
  const client = new Client({ name: 'smoke', version: '0.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      join(here, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      join(here, 'index.ts'),
      'mcp',
    ],
  });

  await client.connect(transport);

  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name).sort((a, b) => a.localeCompare(b));
  if (!names.includes('leyline_describe') || !names.includes('leyline_apply')) {
    console.error(`smoke: expected the leyline operations, got ${quoted(names.join(', '))}`);
    await client.close();
    return 1;
  }

  // A refusal has to survive the transport as data. The catalogue never
  // published `NoSuchRenderer`, so this is the I3 gate — and it fires at
  // validate, not propose: propose records, validate is where you find out why
  // not. It must arrive as a readable result rather than a protocol error.
  const proposed = await call(client, 'leyline_propose', {
    change: {
      kind: 'renderer.register',
      registry: 'default',
      renderer: 'NoSuchRenderer',
      match: { surfaceId: 'actions' },
      rank: 80,
    },
  });
  const validated = await call(client, 'leyline_validate', { id: proposed.json['id'] });

  if (validated.isError === true || !validated.text.includes('renderer.undiscoverable')) {
    console.error(`smoke: expected the catalogue refusal, got ${quoted(validated.text)}`);
    await client.close();
    return 1;
  }

  console.log(`ok — ${String(tools.length)} tools over stdio, and a refusal that survived as data`);
  await client.close();
  return 0;
}

process.exit(await main());
