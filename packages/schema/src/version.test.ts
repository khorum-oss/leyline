import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, isSupportedSchemaVersion, parseSchemaVersion } from './version.js';

describe('schema version', () => {
  it('parses a well-formed version', () => {
    expect(parseSchemaVersion('1.4.2')).toEqual({ major: 1, minor: 4, patch: 2 });
  });

  it('rejects a malformed version', () => {
    expect(parseSchemaVersion('1.4')).toBeUndefined();
    expect(parseSchemaVersion('v1.4.2')).toBeUndefined();
  });

  it('reads its own version', () => {
    expect(isSupportedSchemaVersion(SCHEMA_VERSION)).toBe(true);
  });

  it('reads a later minor version, since evolution stays additive', () => {
    expect(isSupportedSchemaVersion('1.99.0')).toBe(true);
  });

  it('refuses a different major version', () => {
    expect(isSupportedSchemaVersion('2.0.0')).toBe(false);
  });
});
