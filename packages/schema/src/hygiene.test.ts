import { describe, expect, it } from 'vitest';
import { findHygieneIssues, parseDocumentJson } from './hygiene.js';

describe('prototype hygiene (I7)', () => {
  it('reports a forbidden key with its path', () => {
    // Written as raw JSON on purpose: an object literal would assign the
    // prototype rather than create the own property a hostile payload carries.
    const document: unknown = JSON.parse(
      '{"nodes":[{"id":"hub","surfaces":{"__proto__":{"polluted":true}}}]}',
    );
    const issues = findHygieneIssues(document);
    expect(issues).toEqual([
      { path: '/nodes/0/surfaces/__proto__', key: '__proto__', rule: 'forbidden-key' },
    ]);
  });

  it('finds nothing in a clean document', () => {
    expect(findHygieneIssues({ nodes: [{ id: 'hub', surfaces: [] }] })).toEqual([]);
  });

  it('drops a prototype key while parsing', () => {
    const parsed = parseDocumentJson('{"__proto__": {"polluted": true}, "id": "hub"}') as Record<
      string,
      unknown
    >;
    expect(Object.getOwnPropertyNames(parsed)).toEqual(['id']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('leaves Object.prototype untouched after parsing a hostile payload', () => {
    parseDocumentJson('{"constructor": {"prototype": {"polluted": true}}}');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});
