# @leyline/dsl

The TypeScript builder that emits schema documents.

It produces the canonical document rather than standing beside it as a second
source of truth (AD1) — the test that gates this package asserts its output is
byte-identical to the hand-written fixture. What it adds is the compile-time
half: node references, capability names, and context fields are checked where
they are written.

See the [glossary](../../docs/glossary.md#the-document) for the document
vocabulary this builder emits.

## Authoring

```ts
const workflow = defineWorkflow({
  id: 'workspace-onboarding',
  name: 'Workspace onboarding',
  entry: 'create-workspace',

  context: {
    workspace: { type: 'object', optional: true },
    tier: { type: 'string' },
  },
  requires: {
    guards: ['needsBilling'],
    services: ['createWorkspace'],
    dataSources: ['workspaceActions'],
  },

  nodes: {
    'create-workspace': {
      kind: 'step',
      invoke: {
        service: 'createWorkspace',
        assignTo: 'workspace',
        onDone: [{ target: 'billing', when: 'needsBilling' }, { target: 'workspace-hub' }],
      },
    },
    billing: {
      kind: 'step',
      invoke: { service: 'submitBilling', onDone: [{ target: 'workspace-hub' }] },
    },
    'workspace-hub': {
      kind: 'hub',
      surfaces: [{ id: 'actions', type: 'datatable', dataSource: 'workspaceActions' }],
    },
  },
});
```

Nodes are keyed by identifier rather than an array carrying one, so the
identifier is written once and the keys become what every reference is checked
against.

## What the types catch

| Written                    | Result                                          |
| -------------------------- | ----------------------------------------------- |
| `target: 'nowhere'`        | Type error: not one of the declared nodes       |
| `entry: 'missing'`         | Type error: not one of the declared nodes       |
| `children: ['ghost']`      | Type error: not one of the declared nodes       |
| `when: 'isSecretlyAdmin'`  | Type error: not in `requires.guards`            |
| `service: 'exfiltrate'`    | Type error: not in `requires.services`          |
| `dataSource: 'allRecords'` | Type error: not in `requires.dataSources`       |
| `assignTo: 'undeclared'`   | Type error: not a field of the declared context |

Errors land on the offending property, not on the call.

An unknown **surface type** is deliberately not an error. A document written for
a later version has to remain authorable, so unknown vocabulary warns at
validation instead (AD8).

## What the types cannot catch

Anything that is a property of the whole graph: a node no path reaches, a
section containing itself, a `link` with no target, a one-at-a-time section that
does not say which child starts. `defineWorkflow` validates before returning and
throws `WorkflowDefinitionError` carrying the same structured issues validation
always produces.

## Canonical output

`defineWorkflow` returns the document as authored — identifiers left out stay
left out, because a derived identifier is derived
([decision 0032](../../docs/decisions/0032-canonical-form.md)). Write it to disk
with `serializeWorkflow` from `@leyline/schema` and it will match a hand-written
file byte for byte.

That equivalence is also the contract the planned Kotlin DSL is held to
(brief §10): both must emit the same bytes for the same reference workflows.
