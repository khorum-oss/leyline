# @leyline/core

The headless Leyline runtime. Zero framework dependencies (G4), shipped as
compiled JavaScript with declarations so plain JS gets the same API.

Every adapter bridges the store contract here to its own reactivity. Anything an
adapter would otherwise duplicate belongs in this package instead (G5).

## Present

- The public runtime contract: snapshot, resolved surfaces, store, capability
  bundle, runtime mode
- The control-plane contract: changes, proposals, validation results, change
  records, policy decisions, operation descriptors
- The trace stream contract: envelope, kinds, sinks, redaction hook (AD15)
- Structured errors that name the path and identifier at fault
- `@leyline/core/testing` — a conformance double every adapter tests against

## Next — delivery stage 2

The interpreter over the XState facade, the store, capability binding and
verification, control-plane-addressable registries, the trace emitter with
ring-buffer and console sinks, the change log projected from the stream,
propose/validate/apply/revert, policy and redaction hooks, and the AD14
invariant suites.

## The engine facade

`src/engine/` is the only directory in the repository permitted to name XState
(AD3). The public API and the schema never expose its types or concepts, which
keeps the option of replacing it with a smaller purpose-built interpreter later.
Lint enforces the boundary.
