/**
 * `@leyline/schema` — the canonical, serializable Leyline contract.
 *
 * The schema document is the source of truth (AD1). The TypeScript DSL, an AI
 * agent, a code generator, and a hand-written JSON file are all equally valid
 * producers. Zod holds the single definition of every type, and the published
 * JSON Schema is exported from it (AD9), so a non-TypeScript producer validates
 * against an identical contract.
 */

// --- Versioning ------------------------------------------------------------

export {
  SCHEMA_VERSION,
  SUPPORTED_MAJOR_VERSIONS,
  parseSchemaVersion,
  isSupportedSchemaVersion,
  SUPPORTED_VERSION_PATTERN_SOURCE,
  type ParsedVersion,
} from './version.js';

// --- Vocabulary ------------------------------------------------------------

export {
  NODE_KINDS,
  SURFACE_TYPES,
  CAPABILITY_KINDS,
  INITIATOR_KINDS,
  SECTION_MODES,
  isNodeKind,
  isSurfaceType,
  isSectionMode,
  type NodeKind,
  type SurfaceType,
  type CapabilityKind,
  type InitiatorKind,
  type SectionMode,
} from './vocabulary.js';

// --- Addressing and hygiene ------------------------------------------------

export { ID_TAGS, ID_PATTERN_SOURCE, deterministicId, isValidId, type IdKind } from './ids.js';

export {
  FORBIDDEN_KEYS,
  findHygieneIssues,
  parseDocumentJson,
  type HygieneIssue,
} from './hygiene.js';

// --- Reporting -------------------------------------------------------------

export {
  SEVERITIES,
  issueSchema,
  pointer,
  hasErrors,
  type Severity,
  type Issue,
  type ValidationResult,
} from './issues.js';

// --- Document definitions --------------------------------------------------

export {
  identifierSchema,
  capabilityNameSchema,
  eventNameSchema,
  jsonValueSchema,
  propsSchema,
  type JsonValue,
} from './primitives.js';

export {
  CONTEXT_FIELD_TYPES,
  contextFieldSchema,
  contextShapeSchema,
  matchesFieldType,
  type ContextFieldType,
  type ContextShape,
} from './context.js';

export { surfaceSchema, SURFACE_KEYS, type Surface } from './surface.js';

export {
  transitionSchema,
  eventTransitionSchema,
  invokeSchema,
  TRANSITION_KEYS,
  EVENT_TRANSITION_KEYS,
  INVOKE_KEYS,
  type Transition,
  type EventTransition,
  type Invoke,
} from './transition.js';

export { nodeSchema, NODE_KEYS, type WorkflowNode } from './node.js';

export {
  buildContainment,
  enteredChildren,
  isPermittedTarget,
  type Containment,
} from './containment.js';

export {
  requirementsSchema,
  workflowDocumentSchema,
  WORKFLOW_KEYS,
  REQUIREMENTS_KEYS,
  type Requirements,
  type WorkflowDocument,
} from './workflow.js';

export { documentEnvelopeSchema, type DocumentEnvelope } from './envelope.js';

// --- Control-plane definitions ---------------------------------------------

export {
  CHANGE_KINDS,
  initiatorSchema,
  rendererMatchSchema,
  changeSchema,
  proposalSchema,
  policyDecisionSchema,
  validationOutcomeSchema,
  changeRecordSchema,
  type Initiator,
  type Change,
  type Proposal,
  type PolicyDecision,
  type ChangeRecord,
} from './changes.js';

export { TRACE_KINDS, traceEventSchema, type TraceKind, type TraceEvent } from './trace.js';

// --- Validation ------------------------------------------------------------

export { parseWorkflow, validateWorkflow } from './validate.js';
export { normalizeWorkflow, type NormalizeResult } from './normalize.js';

// --- JSON Schema export ----------------------------------------------------

export { exportJsonSchemas, workflowJsonSchema, type JsonSchemaDocument } from './json-schema.js';
