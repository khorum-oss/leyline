import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { Session } from './session.js';
import { renderText } from './session.js';
import { bold, cyan, dim, printResult } from './format.js';

/**
 * You, at the other end of the agent surface.
 *
 * The same `surface.handle(name, input)` the scripted demo calls and the model
 * calls. Typing a tool name by hand is the cheapest way to see that an agent
 * gets no special channel — and the cheapest way to try a change and watch the
 * control plane refuse it.
 */

const HELP = `
  ${bold('tools')}                 list the operations this surface publishes
  ${bold('schema <tool>')}         the JSON Schema for one operation's input
  ${bold('view')}                  what is on screen right now
  ${bold('<tool> [json]')}         run an operation, e.g.
                          ${dim('leyline_describe')}
                          ${dim('leyline_propose {"change":{"kind":"renderer.register","registry":"default","renderer":"CardGrid","match":{"surfaceId":"actions"},"rank":80}}')}
                          ${dim('leyline_validate {"id":"..."}')}
                          ${dim('leyline_apply {"id":"..."}')}
  ${bold('help')} / ${bold('exit')}
`;

/** The built-in commands. Anything not named here is treated as a tool call. */
function builtins(session: Session): Map<string, (argument: string) => void> {
  const { surface, workflow } = session;

  return new Map([
    ['help', (): void => console.log(HELP)],
    ['view', (): void => console.log(renderText(workflow))],
    [
      'tools',
      (): void => {
        for (const tool of surface.tools()) {
          const mark = tool.mutates ? bold('writes') : dim('reads ');
          console.log(`  ${mark}  ${tool.name}`);
          console.log(dim(`          ${tool.description}`));
        }
      },
    ],
    [
      'schema',
      (name: string): void => {
        const tool = surface.tools().find((candidate) => candidate.name === name);
        console.log(tool ? JSON.stringify(tool.inputSchema, null, 2) : `No tool named "${name}".`);
      },
    ],
  ]);
}

/** Splits `leyline_apply {"id":"…"}` into a name and whatever follows it. */
function split(line: string): { name: string; argument: string } {
  const space = line.indexOf(' ');
  if (space === -1) return { name: line, argument: '' };
  return { name: line.slice(0, space), argument: line.slice(space + 1).trim() };
}

export async function runRepl(session: Session): Promise<void> {
  const { surface, workflow } = session;
  const commands = builtins(session);
  const rl = createInterface({ input: stdin, output: stdout });

  console.log(bold('\nLeyline agent surface — interactive'));
  console.log(dim('Everything here goes through the same interface a model uses.'));
  console.log(HELP);
  console.log(renderText(workflow));

  for (;;) {
    const line = (await rl.question(`\n${cyan('leyline')} ❯ `)).trim();
    if (line === '') continue;
    if (line === 'exit' || line === 'quit') break;

    const { name, argument } = split(line);

    const builtin = commands.get(name);
    if (builtin !== undefined) {
      builtin(argument);
      continue;
    }

    const input = parseInput(argument);
    if (input === INVALID) continue;

    printResult(name, await surface.handle(name, input));
    console.log(dim('\n' + renderText(workflow)));
  }

  rl.close();
}

/** Distinguishes "no argument" from "an argument that would not parse". */
const INVALID = Symbol('invalid');

function parseInput(argument: string): unknown {
  if (argument === '') return undefined;
  try {
    return JSON.parse(argument);
  } catch (error) {
    console.log(`Could not parse that as JSON: ${String(error)}`);
    return INVALID;
  }
}
