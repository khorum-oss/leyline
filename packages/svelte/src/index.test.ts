import { describe, expect, it } from 'vitest';
import { toSvelteStore } from './index.js';
import { createFakeStore } from '@leyline/core/testing';

describe('toSvelteStore', () => {
  it('calls the subscriber with the current value on subscribe', () => {
    const store = toSvelteStore(createFakeStore({ status: 'idle' }));
    const seen: unknown[] = [];
    store.subscribe((value) => seen.push(value));
    expect(seen).toEqual([{ status: 'idle' }]);
  });

  it('calls the subscriber again on every change', () => {
    const source = createFakeStore({ status: 'idle' });
    const seen: unknown[] = [];
    toSvelteStore(source).subscribe((value) => seen.push(value));
    source.push({ status: 'running' });
    expect(seen).toEqual([{ status: 'idle' }, { status: 'running' }]);
  });

  it('returns an unsubscribe function, as the Svelte contract requires', () => {
    const source = createFakeStore({ status: 'idle' });
    const seen: unknown[] = [];
    const unsubscribe = toSvelteStore(source).subscribe((value) => seen.push(value));
    unsubscribe();
    source.push({ status: 'running' });
    expect(seen).toHaveLength(1);
  });
});
