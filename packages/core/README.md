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

## Next — delivery stage 2, part two

Control-plane-addressable registries, propose/validate/apply/revert, the change
log projected from the trace stream, policy hooks with combinators, `hydrate()`
for persisted changes, and the AD14 invariant suites.

## The engine facade

`src/engine/` is the only directory in the repository permitted to name XState
(AD3). The public API and the schema never expose its types or concepts, which
keeps the option of replacing it with a smaller purpose-built interpreter later.
Lint enforces the boundary.
