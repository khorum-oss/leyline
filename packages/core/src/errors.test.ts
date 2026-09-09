import { describe, expect, it } from 'vitest';
import { CapabilityBindingError, LeylineError } from './errors.js';

describe('LeylineError', () => {
  it('carries a code and structured issues', () => {
    const error = new LeylineError('graph.dangling', 'Transition target does not exist', [
      {
        rule: 'graph.dangling-target',
        path: '/nodes/1/on/NEXT',
        identifier: 'missing-node',
        message: 'x',
      },
    ]);
    expect(error.toJSON()).toMatchObject({
      code: 'graph.dangling',
      issues: [{ path: '/nodes/1/on/NEXT' }],
    });
  });
});

describe('CapabilityBindingError (G8)', () => {
  it('reports every missing capability at once, each naming its path', () => {
    const error = new CapabilityBindingError([
      { kind: 'guard', name: 'isPaidTier', path: '/nodes/hub/surfaces/1/when' },
      { kind: 'service', name: 'createWorkspace', path: '/nodes/create/invoke' },
    ]);
    expect(error.missing).toHaveLength(2);
    expect(error.message).toContain('isPaidTier');
    expect(error.message).toContain('createWorkspace');
    expect(error.issues.every((issue) => issue.path !== undefined)).toBe(true);
    expect(error.issues[0]?.suggestion).toContain('capability bundle');
  });
});
