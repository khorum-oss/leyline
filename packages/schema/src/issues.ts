import { z } from 'zod';

/**
 * The shared shape of everything Leyline reports (brief §8).
 *
 * Validation issues, binding failures, and rejected changes all speak this
 * format, so a log line, an MCP tool result, and a devtools panel need no
 * translation between them. Issues name the path and identifier at fault in a
 * structure an agent can act on, rather than a sentence only a human can read.
 */

export const SEVERITIES = ['error', 'warning'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const issueSchema = z
  .strictObject({
    severity: z.enum(SEVERITIES),
    /** Machine-readable rule, e.g. `graph.dangling-target`. */
    rule: z.string().min(1),
    /** JSON-pointer-style path into the offending document. */
    path: z.string().optional(),
    /** Stable identifier of the thing at fault (AD12). */
    identifier: z.string().optional(),
    message: z.string().min(1),
    /** A concrete next step, where one can be named. */
    suggestion: z.string().optional(),
  })
  .meta({
    id: 'LeylineIssue',
    title: 'Leyline issue',
    description: 'One structured finding from validation, binding, or a rejected change.',
  });

export type Issue = z.infer<typeof issueSchema>;

export interface ValidationResult<T> {
  /** True when no issue carries `error` severity. Warnings do not block. */
  readonly ok: boolean;
  readonly issues: readonly Issue[];
  /** Present when parsing succeeded, even if warnings were reported. */
  readonly document?: T;
}

/** Builds a JSON-pointer-style path from segments, escaping per RFC 6901. */
export function pointer(...segments: readonly (string | number)[]): string {
  if (segments.length === 0) return '';
  return segments
    .map((segment) => String(segment).replaceAll('~', '~0').replaceAll('/', '~1'))
    .map((segment) => `/${segment}`)
    .join('');
}

export function hasErrors(issues: readonly Issue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}
