---
'@leyline/dsl': minor
'@leyline/schema': minor
---

`@leyline/dsl`: a builder that checks node references, capability names, and context fields where they are written, by accumulating what the workflow declared into type unions. Output is byte-identical to a hand-written document.

`@leyline/schema` gains `serializeWorkflow`, which makes canonical form a published function rather than a convention — the authored document, with identifiers an author left out still left out.
