import Anthropic from '@anthropic-ai/sdk';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { Session } from './session.js';
import { renderText } from './session.js';
import { bold, cyan, dim, printResult, red } from './format.js';

/**
 * A real model, driving the same surface.
 *
 * The whole adapter is the `tools` array below: `surface.tools()` already
 * carries the published JSON Schema for every operation, so it is passed
 * through verbatim rather than translated. What a model sees is the contract,
 * not a description of it.
 *
 * This is a manual tool-use loop rather than the SDK's tool runner, because the
 * loop *is* the thing worth reading here — and because it keeps the example off
 * a beta API.
 */

const MODEL = 'claude-opus-5';

const SYSTEM = `You operate a running application through Leyline, a control plane for UI workflows.

Start with leyline_describe. It tells you the workflow, every surface with its
description and current renderer, which surfaces are on screen, and the renderer
catalogue — the complete set of renderer names you are allowed to use. You cannot
introduce a renderer, a guard, a service, or any code; you may only name things
the application already published.

To change something: leyline_propose, then leyline_validate, then leyline_apply.
Propose commits nothing. Validate is a dry run. Apply commits.

A refusal is information, not an error. It names the rule you violated and often
suggests a fix. Read it and reconsider the change rather than retrying the call.

Be concise. Say what you did and what changed.`;

export async function runChat(session: Session, apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey });
  const { surface, workflow } = session;

  // The published JSON Schema, handed to the model unchanged.
  const tools: Anthropic.Tool[] = surface.tools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const rl = createInterface({ input: stdin, output: stdout });
  const messages: Anthropic.MessageParam[] = [];

  console.log(bold(`\nLeyline agent surface — ${MODEL}`));
  console.log(dim('Try: "swap the actions table for cards" or "hide metrics on free tiers".'));
  console.log(dim('The model has no access to application source. Ctrl-C or "exit" to leave.\n'));
  console.log(renderText(workflow));

  for (;;) {
    const ask = (await rl.question(`\n${cyan('you')} ❯ `)).trim();
    if (ask === '') continue;
    if (ask === 'exit' || ask === 'quit') break;

    messages.push({ role: 'user', content: ask });
    await converse(client, tools, messages, session);
    console.log(dim('\n' + renderText(workflow)));
  }

  rl.close();
}

/** What Claude said this turn: its reasoning summary, then its prose. */
function printAssistantTurn(content: readonly Anthropic.ContentBlock[]): void {
  for (const block of content) {
    if (block.type === 'thinking' && block.thinking !== '') {
      console.log(dim(`\n  ${block.thinking.replaceAll('\n', '\n  ')}`));
    }
    if (block.type === 'text') console.log(`\n${bold('claude')} ${block.text}`);
  }
}

/**
 * Runs every tool call in one turn and collects the results.
 *
 * Each goes through the same `handle` the scripted demo and the REPL use. A
 * refusal comes back as a tool result the model can read and act on, never as a
 * thrown error — the call worked; the change was rejected.
 */
async function runToolCalls(
  session: Session,
  calls: readonly Anthropic.ToolUseBlock[],
): Promise<Anthropic.ToolResultBlockParam[]> {
  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const call of calls) {
    const result = await session.surface.handle(call.name, call.input);
    printResult(call.name, result);
    results.push({
      type: 'tool_result',
      tool_use_id: call.id,
      content: JSON.stringify(result.ok ? result.value : result.error),
    });
  }
  return results;
}

/** One request. Returns undefined when the turn cannot continue. */
async function ask(
  client: Anthropic,
  tools: Anthropic.Tool[],
  messages: Anthropic.MessageParam[],
): Promise<Anthropic.Message | undefined> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive', display: 'summarized' },
      tools,
      messages,
    });
  } catch (error) {
    console.log(red(describeApiError(error)));
    return undefined;
  }

  if (response.stop_reason === 'refusal') {
    const why = response.stop_details?.explanation ?? 'no reason given';
    console.log(red(`The model declined: ${why}`));
    return undefined;
  }

  return response;
}

/** The agentic loop: ask, run whatever tools came back, ask again. */
async function converse(
  client: Anthropic,
  tools: Anthropic.Tool[],
  messages: Anthropic.MessageParam[],
  session: Session,
): Promise<void> {
  for (;;) {
    const response = await ask(client, tools, messages);
    if (response === undefined) return;

    printAssistantTurn(response.content);
    messages.push({ role: 'assistant', content: response.content });

    const calls = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (calls.length === 0) return;

    messages.push({ role: 'user', content: await runToolCalls(session, calls) });
  }
}

function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'That API key was rejected. Check ANTHROPIC_API_KEY, or run the demo mode instead.';
  }
  if (error instanceof Anthropic.RateLimitError) return 'Rate limited — try again in a moment.';
  if (error instanceof Anthropic.APIError) return `API error ${error.status}: ${error.message}`;
  return `Request failed: ${String(error)}`;
}
