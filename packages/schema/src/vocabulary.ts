/**
 * The semantic vocabulary (brief §6, §8).
 *
 * Every surface type added becomes a permanent obligation for every renderer
 * registry. Nothing joins this list until two independent real workflows need
 * it, and the addition ships with the reasoning recorded in docs/decisions.
 */

/** Node kinds in v1. */
export const NODE_KINDS = ['step', 'hub'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** Surface types in v1 (open question OQ5 — see docs/open-questions.md). */
export const SURFACE_TYPES = ['form', 'datatable', 'metric-panel', 'link', 'text'] as const;
export type SurfaceType = (typeof SURFACE_TYPES)[number];

/** The three kinds of capability a schema may require of a bundle (AD2). */
export const CAPABILITY_KINDS = ['guard', 'service', 'dataSource'] as const;
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];

/** The identities a change may be attributed to (brief §6, safe defaults §8). */
export const INITIATOR_KINDS = ['application', 'developer', 'agent'] as const;
export type InitiatorKind = (typeof INITIATOR_KINDS)[number];

export function isNodeKind(value: string): value is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(value);
}

export function isSurfaceType(value: string): value is SurfaceType {
  return (SURFACE_TYPES as readonly string[]).includes(value);
}
