---
'@leyline/core': patch
---

`TRACE_KINDS`, `TraceKind`, and `TraceEvent` are now re-exported from `@leyline/schema` rather than declared a second time in the core. The public API is unchanged; the definition is now singular, and published as JSON Schema alongside the other control-plane contracts.
