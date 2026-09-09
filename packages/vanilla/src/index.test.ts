import { describe, expect, it } from 'vitest';
import { observe } from './index.js';
import { createFakeStore } from '@leyline/core/testing';

describe('observe', () => {
  it('renders the current snapshot immediately', () => {
    const store = createFakeStore({ status: 'idle' });
    const seen: unknown[] = [];
    observe(store, (snapshot) => seen.push(snapshot));
    expect(seen).toEqual([{ status: 'idle' }]);
  });

  it('renders again on every change', () => {
    const store = createFakeStore({ status: 'idle' });
    const seen: unknown[] = [];
    observe(store, (snapshot) => seen.push(snapshot));
    store.push({ status: 'running' });
    expect(seen).toEqual([{ status: 'idle' }, { status: 'running' }]);
  });

  it('stops rendering once unsubscribed', () => {
    const store = createFakeStore({ status: 'idle' });
    const seen: unknown[] = [];
    const stop = observe(store, (snapshot) => seen.push(snapshot));
    stop();
    store.push({ status: 'running' });
    expect(seen).toHaveLength(1);
  });
});
