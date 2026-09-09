# @leyline/dsl

The TypeScript builder that emits schema documents.

It produces the canonical document rather than standing beside it as a second
source of truth (AD1). Its value lies in compile-time checking of node
references, context shape, and capability names (G3); its output then goes
through the same validation as hand-written JSON.

See the [glossary](../../docs/glossary.md#the-document) for the document
vocabulary this builder emits.

## Next — delivery stage 5

The builder itself. The fixture corpus it validates against is shared with the
planned Kotlin DSL (brief §10): both must emit byte-comparable documents for the
same reference workflows.
