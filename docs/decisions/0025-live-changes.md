# 0025. Changes are classified by what they disturb

- **Status:** accepted
- **Date:** 2026-09-10

## Context

A change arrives at a workflow that is already running, with a viewer somewhere
inside it. Some changes only alter how the current state is presented; others
alter the state graph itself. Treating them alike means either restarting for a
guard attachment, or quietly running an interpreter built from a document that
no longer exists.

## Decision

Every change carries an **impact**, reported on the change record and on the
`control.applied` trace event.

- `registry` — a renderer registration. Nothing but resolution changes.
- `presentation` — attaching or detaching a guard, reordering a section's
  children. The document changes; the state graph does not. The next snapshot
  simply resolves differently.
- `context` — a context patch. Rebuilds, because context belongs to the
  interpreter and a guard must not evaluate against a context the snapshot no
  longer shows.
- `graph` — moving a child between sections, replacing the workflow. Rebuilds.

A rebuild hands the new interpreter the position the old one held. Where that
position is still valid it is restored; where it is not — a node that moved out
from under the viewer — the region falls back to its entry rather than failing.
A viewer who moves a panel stays where they were.

**Reading order is the document's, not the interpreter's.** A reorder changes the
document alone, so the snapshot must take child order from there. This surfaced
as a failing test: without it, reordering changed the document and the page did
not move.

## Consequences

"Hide the metrics panel" is instant and disturbs nothing else, which is what
made the §2 agent scenario work as one call.

A context patch costs a rebuild. It is the heavier option and the only one that
stays consistent; patches are rare enough that the cost is worth the property.

Every graph change validates the resulting document before committing, so a move
creating a containment cycle or orphaning a region is refused with the rule that
caught it.

## Alternatives considered

**Require an explicit restart for graph changes.** Rejected: a viewer who moves
a panel would see nothing happen until something else restarted the workflow.

**Apply a context patch as an overlay beside the interpreter's context.**
Rejected: guards inside the interpreter would evaluate against the unpatched
value while the snapshot showed the patched one — two truths, and the wrong one
in the place that makes decisions.
