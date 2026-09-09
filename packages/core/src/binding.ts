import { pointer, type CapabilityKind, type WorkflowDocument } from '@leyline/schema';
import { CapabilityBindingError, type MissingCapability } from './errors.js';
import type { CapabilityBundle } from './contracts.js';

/**
 * Joining a document to an implementation bundle (AD2, G8, I2).
 *
 * Two rules, and the second is the security boundary rather than a
 * convenience:
 *
 * - **Every gap is reported at once, at binding time.** A workflow that will
 *   fail on a click three screens in fails here instead, naming every missing
 *   name in one error rather than the first one found.
 * - **The declared set is closed.** A document may reference only names the
 *   bundle supplies, and binding rejects an unknown name rather than ignoring
 *   it. A document cannot introduce behaviour; it can only arrange what the
 *   application already decided to provide.
 */

const SECTIONS = {
  guard: 'guards',
  service: 'services',
  dataSource: 'dataSources',
} as const satisfies Record<CapabilityKind, keyof CapabilityBundle>;

export interface BoundCapabilities {
  readonly guards: ReadonlyMap<string, (context: never) => boolean>;
  readonly services: ReadonlyMap<string, (input: never) => Promise<unknown>>;
  readonly dataSources: ReadonlyMap<string, (input: never) => unknown>;
}

function supplied(bundle: CapabilityBundle, kind: CapabilityKind): ReadonlySet<string> {
  const section = bundle[SECTIONS[kind]] as Record<string, unknown> | undefined;
  return new Set(Object.keys(section ?? {}));
}

/**
 * Verifies the document's requirements against the bundle, and throws a single
 * aggregate error naming everything absent.
 *
 * The requirements block is the closed set: a name used in the document but
 * absent from `requires` is a validation error the schema already reports, and
 * a name in `requires` the bundle does not supply is the error here. Between
 * them, nothing a document mentions can reach an implementation the application
 * did not hand over.
 */
export function bindCapabilities(
  document: WorkflowDocument,
  bundle: CapabilityBundle,
): BoundCapabilities {
  const missing: MissingCapability[] = [];

  const required = {
    guard: document.requires?.guards ?? [],
    service: document.requires?.services ?? [],
    dataSource: document.requires?.dataSources ?? [],
  } as const satisfies Record<CapabilityKind, readonly string[]>;

  for (const kind of ['guard', 'service', 'dataSource'] as const) {
    const available = supplied(bundle, kind);
    required[kind].forEach((name, index) => {
      if (available.has(name)) return;
      missing.push({ kind, name, path: pointer('requires', SECTIONS[kind], index) });
    });
  }

  if (missing.length > 0) throw new CapabilityBindingError(missing);

  const pick = <T>(section: Record<string, T> | undefined, names: readonly string[]) =>
    new Map(names.map((name) => [name, (section as Record<string, T>)[name] as T] as const));

  // Only what the document declared is bound. A bundle may hold more; the
  // workflow reaches none of it, so one bundle can serve many workflows without
  // widening what any single one can do.
  return {
    guards: pick(
      bundle.guards as Record<string, (c: never) => boolean> | undefined,
      required.guard,
    ),
    services: pick(
      bundle.services as Record<string, (i: never) => Promise<unknown>> | undefined,
      required.service,
    ),
    dataSources: pick(
      bundle.dataSources as Record<string, (i: never) => unknown> | undefined,
      required.dataSource,
    ),
  };
}
