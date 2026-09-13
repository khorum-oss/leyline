import { useEffect, useState, type ReactElement } from 'react';
import { WorkflowView } from '@leyline/react';
import type { TraceEvent, WorkflowInstance } from '@leyline/core';
import { HIDE_METRICS_ON_FREE, SWAP_TO_CARDS, applyChange } from '@leyline-examples/scenario';
import { start, type WorkspaceContext } from './workflow.js';

type Workflow = WorkflowInstance<WorkspaceContext>;

const AGENT = { kind: 'agent', label: 'demo' } as const;

export function App(): ReactElement {
  const [workflow, setWorkflow] = useState<Workflow | undefined>();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [note, setNote] = useState('');
  const [tier, setTier] = useState('paid');

  useEffect(() => {
    let live = true;
    void start(tier).then((next) => {
      if (!live) return;
      setWorkflow(next);
      setEvents([]);
      next.trace.attach((event) => setEvents((seen) => [...seen.slice(-40), event]));
    });
    return () => {
      live = false;
    };
  }, [tier]);

  if (!workflow) return <p>Starting…</p>;

  // Every button below is a proposal, a validation, and an apply — reaching the
  // same control plane an agent reaches, and meeting the same policy.
  const act = (description: unknown) => () => {
    void applyChange(workflow, description, AGENT).then(setNote);
  };

  return (
    <main>
      <header>
        <h1>Workspace onboarding</h1>
        <p>
          The brief&rsquo;s §2 scenario. The controls below reach the same control plane an agent
          would, and meet the same policy.
        </p>
      </header>

      <nav className="controls">
        <label>
          Tier
          <select value={tier} onChange={(event) => setTier(event.target.value)}>
            <option value="free">free (skips billing)</option>
            <option value="paid">paid</option>
            <option value="organization">organization</option>
          </select>
        </label>

        <button type="button" onClick={act(SWAP_TO_CARDS)}>
          Swap the table for cards
        </button>

        <button type="button" onClick={act(HIDE_METRICS_ON_FREE)}>
          Hide metrics on free tiers
        </button>

        <button
          type="button"
          onClick={() => {
            const last = workflow.control.log().at(-1);
            if (!last) return setNote('nothing to revert');
            void workflow.control.revert(last.id).then(
              (record) => setNote(`reverted ${record.id}`),
              (error: unknown) => setNote(String(error)),
            );
          }}
        >
          Revert the last change
        </button>
      </nav>

      {note ? <p className="note">{note}</p> : null}

      <div className="view">
        <WorkflowView workflow={workflow} />
      </div>

      <section className="trace">
        <h2>Trace</h2>
        <ol>
          {events.map((event) => (
            <li key={`${event.seq}`}>
              <code>{event.kind}</code> <span className="dim">{event.correlationId}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
