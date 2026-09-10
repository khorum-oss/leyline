/**
 * `@leyline/dsl` — the TypeScript builder that emits schema documents.
 *
 * It produces the canonical document rather than standing beside it as a second
 * source of truth (AD1). Its value is the compile-time half: node references,
 * capability names, and context fields are checked where they are written, and
 * the output then goes through exactly the validation hand-written JSON does.
 */

export { defineWorkflow, WorkflowDefinitionError, type WorkflowInput } from './define.js';
export type {
  ContextFieldSpec,
  TransitionSpec,
  EventTransitionSpec,
  SurfaceSpec,
  InvokeSpec,
  StepSpec,
  HubSpec,
  SectionSpec,
  NodeSpec,
} from './types.js';
