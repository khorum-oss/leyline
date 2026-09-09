# Architectural decisions

AD1–AD15 arrived with the project brief and count as settled. A specification
implements them rather than re-opening them, unless implementation surfaces a
concrete blocker — in which case the blocker gets recorded here as a superseding
decision.

| ID   | Decision                                                  | Where it binds                    |
| ---- | --------------------------------------------------------- | --------------------------------- |
| AD1  | Canonical schema, DSL as a producer                       | `@leyline/schema`, `@leyline/dsl` |
| AD2  | Names, not functions, in schema                           | schema, capability binding        |
| AD3  | Statechart semantics behind an internal facade            | `@leyline/core/src/engine`        |
| AD4  | Headless core with a store contract                       | `@leyline/core`, every adapter    |
| AD5  | Ranked renderer resolution                                | adapter registries                |
| AD6  | Resolved surfaces in the snapshot                         | core interpreter                  |
| AD7  | Behaviour via prop-getters, not components                | core, adapters                    |
| AD8  | Additive-only schema evolution                            | schema, `docs/versioning.md`      |
| AD9  | Zod as the validation source of truth                     | `@leyline/schema`                 |
| AD10 | Registries and workflows mutate through one control plane | core control plane                |
| AD11 | Propose, validate, apply, revert                          | core control plane                |
| AD12 | Stable, deterministic addressing                          | `@leyline/schema/src/ids.ts`      |
| AD13 | Policy hooks on the control plane                         | core control plane                |
| AD14 | The schema is inert: the security boundary                | `SECURITY.md`, invariant suites   |
| AD15 | Observability as a single lightweight emission            | core trace stream                 |

Full statements live in [`../project-brief.md`](../project-brief.md), §5.

Decisions taken since:

| ID                                                   | Decision                                                   | Closes |
| ---------------------------------------------------- | ---------------------------------------------------------- | ------ |
| [0016](0016-minimum-surface-set.md)                  | The v1 surface set                                         | OQ5    |
| [0017](0017-structure-errors-vocabulary-warnings.md) | Structure is an error; vocabulary is a warning             | —      |
| [0018](0018-identifier-derivation.md)                | Derived identifiers come from identity, never presentation | —      |

## Recording a new decision

Copy `template.md` to `NNNN-short-title.md`, numbering from 0016 so the sequence
continues past the brief's fifteen. A decision that closes one of the open
questions in `../open-questions.md` links back to it, and the open question gets
struck through with a pointer forward.
