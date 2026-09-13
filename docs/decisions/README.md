# Architectural decisions

AD1–AD15 arrived with the project brief and count as settled. A specification
implements them rather than re-opening them, unless implementation surfaces a
concrete blocker — in which case the blocker gets recorded here as a superseding
decision.

A decision record assumes the project vocabulary; [`../glossary.md`](../glossary.md)
defines it, and a record introducing a new term adds it there in the same change.

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

| ID                                                   | Decision                                                                   | Closes                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [0016](0016-minimum-surface-set.md)                  | The v1 surface set                                                         | OQ5                                                            |
| [0017](0017-structure-errors-vocabulary-warnings.md) | Structure is an error; vocabulary is a warning                             | —                                                              |
| [0018](0018-identifier-derivation.md)                | Derived identifiers come from identity, never from presentation            | —                                                              |
| [0019](0019-section-nodes.md)                        | The `section` node kind                                                    | —                                                              |
| [0020](0020-personalization.md)                      | Personalization is control-plane traffic                                   | —                                                              |
| [0021](0021-trace-retention-and-export.md)           | Trace retention and export                                                 | OQ6                                                            |
| [0022](0022-guard-event-volume.md)                   | Guard evaluations emit like everything else                                | OQ8                                                            |
| [0023](0023-renderer-catalogue.md)                   | Renderers are discoverable through a catalogue                             | OQ3                                                            |
| [0024](0024-policy-shape.md)                         | Policy is one predicate, with combinators                                  | OQ2                                                            |
| [0025](0025-live-changes.md)                         | Changes are classified by what they disturb                                | —                                                              |
| [0026](0026-revert-by-replay.md)                     | Revert replays the log                                                     | —                                                              |
| [0027](0027-confirmation-flow.md)                    | Confirmation is a pending proposal                                         | OQ4                                                            |
| [0028](0028-persistence.md)                          | Persistence is a sink plus hydrate                                         | OQ1                                                            |
| [0029](0029-change-log-and-stream.md)                | The change log is kept alongside the stream, and tested against it         | —                                                              |
| [0030](0030-react-rendering-contract.md)             | Regions are claimable, and slots are functions                             | the region-claiming debt left by [0019](0019-section-nodes.md) |
| [0031](0031-initiator-trust.md)                      | An initiator label is advisory; attestation is a fact about the connection | OQ7                                                            |
| [0032](0032-canonical-form.md)                       | Canonical form is the authored document, not the normalized one            | —                                                              |
| [0033](0033-render-plan.md)                          | The render plan lives in the core                                          | —                                                              |

## Recording a new decision

Copy `template.md` to `NNNN-short-title.md`, numbering from 0016 so the sequence
continues past the brief's fifteen. A decision that closes one of the open
questions in `../open-questions.md` links back to it, and the open question gets
struck through with a pointer forward.
