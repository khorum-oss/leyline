import { describe, expect, it } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createAgentSurface } from './surface.js';
import { serveOverMcp } from './mcp.js';
import { hostWorkflow, settle, type ScenarioContext } from './testing/scenario.js';
import type { WorkflowInstance } from '@leyline/core';

/**
 * Brief §2 items 6 and 7, performed by a real MCP client over a real transport
 * (roadmap stage 4).
 *
 * The client here is not a language model, but everything between it and the
 * workflow is exactly what a model would traverse: the same tool list, the same
 * JSON Schema, the same wire format, the same surface. What is missing is the
 * token generation, which is the one part a deterministic test cannot supply.
 */

interface Connected {
  client: Client;
  workflow: WorkflowInstance<ScenarioContext>;
  close: () => Promise<void>;
}

async function connect(
  options: Parameters<typeof createAgentSurface>[1] = {},
  workflowOverrides: Record<string, unknown> = {},
): Promise<Connected> {
  const workflow = await hostWorkflow(workflowOverrides);
  const surface = createAgentSurface(workflow, options);

  const server = new Server({ name: 'leyline', version: '0.0.0' }, { capabilities: { tools: {} } });
  serveOverMcp(server, surface, {
    listToolsRequestSchema: ListToolsRequestSchema,
    callToolRequestSchema: CallToolRequestSchema,
  });

  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'probe', version: '0.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

  return { client, workflow, close: () => client.close() };
}

/** One tool call, with the JSON an agent would have parsed out of the result. */
async function call(connected: Connected, name: string, args: unknown = {}): Promise<any> {
  const result = await connected.client.callTool({ name, arguments: args as never });
  const content = (result.content as { type: string; text: string }[])[0];
  return JSON.parse(content?.text ?? 'null');
}

describe('an agent discovers what it is looking at', () => {
  it('lists the operations with their published schemas', async () => {
    const connected = await connect();
    const { tools } = await connected.client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      'leyline_describe',
      'leyline_propose',
      'leyline_validate',
      'leyline_apply',
      'leyline_revert',
      'leyline_log',
      'leyline_pending',
      'leyline_trace',
    ]);

    // The schema an agent receives is the published contract, not a translation.
    const propose = tools.find((tool) => tool.name === 'leyline_propose');
    expect(JSON.stringify(propose?.inputSchema)).toContain('LeylineChange');
    // Reads are marked, so a host can gate writes separately.
    expect(tools.find((t) => t.name === 'leyline_describe')?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === 'leyline_apply')?.annotations?.readOnlyHint).toBe(false);
    await connected.close();
  });

  it('finds the actions table and its renderer with no access to source', async () => {
    const connected = await connect();
    const described = await call(connected, 'leyline_describe');

    const actions = described.surfaces.find((s: { id: string }) => s.id === 'actions');
    expect(actions).toMatchObject({
      nodeId: 'workspace-hub',
      type: 'datatable',
      renderer: 'DataTable',
    });
    expect(actions.description).toContain('table of available actions');
    expect(actions.active).toBe(true);
    await connected.close();
  });

  it('sees which renderers it is allowed to name, and what each draws (I3)', async () => {
    const connected = await connect();
    const described = await call(connected, 'leyline_describe');

    const published = described.registries[0].catalogue;
    expect(published.map((entry: { id: string }) => entry.id)).toContain('CardGrid');
    expect(published.find((e: { id: string }) => e.id === 'CardGrid')).toMatchObject({
      description: 'The same rows as a grid of cards.',
      claims: ['datatable'],
    });
    await connected.close();
  });

  it('distinguishes what the document defines from what is on screen', async () => {
    const connected = await connect(
      {},
      { initialContext: { tier: 'free', actionTwoReady: false } },
    );
    const described = await call(connected, 'leyline_describe');

    const link = described.surfaces.find((s: { id: string }) => s.id === 'to-action-two');
    expect(link.active).toBe(false);
    expect(described.surfaces.find((s: { id: string }) => s.id === 'actions').active).toBe(true);
    await connected.close();
  });
});

