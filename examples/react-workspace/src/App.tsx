import { useEffect, useState, type ReactElement } from 'react';
import { WorkflowView } from '@leyline/react';
import type { TraceEvent, WorkflowInstance } from '@leyline/core';
import { start, type WorkspaceContext } from './workflow.js';

type Workflow = WorkflowInstance<WorkspaceContext>;

const AGENT = { kind: 'agent', label: 'demo' } as const;

/** Every button below is a proposal, a validation, and an apply. */
async function change(workflow: Workflow, description: unknown): Promise<string> {
  const proposal = await workflow.control.propose(description, AGENT);
  const result = await workflow.control.validate(proposal);
  if (!result.ok) return result.issues.map((issue) => issue.message).join(' ');
  const record = await workflow.control.apply(proposal);
  return `applied ${record.id}`;
}

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

  const act = (description: unknown) => () => {
    void change(workflow, description).then(setNote);
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

        <button
          type="button"
          onClick={act({
            kind: 'renderer.register',
            registry: 'default',
            renderer: 'CardGrid',
            match: { surfaceId: 'actions' },
            rank: 80,
          })}
        >
          Swap the table for cards
        </button>

        <button
          type="button"
          onClick={act({
            kind: 'surface.attach-guard',
            node: 'workspace-hub',
            surface: 'metrics',
            guard: 'needsBilling',
          })}
        >
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
