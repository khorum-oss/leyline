import type { ToolResult } from '@leyline/agent';

/** Terminal colour, when the terminal wants it. */
const tty = process.stdout.isTTY === true && process.env['NO_COLOR'] === undefined;
const paint = (code: string, text: string): string =>
  tty ? `\u001b[${code}m${text}\u001b[0m` : text;

export const dim = (text: string): string => paint('2', text);
export const bold = (text: string): string => paint('1', text);
export const green = (text: string): string => paint('32', text);
export const red = (text: string): string => paint('31', text);
export const cyan = (text: string): string => paint('36', text);

export function indent(text: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => pad + line)
    .join('\n');
}

/**
 * A tool result, printed.
 *
 * A refusal is a result, not a crash — the call worked and the change was
 * rejected, for a reason carrying the rule it violated, the path into the
 * document, and often a suggested fix. Printing it as data rather than as an
 * error is the same distinction the MCP adapter draws, and it is what tells an
 * agent to reconsider the change rather than retry the call.
 */
export function printResult(name: string, result: ToolResult): void {
  if (result.ok) {
    console.log(`${green('ok')} ${bold(name)}`);
    console.log(dim(indent(JSON.stringify(result.value, null, 2))));
    return;
  }

  console.log(`${red('refused')} ${bold(name)} — ${result.error.code}`);
  console.log(indent(result.error.message));
  for (const issue of result.error.issues) {
    console.log(dim(indent(`${issue.rule} at ${issue.path ?? '/'}: ${issue.message}`, 4)));
    if (issue.suggestion !== undefined) console.log(dim(indent(issue.suggestion, 6)));
  }
  if (result.error.suggestion !== undefined) console.log(dim(indent(result.error.suggestion, 4)));
}