describe('§2 item 6: swap the actions table for a card grid', () => {
  it('is describe, propose, validate, apply — and the running workflow changes', async () => {
    const connected = await connect();

    const proposal = await call(connected, 'leyline_propose', {
      change: {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'CardGrid',
        match: { surfaceId: 'actions' },
        rank: 80,
      },
    });
    expect(proposal.id).toMatch(/^pr_/);

    const validation = await call(connected, 'leyline_validate', { id: proposal.id });
    expect(validation.ok).toBe(true);

    const record = await call(connected, 'leyline_apply', { id: proposal.id });
    expect(record.id).toMatch(/^ch_/);

    // Observable in the application the agent never had source access to.
    const after = await call(connected, 'leyline_describe');
    expect(after.surfaces.find((s: { id: string }) => s.id === 'actions').renderer).toBe(
      'CardGrid',
    );
    await connected.close();
  });

  it('and reverting it is one more call', async () => {
    const connected = await connect();
    const proposal = await call(connected, 'leyline_propose', {
      change: {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'CardGrid',
        match: { surfaceId: 'actions' },
        rank: 80,
      },
    });
    const record = await call(connected, 'leyline_apply', { id: proposal.id });
    await call(connected, 'leyline_revert', { id: record.id });

    const after = await call(connected, 'leyline_describe');
    expect(after.surfaces.find((s: { id: string }) => s.id === 'actions').renderer).toBe(
      'DataTable',
    );
    await connected.close();
  });

  it('closes the loop: the agent confirms its own effect on the trace stream', async () => {
    const connected = await connect();
    const proposal = await call(connected, 'leyline_propose', {
      change: {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'CardGrid',
        match: { surfaceId: 'actions' },
        rank: 80,
      },
    });
    await call(connected, 'leyline_apply', { id: proposal.id });

    const events = await call(connected, 'leyline_trace', { limit: 40 });
    // The application registered a renderer at startup too, so the agent looks
    // for the most recent apply rather than the first one on the stream.
    const applied = events
      .filter((event: { kind: string }) => event.kind === 'control.applied')
      .at(-1);
    expect(applied.initiator.kind).toBe('agent');
    expect(applied.initiator.label).toBeUndefined();
    await connected.close();
  });
});

describe('§2 item 7: hide the metrics panel for free-tier workspaces', () => {
  it('attaches a guard, and the panel leaves the screen', async () => {
    const connected = await connect();
    expect(
      (await call(connected, 'leyline_describe')).surfaces.find(
        (s: { id: string }) => s.id === 'metrics',
      ).active,
    ).toBe(true);

    const proposal = await call(connected, 'leyline_propose', {
      change: {
        kind: 'surface.attach-guard',
        node: 'workspace-hub',
        surface: 'metrics',
        guard: 'needsBilling',
      },
    });
    expect((await call(connected, 'leyline_validate', { id: proposal.id })).ok).toBe(true);
    await call(connected, 'leyline_apply', { id: proposal.id });
    await settle();

    const after = await call(connected, 'leyline_describe');
    expect(after.surfaces.find((s: { id: string }) => s.id === 'metrics').active).toBe(false);
    await connected.close();
  });

  it('is refused against a guard the workflow never declared, with something to act on', async () => {
    const connected = await connect();
    const proposal = await call(connected, 'leyline_propose', {
      change: {
        kind: 'surface.attach-guard',
        node: 'workspace-hub',
        surface: 'metrics',
        guard: 'isSecretlyAdmin',
      },
    });
    const validation = await call(connected, 'leyline_validate', { id: proposal.id });

    expect(validation.ok).toBe(false);
    expect(validation.issues[0].rule).toBe('capability.undeclared');
    // The suggestion names what it may use instead, so a retry is informed.
    expect(validation.issues[0].suggestion).toContain('needsBilling');
    await connected.close();
  });
});

describe('a refusal reaches the agent as data, not as a broken call', () => {
  it('reports a denied change without failing the tool call', async () => {
    // Denying agents specifically: a blanket denial would also refuse the
    // application's own startup registrations, since there is no privileged
    // initiator.
    const connected = await connect(
      {},
      {
        policy: (proposal: { initiator: { kind: string } }) =>
          proposal.initiator.kind === 'agent'
            ? { effect: 'deny', reason: 'Agents may not change renderers here.' }
            : { effect: 'allow' },
      },
    );

    const proposal = await call(connected, 'leyline_propose', {
      change: {
        kind: 'renderer.register',
        registry: 'default',
        renderer: 'CardGrid',
        match: { surfaceId: 'actions' },
        rank: 80,
      },
    });
    const validation = await call(connected, 'leyline_validate', { id: proposal.id });
    expect(validation.ok).toBe(false);
    expect(validation.issues[0].message).toContain('may not change renderers');

    const applied = await connected.client.callTool({
      name: 'leyline_apply',
      arguments: { id: proposal.id },
    });
    // The call worked; the change was refused. Those are different things.
    expect(applied.isError).toBe(false);
    const error = JSON.parse((applied.content as { text: string }[])[0]?.text ?? '{}');
    expect(error.message).toContain('denied by policy');
    await connected.close();
  });

  it('names the available operations when asked for one that does not exist', async () => {
    const connected = await connect();
    const result = await call(connected, 'leyline_describe');
    expect(result.workflow.id).toBe('workspace-onboarding');

    const surface = createAgentSurface(connected.workflow);
    const unknown = await surface.handle('leyline_delete_everything');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.suggestion).toContain('leyline_describe');
    await connected.close();
  });
});
