# Leyline

**Workflow knowledge belongs outside the UI.**

Application UIs accumulate knowledge that does not belong to them: which API
must finish before the next one starts, which action exists only on a paid tier,
which of three destinations a completed step leads to, which panels a screen
composes. Because that knowledge lives inside components, restyling, migrating
frameworks, or hiding a capability for some users each turn into a risky
refactor instead of a configuration change.

Leyline extracts that knowledge into a portable, declarative, framework-agnostic
layer — a serializable document describing nodes, guarded transitions, and
semantic UI intent — and leaves frameworks responsible for appearance and
interaction alone. The same document drives a React application and a SvelteKit
one. Swapping the renderer registry restyles everything without touching the
workflow.

The layer is operable by AI agents through the same control plane developers
use, with the schema held inert as a verified security boundary: an agent may
reference a guard, and may never introduce one.

> _Leyline_: the invisible lines said to connect significant places into a
> network. Nodes joined by lines, the lines themselves never rendered, the
> topology present whatever gets built on top.

## Status

**Pre-alpha, stage 0 — scaffolding.** Nothing is published yet. The workspace,
toolchain, CI gates, and documentation set exist; the packages carry their
contracts and the pieces the brief already settled. See
[`docs/roadmap.md`](docs/roadmap.md) for what lands when.

## Packages

| Package                                | Responsibility                                                                                            | Framework deps |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------- |
| [`@leyline/schema`](packages/schema)   | Zod definitions, validators, JSON Schema export, version rules, change-description schemas                | none           |
| [`@leyline/core`](packages/core)       | Interpreter, store, capability binding, registries, control plane, change log, policy hooks, trace stream | none           |
| [`@leyline/dsl`](packages/dsl)         | TypeScript builder emitting validated schema documents                                                    | none           |
| [`@leyline/agent`](packages/agent)     | Introspection, operation descriptors, MCP server adapter                                                  | none           |
| [`@leyline/react`](packages/react)     | React reactivity bridge, `WorkflowView`, registry helpers                                                 | React          |
| [`@leyline/svelte`](packages/svelte)   | Svelte store bridge and component                                                                         | Svelte         |
| [`@leyline/vanilla`](packages/vanilla) | Direct DOM adapter; reference implementation for plain JS                                                 | none           |

`@leyline/devtools` and `@leyline/otel` follow after v1.

## What it looks like

A workflow is data, not code:

```jsonc
{
  "leylineVersion": "1.0.0",
  "id": "workspace-onboarding",
  "name": "Workspace onboarding",
  "entry": "create-workspace",
  "requires": {
    "guards": ["isPaidTier"],
    "services": ["createWorkspace"],
    "dataSources": ["workspaceActions", "workspaceMetrics"],
  },
  "nodes": [
    { "id": "create-workspace", "kind": "step", "invoke": "createWorkspace" },
    {
      "id": "workspace-hub",
      "kind": "hub",
      "surfaces": [
        { "id": "actions", "type": "datatable", "dataSource": "workspaceActions" },
        { "id": "metrics", "type": "metric-panel", "dataSource": "workspaceMetrics" },
      ],
    },
  ],
}
```

Guards, services, and data sources appear as names. Implementations bind
separately, which keeps the document serializable, keeps the logic testable on
its own, and keeps an agent-authored document unable to smuggle in code.

_(Illustrative — the schema lands in stage 1.)_

## Documentation

- [Project brief](docs/project-brief.md) — the grounding document: problem,
  goals, non-goals, and the fifteen settled architectural decisions
- [Constitution](docs/constitution.md) — the obligations every change answers to
- [Roadmap](docs/roadmap.md) — the delivery sequence and its exit criteria
- [Decisions](docs/decisions/) — AD1–AD15 and everything recorded since
- [Open questions](docs/open-questions.md) — what specification still has to settle
- [Versioning](docs/versioning.md) — document versions and package versions
- [Security](SECURITY.md) — threat model and the seven invariants
- [Contributing](CONTRIBUTING.md) — setup, commands, and the merge gates

## Development

```bash
corepack enable
pnpm install
pnpm verify
```

## License

Apache-2.0. See [LICENSE](LICENSE).
