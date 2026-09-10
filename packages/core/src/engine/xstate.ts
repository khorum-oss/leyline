import { assign, createActor, fromPromise, setup, type AnyActorRef, type StateValue } from 'xstate';
import { buildContainment, type WorkflowDocument, type WorkflowNode } from '@leyline/schema';
import type { WorkflowEvent, WorkflowStatus } from '../contracts.js';
import type { BoundCapabilities } from '../binding.js';
import type { ActiveNodes, EngineInstance, EngineObserver } from './facade.js';

/**
 * The statechart engine (AD3).
 *
 * Everything XState-shaped lives here. A Leyline document becomes a machine
 * once, at construction, and the running actor is never exposed.
 *
 * The mapping is deliberately direct, because the value of AD3 is inheriting
 * solved edge cases rather than reimplementing them: a `section` in `one` mode
 * is a compound state, a `section` in `many` mode is a parallel state, an
 * `invoke` is an invoked promise actor with `onDone` and `onError`, and every
 * state carries the node identifier as its XState id so that a transition can
 * target `#nodeId` absolutely, whatever the nesting.
 */

/** The event a `link` surface sends. Internal — never authored in a document. */
export function linkEventType(surfaceId: string): string {
  return `leyline.link.${surfaceId}`;
}

type LooseConfig = Record<string, unknown>;

function transitionList(
  transitions: readonly { target: string; when?: string | undefined }[] | undefined,
  extra?: LooseConfig,
): LooseConfig[] {
  return (transitions ?? []).map((transition) => ({
    target: `#${transition.target}`,
    ...(transition.when !== undefined ? { guard: transition.when } : {}),
    ...extra,
  }));
}

function stateConfig(node: WorkflowNode, byId: ReadonlyMap<string, WorkflowNode>): LooseConfig {
  const config: LooseConfig = { id: node.id };
  const children = (node.children ?? [])
    .map((id) => byId.get(id))
    .filter((child): child is WorkflowNode => child !== undefined);

  if (node.kind === 'section' && children.length > 0) {
    if ((node.mode ?? 'one') === 'many') {
      config['type'] = 'parallel';
    } else if (node.initial !== undefined) {
      config['initial'] = node.initial;
    }
    config['states'] = Object.fromEntries(
      children.map((child) => [child.id, stateConfig(child, byId)] as const),
    );
  }

  if (node.invoke) {
    const assignTo = node.invoke.assignTo;
    config['invoke'] = {
      src: node.invoke.service,
      input: ({ context }: { context: Record<string, unknown> }) => ({
        context,
        input: node.invoke?.input ?? {},
        nodeId: node.id,
      }),
      onDone: transitionList(
        node.invoke.onDone,
        assignTo === undefined
          ? undefined
          : {
              // The one route from the outside world into context, and the
              // reason `assignTo` must name a declared field (I4).
              actions: assign({
                [assignTo]: ({ event }: { event: { output: unknown } }) => event.output,
              }),
            },
      ),
      onError: transitionList(node.invoke.onError),
    };
  }

  const on: LooseConfig = {};
  for (const transition of node.on ?? []) {
    on[transition.on] = [
      {
        target: `#${transition.target}`,
        ...(transition.when !== undefined ? { guard: transition.when } : {}),
      },
    ];
  }
  for (const surface of node.surfaces ?? []) {
    if (surface.target === undefined || surface.id === undefined) continue;
    on[linkEventType(surface.id)] = [{ target: `#${surface.target}` }];
  }
  if (Object.keys(on).length > 0) config['on'] = on;

  return config;
}

/** Reads the active node tree out of an XState value, guided by the document. */
function activeFrom(
  value: StateValue,
  candidates: readonly WorkflowNode[],
  byId: ReadonlyMap<string, WorkflowNode>,
  childrenOf: (node: WorkflowNode) => readonly WorkflowNode[],
): ActiveNodes[] {
  const entries: [string, StateValue | undefined][] =
    typeof value === 'string'
      ? [[value, undefined]]
      : Object.entries(value).map(([key, nested]) => [key, nested as StateValue]);

  return entries.flatMap(([id, nested]) => {
    const node = byId.get(id);
    if (node === undefined || !candidates.some((candidate) => candidate.id === id)) return [];
    const children =
      nested === undefined ? [] : activeFrom(nested, childrenOf(node), byId, childrenOf);
    return [{ id, children }];
  });
}

