/**
 * `@leyline/schema` — the canonical, serializable Leyline contract.
 *
 * The schema document is the source of truth (AD1). The TypeScript DSL, an AI
 * agent, a code generator, and a hand-written JSON file are all equally valid
 * producers. Zod holds the single definition of every type, and the published
 * JSON Schema is exported from it (AD9), so a non-TypeScript producer validates
 * against an identical contract.
 *
 * Delivery stage 1 fills in: node and surface definitions, graph validation
 * (dangling targets, unreachable nodes, undeclared capabilities), the
 * requirements block, change-description schemas, and JSON Schema export.
 */

export {
  SCHEMA_VERSION,
  SUPPORTED_MAJOR_VERSIONS,
  parseSchemaVersion,
  isSupportedSchemaVersion,
  type ParsedVersion,
} from './version.js';

export {
  NODE_KINDS,
  SURFACE_TYPES,
  CAPABILITY_KINDS,
  INITIATOR_KINDS,
  isNodeKind,
  isSurfaceType,
  type NodeKind,
  type SurfaceType,
  type CapabilityKind,
  type InitiatorKind,
} from './vocabulary.js';

export { ID_TAGS, deterministicId, isValidId, type IdKind } from './ids.js';

export {
  FORBIDDEN_KEYS,
  findHygieneIssues,
  parseDocumentJson,
  type HygieneIssue,
} from './hygiene.js';

export { documentEnvelopeSchema, type DocumentEnvelope } from './envelope.js';
