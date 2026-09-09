import { describe, expect, it } from 'vitest';
import { packageStatus } from './index.js';

describe('@leyline/agent', () => {
  it('declares its place in the delivery sequence', () => {
    expect(packageStatus.deliveryStage).toBe(4);
  });
});