export interface EngineOptions<TContext> {
  readonly document: WorkflowDocument;
  readonly capabilities: BoundCapabilities;
  readonly initialContext: TContext;
  readonly observer: EngineObserver;
}

export function createEngine<TContext extends Record<string, unknown>>(
  options: EngineOptions<TContext>,
): EngineInstance<TContext> {
  const { document, capabilities, observer } = options;
  const byId = new Map(document.nodes.map((node) => [node.id, node] as const));
  const containment = buildContainment(document, new Set(byId.keys()));
  const rootNodes = containment.roots
    .map((id) => byId.get(id))
    .filter((node): node is WorkflowNode => node !== undefined);
  const childrenOf = (node: WorkflowNode): WorkflowNode[] =>
    (node.children ?? [])
      .map((id) => byId.get(id))
      .filter((child): child is WorkflowNode => child !== undefined);

  // Guards and services are wrapped once, here, so that every evaluation and
  // every invocation is observable without the engine knowing what a sink is.
  const guards = Object.fromEntries(
    [...capabilities.guards].map(([name, predicate]) => [
      name,
      ({ context }: { context: TContext }) => {
        const result = (predicate as (c: TContext) => boolean)(context);
        if (observer.guardTracingEnabled()) observer.onGuard(name, result);
        return result;
      },
    ]),
  );

  const actors = Object.fromEntries(
    [...capabilities.services].map(([name, service]) => [
      name,
      fromPromise(async ({ input }: { input: { nodeId: string } }) => {
        observer.onServiceInvoked(name, input.nodeId);
        try {
          const output = await (service as (i: unknown) => Promise<unknown>)(input);
          observer.onServiceSettled(name, input.nodeId, 'done');
          return output;
        } catch (error) {
          observer.onServiceSettled(name, input.nodeId, 'error');
          throw error;
        }
      }),
    ]),
  );

  const machine = setup({
    types: {} as { context: TContext; events: { type: string } & Record<string, unknown> },
    guards: guards as never,
    actors: actors as never,
  }).createMachine({
    id: document.id,
    initial: document.entry,
    context: options.initialContext,
    states: Object.fromEntries(
      rootNodes.map((node) => [node.id, stateConfig(node, byId)] as const),
    ),
  } as never);

  let actor: AnyActorRef | undefined;
  const listeners = new Set<() => void>();
  let active: ActiveNodes = { id: document.entry, children: [] };
  let context = options.initialContext;
  let status: WorkflowStatus = 'idle';
  let lastEvent: WorkflowEvent = { type: 'leyline.start' };

  const flatten = (tree: ActiveNodes): string[] => [
    tree.id,
    ...tree.children.flatMap((child) => flatten(child)),
  ];

  const read = (snapshot: { value: StateValue; context: TContext; status: string }): void => {
    const previous = flatten(active);
    const roots = activeFrom(snapshot.value, rootNodes, byId, childrenOf);
    const next = roots[0] ?? active;
    active = next;
    context = snapshot.context;
    status =
      snapshot.status === 'done' ? 'done' : snapshot.status === 'error' ? 'error' : 'running';

    const current = flatten(active);
    if (previous.join('|') !== current.join('|')) {
      observer.onTransition(previous, current, lastEvent);
    }
    for (const listener of [...listeners]) listener();
  };

  return {
    start() {
      actor = createActor(machine);
      actor.subscribe((snapshot) => read(snapshot as never));
      actor.start();
    },
    stop() {
      actor?.stop();
      actor = undefined;
      status = 'done';
    },
    send(event) {
      lastEvent = event;
      actor?.send({ type: event.type, ...(event.payload ?? {}) });
    },
    getActive: () => active,
    getContext: () => context,
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
