import { describe, expect, it } from 'vitest';
import { documentEnvelopeSchema } from './envelope.js';
import { SCHEMA_VERSION } from './version.js';

const valid = { leylineVersion: SCHEMA_VERSION, id: 'workspace-onboarding', name: 'Onboarding' };

describe('document envelope', () => {
  it('accepts a well-formed envelope', () => {
    expect(documentEnvelopeSchema.parse(valid)).toMatchObject(valid);
  });

  it('keeps fields it does not know, so later minor versions still parse (AD8)', () => {
    const parsed = documentEnvelopeSchema.parse({ ...valid, futureField: 42 });
    expect(parsed).toHaveProperty('futureField', 42);
  });

  it('names the offending path when validation fails', () => {
    const result = documentEnvelopeSchema.safeParse({ ...valid, leylineVersion: '2.0.0' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['leylineVersion']);
    }
  });

  it('refuses an identifier carrying path structure', () => {
    const result = documentEnvelopeSchema.safeParse({ ...valid, id: '../secrets' });
    expect(result.success).toBe(false);
  });
});
