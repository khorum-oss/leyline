# @leyline/schema

The canonical, serializable Leyline contract.

The schema document holds the truth (AD1). The TypeScript DSL, an AI agent, a
code generator, and a hand-written JSON file all count as equally valid
producers. Zod holds the single definition of every type, and the published JSON
Schema is exported from it (AD9), so a non-TypeScript producer validates against
an identical contract rather than a description of one.

Terms used below — **surface**, **capability**, **requirements block**,
**derived identifier**, **issue** — are defined in the
[glossary](../../docs/glossary.md#the-document).

## What a document looks like

```ts
import { validateWorkflow } from '@leyline/schema';

const result = validateWorkflow(document);
if (!result.ok) {
  for (const issue of result.issues) {
    console.error(`${issue.severity} ${issue.rule} at ${issue.path}: ${issue.message}`);
  }
}
```

Every issue names the rule it violated, the path into the document, the
identifier at fault, and where possible a suggested fix — a shape an agent can
act on, not only a sentence a human can read.

## Validation

Structure is an error; unknown vocabulary is a warning
([0017](../../docs/decisions/0017-structure-errors-vocabulary-warnings.md)).

**Errors** — `graph.unknown-entry`, `graph.entry-not-root`,
`graph.duplicate-node`, `graph.dangling-target`, `graph.cross-boundary-target`,
`graph.unreachable-node`, `graph.unknown-child`, `graph.multiple-parents`,
`graph.containment-cycle`, `capability.undeclared`, `context.unknown-field`,
`surface.missing-target`, `section.missing-initial`, `id.ambiguous`,
`hygiene.forbidden-key`, `document.invalid-field`.

**Warnings** — `vocabulary.unknown-surface-type`, `vocabulary.unknown-node-kind`,
`document.unknown-field`, `capability.unused`, `section.empty`,
`section.mode-mismatch`, `section.stray-containment`.

A document written against a later minor version still parses and still runs;
the warnings tell a developer what this build did not understand (AD8).

## Sections

A `section` node contains other nodes and says how they run together — `one`
child at a time, or `many` at once. Children are named rather than nested, so
the `nodes` array stays flat and a transition target stays a plain identifier.

Containment is validated as its own structure: unknown children, a node claimed
by two sections, a section containing itself, an entry node sitting inside one,
and transitions that try to land inside a section they do not belong to.

Nothing in a section describes arrangement. See
[decision 0019](../../docs/decisions/0019-section-nodes.md).

## Addressing

Identifiers an author leaves out are derived by hashing what the thing _is_ —
never its position, and never its guard or props
([0018](../../docs/decisions/0018-identifier-derivation.md)). Attaching a guard
to a surface leaves its identifier untouched, which is what lets an agent
address the same surface across calls.

## The published artifacts

`schema/` holds the exported JSON Schema, one file per contract: the workflow
document, change descriptions, proposals, change records, policy decisions,
trace events, and issues. They carry the real constraints — identifier and
version rules travel as `pattern`, so a producer in another language is held to
the same rule this build enforces.

Regenerate after changing a Zod definition:

```bash
pnpm --filter @leyline/schema run schema:export
```

The test suite compares the committed artifacts against the same export
function, so skipping that step fails the build rather than shipping a contract
that disagrees with the code.

## The fixture corpus

`src/fixtures/` holds reference workflows in canonical form — what the parser
emits, byte for byte. The corpus is the coordination point with the planned
Kotlin DSL (brief §10): both authoring languages must emit byte-comparable
documents for the same workflows.

`workspace-onboarding.json` is the scenario from brief §2, which is the
acceptance benchmark for v1.

## Present

- The canonical workflow document: nodes, surfaces, transitions, invocations,
  context shape, and the requirements block
- Graph and capability validation, with structured issues
- Deterministic, opaque identifiers (AD12, I5) and prototype hygiene (I7)
- Change descriptions, proposals, change records, policy decisions, and the
  trace envelope — the vocabulary the control plane speaks (AD10, AD11, AD15)
- JSON Schema export, published and drift-checked
