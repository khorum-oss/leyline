import { describe, expect, it } from 'vitest';
import { deterministicId, isValidId } from './ids.js';

describe('deterministic identifiers (AD12)', () => {
  it('derives the same identifier from the same content', () => {
    expect(deterministicId('surface', 'workspace-hub', 'datatable', '0')).toBe(
      deterministicId('surface', 'workspace-hub', 'datatable', '0'),
    );
  });

  it('separates identifiers that differ only in part boundaries', () => {
    expect(deterministicId('node', 'ab', 'c')).not.toBe(deterministicId('node', 'a', 'bc'));
  });

  it('tags the kind without disclosing the content', () => {
    const id = deterministicId('workflow', 'workspace-onboarding');
    expect(id.startsWith('wf_')).toBe(true);
    expect(id).not.toContain('workspace');
  });

  it('produces identifiers that validate', () => {
    expect(isValidId(deterministicId('change', 'register-renderer'))).toBe(true);
  });
});

describe('identifier opacity (I5)', () => {
  it.each([
    '../../etc/passwd',
    'https://example.com/hook',
    'nodes/hub/surfaces/0',
    '__proto__',
    'a b',
    '',
  ])('rejects %j', (candidate) => {
    expect(isValidId(candidate)).toBe(false);
  });

  it('accepts a plain author-supplied name', () => {
    expect(isValidId('workspace-hub')).toBe(true);
  });
});
