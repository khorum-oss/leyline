import type { CapabilityKind, Issue } from '@leyline/schema';

/**
 * Errors name the problem (brief §8).
 *
 * Every failure identifies the path and identifier at fault in a shape an agent
 * can act on, not only a sentence a human can read. The issue shape itself
 * lives in `@leyline/schema` and is published as JSON Schema, so a binding
 * failure here and a validation issue there are one format.
 */

export type LeylineIssue = Issue;

export class LeylineError extends Error {
  readonly code: string;
  readonly issues: readonly LeylineIssue[];

  constructor(code: string, message: string, issues: readonly LeylineIssue[] = []) {
    super(message);
    this.name = 'LeylineError';
    this.code = code;
    this.issues = issues;
  }

  /** The error as data, for a log line, an MCP tool result, or a devtools panel. */
  toJSON(): { code: string; message: string; issues: readonly LeylineIssue[] } {
    return { code: this.code, message: this.message, issues: this.issues };
  }
}

export interface MissingCapability {
  readonly kind: CapabilityKind;
  readonly name: string;
  /** Where the schema asked for it. */
  readonly path: string;
}

/**
 * Thrown at binding time, not at click time (G8). Reports every missing
 * capability at once so one fix round closes the gap.
 */
export class CapabilityBindingError extends LeylineError {
  readonly missing: readonly MissingCapability[];

  constructor(missing: readonly MissingCapability[]) {
    const summary = missing.map((m) => `${m.kind} "${m.name}"`).join(', ');
    super(
      'capability.binding',
      `Capability bundle is missing ${missing.length} required capability/capabilities: ${summary}`,
      missing.map((m) => ({
        severity: 'error' as const,
        rule: 'capability.missing',
        path: m.path,
        identifier: m.name,
        message: `The schema requires ${m.kind} "${m.name}", which the bundle does not supply.`,
        suggestion: `Add "${m.name}" to the ${m.kind} section of the capability bundle.`,
      })),
    );
    this.name = 'CapabilityBindingError';
    this.missing = missing;
  }
}
