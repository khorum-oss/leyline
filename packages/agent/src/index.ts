/**
 * `@leyline/agent` — the control plane, packaged for machine consumers.
 *
 * This package adds no capability the control plane lacks (G9). It packages
 * introspection that reads like documentation, operation descriptors that map
 * onto tool and MCP definitions, structured errors an agent can act on, and
 * idempotent, replayable proposals.
 *
 * Delivery stage 4 fills this in, deliberately before the second and third
 * adapters: if the control plane turns out to need framework-specific
 * knowledge, that is a core design defect worth catching early.
 */

export const packageStatus = {
  package: '@leyline/agent',
  deliveryStage: 4,
  status: 'planned',
} as const;
