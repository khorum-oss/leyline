import { describe, expect, it } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createFakeStore } from '@leyline/core/testing';
import { useLeylineStore } from './index.js';

// React requires this flag before `act` may be used outside a test renderer.
(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true;

interface TestSnapshot {
  status: string;
}

function renderHook(store: Parameters<typeof useLeylineStore<TestSnapshot>>[0]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function Probe(): ReactElement {
    const snapshot = useLeylineStore(store);
    return <span data-testid="status">{snapshot.status}</span>;
  }

  act(() => root.render(<Probe />));
  return {
    text: () => container.textContent,
    unmount: () => act(() => root.unmount()),
  };
}

describe('useLeylineStore', () => {
  it('reads the current snapshot', () => {
    const store = createFakeStore<TestSnapshot>({ status: 'idle' });
    const view = renderHook(store);
    expect(view.text()).toBe('idle');
    view.unmount();
  });

  it('re-renders when the store publishes a new snapshot', () => {
    const store = createFakeStore<TestSnapshot>({ status: 'idle' });
    const view = renderHook(store);
    act(() => store.push({ status: 'running' }));
    expect(view.text()).toBe('running');
    view.unmount();
  });

  it('unsubscribes on unmount', () => {
    const store = createFakeStore<TestSnapshot>({ status: 'idle' });
    const view = renderHook(store);
    expect(store.listenerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(store.listenerCount()).toBe(0);
  });
});
