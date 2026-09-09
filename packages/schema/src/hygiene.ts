/**
 * Prototype and injection hygiene (I7).
 *
 * Documents arrive from disk, a network, or an AI agent. Parsing one must never
 * reach `Object.prototype`, and no key may smuggle a prototype write through a
 * later merge or spread.
 */

/** Keys rejected anywhere in a document, at any depth. */
export const FORBIDDEN_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

export interface HygieneIssue {
  /** JSON-pointer-style path to the offending key. */
  readonly path: string;
  readonly key: string;
  readonly rule: 'forbidden-key';
}

/**
 * Walks a parsed JSON value and reports every forbidden key it finds.
 * Reading a document has no side effects: nothing here evaluates, imports, or
 * resolves anything (I1).
 */
export function findHygieneIssues(value: unknown, path = ''): HygieneIssue[] {
  const issues: HygieneIssue[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => issues.push(...findHygieneIssues(entry, `${path}/${index}`)));
    return issues;
  }
  if (value === null || typeof value !== 'object') return issues;

  for (const key of Object.getOwnPropertyNames(value)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      issues.push({ path: `${path}/${key}`, key, rule: 'forbidden-key' });
      continue;
    }
    issues.push(...findHygieneIssues((value as Record<string, unknown>)[key], `${path}/${key}`));
  }
  return issues;
}

/**
 * Parses JSON with a reviver that drops forbidden keys, so a hostile payload
 * cannot pollute a prototype even before validation reports it.
 */
export function parseDocumentJson(text: string): unknown {
  return JSON.parse(text, function reviver(key, value) {
    if (FORBIDDEN_KEYS.includes(key)) return undefined;
    return value;
  });
}
