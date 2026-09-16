#!/usr/bin/env node
import { openSession } from './session.js';
import { runDemo } from './demo.js';
import { runRepl } from './repl.js';
import { bold, dim } from './format.js';

/**
 * Brief §2 items 6 and 7, driven by an agent — with or without a model.
 *
 *   demo   scripted, no API key, no network. What CI runs.
 *   repl   you typing tool calls by hand. Still no API key.
 *   mcp    a local `claude` or `codex` drives it, on its own sign-in.
 *   chat   a real model, through ANTHROPIC_API_KEY.
 *
 * All four call `surface.handle(name, input)` and nothing else. If they needed
 * different code paths, `@leyline/agent` would have failed at its one job.
 */

const USAGE = `
${bold('leyline-agent')} — drive a Leyline workflow through the agent surface

  ${bold('pnpm demo')}   a scripted run. No API key, no network. Two of the steps
               are refusals, and they are the interesting ones.
  ${bold('pnpm repl')}   type tool calls yourself. Still no API key.
  ${bold('pnpm mcp')}    serve over MCP on stdio, so a local ${bold('claude')} or ${bold('codex')}
               drives it with the sign-in it already has. No API key.
  ${bold('pnpm chat')}   a real model. Needs ANTHROPIC_API_KEY.

  ${dim('--tier free|paid|organization    which tier to start in (default: free)')}
`;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const mode = argv.find((arg) => !arg.startsWith('-')) ?? 'demo';
  // Free by default, because it is the tier where the guard in step 5 has a
  // visible effect: `needsBilling` is false, so the metrics panel disappears.
  const tierFlag = argv.indexOf('--tier');
  const tier = tierFlag === -1 ? 'free' : (argv[tierFlag + 1] ?? 'free');

  if (mode === 'help' || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }

  const session = await openSession(tier);

  if (mode === 'demo') {
    await runDemo(session);
    return 0;
  }

  if (mode === 'repl') {
    await runRepl(session);
    return 0;
  }

  if (mode === 'mcp') {
    // Lazily imported, like the SDK below: `demo` and `repl` load neither.
    const { runMcp } = await import('./mcp.js');
    await runMcp(session);
    return 0;
  }

  if (mode === 'chat') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (apiKey === undefined || apiKey === '') {
      console.error('chat mode needs ANTHROPIC_API_KEY.');
      console.error(dim('Run `pnpm demo` or `pnpm repl` to see the same surface without one,'));
      console.error(dim('or `pnpm mcp` to let a local claude/codex CLI drive it instead.'));
      return 1;
    }
    // Imported lazily so the modes that need no model never load the SDK.
    const { runChat } = await import('./chat.js');
    await runChat(session, apiKey);
    return 0;
  }

  console.error(`Unknown mode "${mode}".`);
  console.log(USAGE);
  return 1;
}

try {
  process.exit(await main());
} catch (error) {
  console.error(error);
  process.exit(1);
}
