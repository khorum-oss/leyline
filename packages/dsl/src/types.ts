import type { ContextFieldType, JsonValue, SectionMode, SurfaceType } from '@leyline/schema';

/**
 * The authoring vocabulary, with every reference checked at the call site (G3).
 *
 * Each type below is generic over what the workflow declared: the node
 * identifiers, the guard, service and data-source names in `requires`, and the
 * fields in `context`. A transition to a node that does not exist, or a guard
 * nobody declared, is a type error where it is written rather than a validation
 * issue after the fact.
 *
 * Authors never write these type arguments. They are inferred from the object
 * passed to `defineWorkflow`, which is why nodes are keyed by identifier: the
 * keys are the thing everything else is checked against.
 */

export interface ContextFieldSpec {
  readonly type: ContextFieldType;
  readonly optional?: boolean;
  readonly description?: string;
}

export interface TransitionSpec<TIds extends string, TGuards extends string> {
  readonly id?: string;
  readonly target: TIds;
  readonly when?: TGuards;
  readonly description?: string;
}

export interface EventTransitionSpec<
  TIds extends string,
  TGuards extends string,
> extends TransitionSpec<TIds, TGuards> {
  readonly on: string;
}

export interface SurfaceSpec<TIds extends string, TGuards extends string, TSources extends string> {
  readonly id?: string;
  /** Open on purpose: an unknown type degrades through a fallback (AD8). */
  readonly type: SurfaceType | (string & {});
  readonly description?: string;
  readonly when?: TGuards;
  readonly dataSource?: TSources;
  /** For `link` surfaces: where it leads. */
  readonly target?: TIds;
  readonly props?: Readonly<Record<string, JsonValue>>;
}

export interface InvokeSpec<
  TIds extends string,
  TGuards extends string,
  TServices extends string,
  TFields extends string,
> {
  readonly service: TServices;
  readonly input?: Readonly<Record<string, JsonValue>>;
  /** Must name a declared context field: it is the one route into context (I4). */
  readonly assignTo?: TFields;
  readonly onDone?: readonly TransitionSpec<TIds, TGuards>[];
  readonly onError?: readonly TransitionSpec<TIds, TGuards>[];
}

interface Common<TIds extends string, TGuards extends string, TSources extends string> {
  readonly description?: string;
  readonly surfaces?: readonly SurfaceSpec<TIds, TGuards, TSources>[];
  readonly on?: readonly EventTransitionSpec<TIds, TGuards>[];
}

export interface StepSpec<
  TIds extends string,
  TGuards extends string,
  TServices extends string,
  TSources extends string,
  TFields extends string,
> extends Common<TIds, TGuards, TSources> {
  readonly kind: 'step';
  readonly invoke?: InvokeSpec<TIds, TGuards, TServices, TFields>;
}

export interface HubSpec<
  TIds extends string,
  TGuards extends string,
  TSources extends string,
> extends Common<TIds, TGuards, TSources> {
  readonly kind: 'hub';
}

export interface SectionSpec<
  TIds extends string,
  TGuards extends string,
  TSources extends string,
> extends Common<TIds, TGuards, TSources> {
  readonly kind: 'section';
  readonly mode?: SectionMode;
  /** Required when the mode runs one child at a time. */
  readonly initial?: TIds;
  readonly children: readonly TIds[];
}

export type NodeSpec<
  TIds extends string,
  TGuards extends string,
  TServices extends string,
  TSources extends string,
  TFields extends string,
> =
  | StepSpec<TIds, TGuards, TServices, TSources, TFields>
  | HubSpec<TIds, TGuards, TSources>
  | SectionSpec<TIds, TGuards, TSources>;
