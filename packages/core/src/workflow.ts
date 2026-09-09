import {
  SCHEMA_VERSION,
  validateWorkflow,
  type Surface,
  type WorkflowDocument,
  type WorkflowNode,
} from '@leyline/schema';
import { LeylineError } from './errors.js';
import { bindCapabilities } from './binding.js';
import { createEngine, linkEventType } from './engine/xstate.js';
import type { ActiveNodes, EngineInstance } from './engine/facade.js';
import { TraceEmitter, type TraceExport } from './trace/emitter.js';
import { createRedaction } from './trace/sinks.js';
import type {
  ActiveRegion,
  CapabilityBundle,
  Initiator,
  ResolvedSurface,
  RuntimeMode,
  Snapshot,
  Store,
  WorkflowEvent,
} from './contracts.js';
import type { RedactionHook, TraceEvent, TraceKind, TraceSink } from './trace.js';

/**
 * Binding a document to a bundle and running it (AD4).
 *
 * The result is headless: no DOM, no framework, nothing to render. Every
 * adapter bridges the store contract below to its own reactivity, and anything
 * an adapter would otherwise have to compute belongs here instead (G5).
 */

export interface CreateWorkflowOptions<TContext> {
  /**
   * Named at construction, never inferred (brief §8). Production denies agent
   * initiators without a policy and redacts context values by default.
   */
  readonly mode: RuntimeMode;
  readonly initialContext?: TContext;
  readonly bufferSize?: number;
  readonly redaction?: RedactionHook;
  readonly enabledKinds?: readonly (TraceKind | string)[] | 'all';
  /**
   * Sinks attached before anything is emitted.
   *
   * Binding and the entry node's first service invocation both happen inside
   * `createWorkflow`, so a sink attached afterwards would never see them. A
   * consumer that wants the whole stream — a devtools panel, a test asserting
   * completeness, an agent watching its own effects — passes it here.
   */
  readonly sinks?: readonly TraceSink[];
  /** Who is constructing this. Defaults to the application itself. */
  readonly initiator?: Initiator;
  /** Injectable so a test can assert on timestamps. */
  readonly now?: () => number;
}

export interface TraceHandle {
  attach(sink: TraceSink): () => void;
  setRedaction(hook: RedactionHook): void;
  setEnabledKinds(kinds: readonly (TraceKind | string)[] | 'all'): void;
  recent(count?: number): readonly TraceEvent[];
  export(): TraceExport;
}

export interface WorkflowInstance<TContext extends Record<string, unknown>> extends Store<
  Snapshot<TContext>
> {
  readonly document: WorkflowDocument;
  readonly trace: TraceHandle;
  stop(): void;
}

const APPLICATION: Initiator = { kind: 'application' };

