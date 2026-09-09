/**
 * The semantic vocabulary (brief §6, §8).
 *
 * Every surface type added becomes a permanent obligation for every renderer
 * registry. Nothing joins this list until two independent real workflows need
 * it, and the addition ships with the reasoning recorded in docs/decisions.
 */

/**
 * Node kinds in v1.
 *
 * `step` performs work and moves on; `hub` is a stable destination offering
 * options; `section` contains other nodes and governs how they run together.
 */
export const NODE_KINDS = ['step', 'hub', 'section'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** Surface types in v1 (open question OQ5 — see docs/open-questions.md). */
export const SURFACE_TYPES = ['form', 'datatable', 'metric-panel', 'link', 'text'] as const;
export type SurfaceType = (typeof SURFACE_TYPES)[number];

/** The three kinds of capability a schema may require of a bundle (AD2). */
export const CAPABILITY_KINDS = ['guard', 'service', 'dataSource'] as const;
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];

/**
 * The identities a change may be attributed to (brief §6, safe defaults §8).
 *
 * `user` is an end user rearranging their own view of an application that chose
 * to offer that. It is separate from `application` because policy needs to tell
 * them apart: an application may reorder anything, a user typically only their
 * own presentation (decision 0020).
 */
export const INITIATOR_KINDS = ['application', 'developer', 'agent', 'user'] as const;
export type InitiatorKind = (typeof INITIATOR_KINDS)[number];

export function isNodeKind(value: string): value is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(value);
}

export function isSurfaceType(value: string): value is SurfaceType {
  return (SURFACE_TYPES as readonly string[]).includes(value);
}

/**
 * How the children of a `section` node run together.
 *
 * `one` keeps exactly one child active — a wizard inside a panel, or an input
 * box moving through idle, editing, validating, and error. `many` keeps every
 * child active and advancing independently — a page whose sidebar, main panel,
 * and notifications each hold their own state.
 *
 * Two words cover the whole range, and both map directly onto statechart
 * compound and parallel states (AD3), so the interpreter inherits the semantics
 * rather than inventing them.
 */
export const SECTION_MODES = ['one', 'many'] as const;
export type SectionMode = (typeof SECTION_MODES)[number];

export function isSectionMode(value: string): value is SectionMode {
  return (SECTION_MODES as readonly string[]).includes(value);
}
