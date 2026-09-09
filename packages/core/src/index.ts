/**
 * `@leyline/core` — the headless Leyline runtime.
 *
 * Zero framework dependencies (G4). Distributed as compiled JavaScript with
 * TypeScript declarations, usable directly from plain JS. Every adapter bridges
 * the store contract here to its own reactivity; anything an adapter would have
 * to duplicate belongs in this package instead (G5).
 *
 * Delivery stage 2 fills in: the interpreter over the XState facade, the store,
 * capability binding and verification, control-plane-addressable registries,
 * the trace emitter with ring-buffer and console sinks, the change log derived
 * from the trace stream, propose/validate/apply/revert, policy and redaction
 * hooks, and the AD14 invariant test suites.
 */

export {
  LeylineError,
  CapabilityBindingError,
  type LeylineIssue,
  type MissingCapability,
} from './errors.js';

export { walkRegions, activeSurfaces } from './contracts.js';

export type {
  Snapshot,
  ActiveRegion,
  ResolvedSurface,
  WorkflowStatus,
  WorkflowEvent,
  Store,
  Initiator,
  CapabilityBundle,
  RuntimeMode,
} from './contracts.js';

export type {
  Change,
  Proposal,
  ValidationResult,
  ChangeRecord,
  PolicyDecision,
  Policy,
  OperationDescriptor,
  ControlPlane,
  Description,
} from './control-plane.js';

export {
  TRACE_KINDS,
  type TraceKind,
  type TraceEvent,
  type TraceSink,
  type RedactionHook,
  type TraceStream,
} from './trace.js';