export function createWorkflow<TContext extends Record<string, unknown> = Record<string, unknown>>(
  input: unknown,
  bundle: CapabilityBundle,
  options: CreateWorkflowOptions<TContext>,
): WorkflowInstance<TContext> {
  // A document reaches the interpreter only after it validates. Everything
  // downstream may therefore assume a sound graph, which is why the interpreter
  // has no error paths for dangling targets or unknown children.
  const validation = validateWorkflow(input);
  if (!validation.ok || validation.document === undefined) {
    throw new LeylineError(
      'document.invalid',
      `The workflow document has ${validation.issues.filter((issue) => issue.severity === 'error').length} error(s).`,
      validation.issues,
    );
  }

  const document = validation.document;
  const capabilities = bindCapabilities(document, bundle);
  const initiator = options.initiator ?? APPLICATION;

  const emitter = new TraceEmitter({
    mode: options.mode,
    workflowId: document.id,
    schemaVersion: SCHEMA_VERSION,
    ...(options.bufferSize !== undefined ? { bufferSize: options.bufferSize } : {}),
    redaction: options.redaction ?? createRedaction({ mode: options.mode }),
    ...(options.enabledKinds !== undefined ? { enabledKinds: options.enabledKinds } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  for (const sink of options.sinks ?? []) emitter.attach(sink);

  let correlationSeq = 0;
  let correlationId = `co_${correlationSeq}`;
  const nextCorrelation = (): string => {
    correlationSeq += 1;
    correlationId = `co_${correlationSeq}`;
    return correlationId;
  };
  const emit = (kind: TraceKind | string, data?: Record<string, never>): void => {
    emitter.emit({ kind, correlationId, initiator, data: data ?? {} });
  };

  const byId = new Map(document.nodes.map((node) => [node.id, node] as const));
  const listeners = new Set<() => void>();

  const engine: EngineInstance<TContext> = createEngine<TContext>({
    document,
    capabilities,
    initialContext: options.initialContext ?? ({} as TContext),
    observer: {
      guardTracingEnabled: () => emitter.isEnabled('guard.evaluated'),
      onGuard: (name, result) =>
        emitter.emit({
          kind: 'guard.evaluated',
          correlationId,
          initiator,
          data: { guard: name, result },
        }),
      onTransition: (from, to, event) =>
        emitter.emit({
          kind: 'workflow.transition',
          correlationId,
          initiator,
          data: { from: [...from], to: [...to], event: event.type },
        }),
      onServiceInvoked: (name, nodeId) =>
        emitter.emit({
          kind: 'service.invoked',
          correlationId,
          initiator,
          data: { service: name, node: nodeId },
        }),
      onServiceSettled: (name, nodeId, outcome) =>
        emitter.emit({
          kind: 'service.settled',
          correlationId,
          initiator,
          data: { service: name, node: nodeId, outcome },
        }),
    },
  });

  // --- Snapshot construction ------------------------------------------------

  const guardHolds = (name: string | undefined, context: TContext, surfaceId: string): boolean => {
    if (name === undefined) return true;
    const guard = capabilities.guards.get(name) as ((c: TContext) => boolean) | undefined;
    if (guard === undefined) return true;
    const result = guard(context);
    if (emitter.isEnabled('guard.evaluated')) {
      emitter.emit({
        kind: 'guard.evaluated',
        correlationId,
        initiator,
        data: { guard: name, result, surface: surfaceId },
      });
    }
    return result;
  };

  const resolveSurface = (
    node: WorkflowNode,
    surface: Surface,
    context: TContext,
  ): ResolvedSurface | undefined => {
    const id = surface.id as string;
    if (!guardHolds(surface.when, context, id)) return undefined;

    const source = surface.dataSource
      ? (capabilities.dataSources.get(surface.dataSource) as ((c: TContext) => unknown) | undefined)
      : undefined;

    return {
      id,
      nodeId: node.id,
      type: surface.type,
      ...(surface.description !== undefined ? { description: surface.description } : {}),
      props: surface.props ?? {},
      ...(source !== undefined ? { data: source(context) } : {}),
      // Behaviour reaches an adapter as prop-getters, never as components (AD7).
      getters:
        surface.target === undefined
          ? {}
          : {
              link: () => ({
                onActivate: () => send({ type: linkEventType(id) }),
                'data-leyline-target': surface.target,
              }),
            },
    };
  };

  // Structural sharing: when context has not changed and a region was active
  // before, its previous object is reused, so an adapter's identity check is a
  // valid change check (AD4).
  let previousContext: TContext | undefined;
  let previousRegions = new Map<string, ActiveRegion<TContext>>();

  const buildRegion = (
    active: ActiveNodes,
    context: TContext,
    fresh: Map<string, ActiveRegion<TContext>>,
  ): ActiveRegion<TContext> => {
    const children = active.children.map((child) => buildRegion(child, context, fresh));
    const node = byId.get(active.id);
    const reusable = previousRegions.get(active.id);

    if (
      reusable !== undefined &&
      previousContext === context &&
      reusable.children.length === children.length &&
      reusable.children.every((child, index) => child === children[index])
    ) {
      fresh.set(active.id, reusable);
      return reusable;
    }

    const region: ActiveRegion<TContext> = {
      id: active.id,
      kind: node?.kind ?? 'step',
      ...(node?.description !== undefined ? { description: node.description } : {}),
      surfaces: (node?.surfaces ?? [])
        .map((surface) => resolveSurface(node as WorkflowNode, surface, context))
        .filter((surface): surface is ResolvedSurface => surface !== undefined),
      children,
    };
    fresh.set(active.id, region);
    return region;
  };

  let snapshot: Snapshot<TContext>;

  const publish = (): void => {
    const context = engine.getContext();
    const fresh = new Map<string, ActiveRegion<TContext>>();
    const root = buildRegion(engine.getActive(), context, fresh);
    previousRegions = fresh;
    previousContext = context;
    snapshot = { root, context, status: engine.getStatus() };

    if (emitter.isEnabled('workflow.snapshot')) {
      emitter.emit({
        kind: 'workflow.snapshot',
        correlationId,
        initiator,
        data: { node: root.id, regions: fresh.size, status: snapshot.status },
      });
    }
    for (const listener of [...listeners]) listener();
  };

  const send = (event: WorkflowEvent): void => {
    nextCorrelation();
    engine.send(event);
  };

  emit('workflow.bound', {
    workflow: document.id,
    nodes: document.nodes.length,
    guards: capabilities.guards.size,
    services: capabilities.services.size,
    dataSources: capabilities.dataSources.size,
    mode: options.mode,
  } as never);

  engine.subscribe(publish);
  engine.start();
  publish();

  return {
    document,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    send,
    stop: () => engine.stop(),
    trace: {
      attach: (sink) => emitter.attach(sink),
      setRedaction: (hook) => emitter.setRedaction(hook),
      setEnabledKinds: (kinds) => emitter.setEnabledKinds(kinds),
      recent: (count) => emitter.recent(count),
      export: () => emitter.export(),
    },
  };
}
