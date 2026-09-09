# 0017. Structure is an error; vocabulary is a warning

- **Status:** accepted
- **Date:** 2026-09-09

## Context

AD8 requires that a consumer meeting an unknown surface type or node kind
degrade through a fallback rather than fail. A validator that rejects unknown
vocabulary makes that impossible: the document never reaches the fallback,
because parsing already refused it.

The opposite failure is just as real. A document tolerating everything gives an
author no signal when they write `surfacs` instead of `surfaces`, and the
mistake surfaces later as a screen missing a panel nobody can account for.

## Decision

Validation reports two severities, and the split follows one rule: **a finding
that breaks the graph is an error; a finding that only means "this build is
older than this document" is a warning.**

Errors block: dangling targets, unknown entry nodes, duplicate node
identifiers, unreachable nodes, undeclared capabilities, a service result
assigned to an undeclared context field, a `link` with no target, ambiguous
derived identifiers, and any prototype-hygiene violation.

Warnings inform: unknown surface types, unknown node kinds, unknown fields on a
known object, and capabilities declared in `requires` that nothing references.

`ok` reflects errors alone. Documents parse with loose objects so unknown fields
survive a round trip, and the unknown-field warning is what gives an author the
typo feedback that strictness would otherwise have provided.

Unreachable nodes are errors rather than warnings. A node nothing can reach is
dead weight in the artifact Leyline exists to make trustworthy, and the case for
silence — a work-in-progress document — is better served by the author knowing.

## Consequences

An application deployed today keeps working against a document written for a
later minor version, reporting warnings a developer can act on at leisure.

Every issue carries `severity`, so consumers filter rather than guess. The
control plane's validation results reuse the same shape, which is what lets an
agent treat a rejected change and a stale document the same way.

## Alternatives considered

**One severity, errors only.** Rejected: it makes AD8 unimplementable.

**Strict objects with unknown fields rejected.** Rejected for the same reason;
version skew is the normal case for a deployed application, not an anomaly.
Change descriptions _are_ strict, because they travel between two parties in one
conversation where an unrecognised field means a mistake or an attempt.
