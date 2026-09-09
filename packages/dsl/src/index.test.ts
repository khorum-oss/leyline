import { describe, expect, it } from 'vitest';
import { packageStatus } from './index.js';

describe('@leyline/dsl', () => {
  it('declares its place in the delivery sequence', () => {
    expect(packageStatus).toEqual({ package: '@leyline/dsl', deliveryStage: 5, status: 'planned' });
  });
});
