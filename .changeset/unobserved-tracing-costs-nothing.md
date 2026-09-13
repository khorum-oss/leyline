---
'@leyline/core': patch
---

`@leyline/core`: describing a transition now costs nothing when nothing is
reading the trace stream. The engine flattened the active tree twice and
compared the results on every published snapshot, and the only consumer of that
work was a `workflow.transition` event that an unobserved stream then discarded.
The engine observer's `guardTracingEnabled()` becomes `tracingEnabled(kind)` and
both hot paths ask it before assembling an argument (AD15).
