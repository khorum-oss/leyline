---
'@leyline/core': minor
'@leyline/schema': patch
---

The headless runtime: `createWorkflow` binds a document to a capability bundle, verifies every requirement up front, and runs it over the statechart facade. Snapshots expose an active region tree with resolved surfaces and prop-getters, sharing structure so identity comparison is a valid change check.

The trace stream ships with ring-buffer and console sinks, a redaction hook that runs before any consumer sees a payload, per-kind filtering, and `export()`. Sinks may be attached at construction, so binding and the first service invocation are observable.

`@leyline/schema` exports a `JsonValue` type for payloads.
