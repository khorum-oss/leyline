import { describe, expect, it } from 'vitest';
import { fixtureJson, fixtureText } from './fixtures.js';
import { parseWorkflow, validateWorkflow } from './validate.js';
import type { Issue } from './issues.js';

const rules = (issues: readonly Issue[]): string[] => issues.map((issue) => issue.rule);

describe('the reference workflow (brief §2)', () => {
  it('validates with no errors', () => {
    const result = validateWorkflow(fixtureJson('workspace-onboarding'));
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('reports no warnings either, so the corpus stays a clean baseline', () => {
    const result = validateWorkflow(fixtureJson('workspace-onboarding'));
    expect(rules(result.issues)).toEqual([]);
  });

  it('round-trips: parsing and re-serializing reproduces the file byte for byte', () => {
    const text = fixtureText('workspace-onboarding');
    const parsed = parseWorkflow(JSON.parse(text));
    expect(parsed.ok).toBe(true);
    expect(`${JSON.stringify(parsed.document, null, 2)}\n`).toBe(text);
  });

  it('expresses the scenario: billing is guarded, the free tier skips it', () => {
    const { document } = validateWorkflow(fixtureJson('workspace-onboarding'));
    const create = document?.nodes.find((node) => node.id === 'create-workspace');
    const onDone = create?.invoke?.onDone ?? [];
    expect(onDone.map((t) => [t.target, t.when ?? null])).toEqual([
      ['billing', 'needsBilling'],
      ['workspace-hub', null],
    ]);
  });

  it('expresses the scenario: the action-two link carries its own guard', () => {
    const { document } = validateWorkflow(fixtureJson('workspace-onboarding'));
    const hub = document?.nodes.find((node) => node.id === 'workspace-hub');
    const link = hub?.surfaces?.find((surface) => surface.target === 'action-two');
    expect(link?.when).toBe('canRunActionTwo');
  });

  it('carries no executable content anywhere: every leaf is a string, number, or boolean (I1)', () => {
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value !== null && typeof value === 'object') {
        return Object.values(value).forEach(walk);
      }
      expect(['string', 'number', 'boolean']).toContain(typeof value);
    };
    walk(fixtureJson('workspace-onboarding'));
  });
});
