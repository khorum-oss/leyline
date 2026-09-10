# @leyline/core

The headless Leyline runtime. Zero framework dependencies (G4), shipped as
compiled JavaScript with declarations so plain JS gets the same API.

Every adapter bridges the store contract here to its own reactivity. Anything an
adapter would otherwise duplicate belongs in this package instead (G5).

Terms used below — **store contract**, **snapshot**, **resolved surface**,
**control plane**, **trace event** — are defined in the
[glossary](../../docs/glossary.md#the-runtime).

## Present

- `createWorkflow`: validation, capability binding, the interpreter, and the
  store, with no DOM anywhere
- The statechart engine behind the facade — a `section` in `one` mode is a
  compound state, `many` is a parallel state, and every node carries its
  identifier so transitions target it absolutely
- Snapshots with structural sharing, resolved surfaces, and prop-getters
- The trace emitter with ring-buffer and console sinks, redaction, per-kind
  filtering, and `export()`
- The control plane: propose, validate, apply, revert, confirm, hydrate, and
  `describe()` that reads like documentation
- Ranked renderer registries over a catalogue the application publishes
- Policy with combinators, and safe defaults per runtime mode
- The public runtime contract: snapshot, resolved surfaces, store, capability
  bundle, runtime mode
- The control-plane contract: changes, proposals, validation results, change
  records, policy decisions, operation descriptors
- The trace stream contract: envelope, kinds, sinks, redaction hook (AD15)
- Structured errors that name the path and identifier at fault
- `@leyline/core/testing` — a conformance double every adapter tests against

```ts
const workflow = createWorkflow(document, capabilityBundle, {
  mode: 'development',
  initialContext: { tier: 'paid' },
  sinks: [consoleSink()],
});

workflow.getSnapshot(); // { root, context, status }
workflow.subscribe(render);
workflow.send({ type: 'CONTINUE' });
workflow.trace.export(); // a bundle to attach to a bug report
```

Binding verifies the document's requirements against the bundle and throws a
single error naming every gap. A document that does not validate never reaches
the interpreter, so nothing downstream has an error path for a dangling target.

Sinks passed at construction see the whole stream. Binding and the entry node's
first service invocation happen inside `createWorkflow`, so a sink attached
afterwards would miss them.

## The control plane

```ts
const proposal = await workflow.control.propose(
  {
    kind: 'renderer.register',
    registry: 'default',
    renderer: 'CardGrid',
    match: { surfaceId: 'actions' },
    rank: 80,
  },
  { kind: 'agent', label: 'card-grid-swap' },
);

await workflow.control.validate(proposal); // a dry run; nothing is committed
const record = await workflow.control.apply(proposal);
await workflow.control.revert(record.id);
```

Policy is consulted at proposal time, before validation and apply and revert
alike, and no operation skips it — including changes an application proposes
about itself. With none configured, development is permissive and production
refuses agent and end-user initiators.

Changes are classified by what they disturb. A guard attachment or a renderer
registration applies live; a context patch or a graph change rebuilds the
interpreter and restores the position it held.

Persistence is the application's: store the records `log()` returns, hand them
back to `hydrate()`, and each one meets policy again on the way in.

## Next — delivery stage 3

The React adapter's registry bridge and `WorkflowView`.

## The engine facade

`src/engine/` is the only directory in the repository permitted to name XState
(AD3). The public API and the schema never expose its types or concepts, which
keeps the option of replacing it with a smaller purpose-built interpreter later.
Lint enforces the boundary.
