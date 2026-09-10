import { deterministicId, type SurfaceType } from '@leyline/schema';
import type { ResolvedSurface } from './contracts.js';

/**
 * Renderer registries, resolved by ranked predicates rather than a flat type
 * map (AD5), and addressable through the control plane like everything else
 * (AD10).
 *
 * The catalogue is the security boundary. An application declares which
 * renderers exist and what each can claim; a change may name a catalogue entry
 * and nothing else. That is invariant **I3**: an initiator can ask for the card
 * grid the application published, and can never supply a component
 * (decision 0023).
 *
 * The core holds each component as an opaque value it never inspects, which is
 * how a registry lives in a framework-free package while still being the thing
 * the control plane mutates.
 */

export interface RendererDefinition {
  readonly id: string;
  /** Read by agents through `describe()`, so discovery needs no source access. */
  readonly description?: string;
  /** Surface types this renderer can draw. `*` claims anything. */
  readonly claims: readonly (SurfaceType | string)[];
  /** Opaque to the core. Adapters know what it is; nothing here does. */
  readonly component: unknown;
}

export type RenderTarget = 'surface' | 'region';

export interface RendererMatch {
  /** What the entry claims. Absent means `surface` (decision 0030). */
  readonly target?: RenderTarget | undefined;
  readonly surfaceId?: string | undefined;
  readonly surfaceType?: string | undefined;
  readonly nodeId?: string | undefined;
  /** Region matches only: every node of this kind. */
  readonly nodeKind?: string | undefined;
}

export interface RegistryEntry {
  readonly id: string;
  readonly renderer: string;
  readonly match: RendererMatch;
  readonly rank: number;
}

export interface Resolution {
  readonly entryId: string;
  readonly renderer: string;
  readonly component: unknown;
}

export interface RegistrySnapshot {
  readonly id: string;
  readonly entries: readonly RegistryEntry[];
}

/** Predicates receive a frozen descriptor and cannot reach the surface (I7). */
export interface SurfaceDescriptor {
  readonly id: string;
  readonly nodeId: string;
  readonly type: string;
}

/** The container a `section` node is drawn as. */
export interface RegionDescriptor {
  readonly id: string;
  readonly kind: string;
}

function targetOf(match: RendererMatch): RenderTarget {
  return match.target ?? 'surface';
}

function matchesSurface(match: RendererMatch, surface: SurfaceDescriptor): boolean {
  if (targetOf(match) !== 'surface') return false;
  if (match.surfaceId !== undefined && match.surfaceId !== surface.id) return false;
  if (match.surfaceType !== undefined && match.surfaceType !== surface.type) return false;
  if (match.nodeId !== undefined && match.nodeId !== surface.nodeId) return false;
  // A match naming nothing claims nothing; the schema rejects it before here.
  return (
    match.surfaceId !== undefined || match.surfaceType !== undefined || match.nodeId !== undefined
  );
}

function matchesRegion(match: RendererMatch, region: RegionDescriptor): boolean {
  if (targetOf(match) !== 'region') return false;
  if (match.nodeId !== undefined && match.nodeId !== region.id) return false;
  if (match.nodeKind !== undefined && match.nodeKind !== region.kind) return false;
  return match.nodeId !== undefined || match.nodeKind !== undefined;
}

export class RendererRegistry {
  readonly id: string;
  readonly #catalogue: ReadonlyMap<string, RendererDefinition>;
  #entries: RegistryEntry[] = [];

  constructor(id: string, catalogue: readonly RendererDefinition[] = []) {
    this.id = id;
    this.#catalogue = new Map(catalogue.map((entry) => [entry.id, entry] as const));
  }

  catalogue(): readonly RendererDefinition[] {
    return [...this.#catalogue.values()];
  }

  /** Whether a renderer name may be registered at all (I3). */
  knows(renderer: string): boolean {
    return this.#catalogue.has(renderer);
  }

  /**
   * Whether a catalogued renderer is willing to draw something.
   *
   * `what` is a surface type for a surface entry and a node kind for a region
   * entry; a renderer claiming `*` draws anything, which is how the fallback
   * is registered (decision 0030).
   */
  claims(renderer: string, what: string): boolean {
    const definition = this.#catalogue.get(renderer);
    if (definition === undefined) return false;
    return definition.claims.includes('*') || definition.claims.includes(what);
  }

  entries(): readonly RegistryEntry[] {
    return [...this.#entries];
  }

  snapshot(): RegistrySnapshot {
    return { id: this.id, entries: this.entries() };
  }

  /** Deterministic, so the same registration always addresses the same entry (AD12). */
  entryIdFor(renderer: string, match: RendererMatch, rank: number): string {
    return deterministicId(
      'registryEntry',
      this.id,
      renderer,
      targetOf(match),
      match.surfaceId ?? '',
      match.surfaceType ?? '',
      match.nodeId ?? '',
      match.nodeKind ?? '',
      String(rank),
    );
  }

  register(renderer: string, match: RendererMatch, rank: number): RegistryEntry {
    const entry: RegistryEntry = {
      id: this.entryIdFor(renderer, match, rank),
      renderer,
      match,
      rank,
    };
    this.#entries = [...this.#entries.filter((existing) => existing.id !== entry.id), entry];
    return entry;
  }

  unregister(entryId: string): boolean {
    const before = this.#entries.length;
    this.#entries = this.#entries.filter((entry) => entry.id !== entryId);
    return this.#entries.length !== before;
  }

  /** Replaces every entry. Used when replaying a change log (AD11). */
  reset(entries: readonly RegistryEntry[] = []): void {
    this.#entries = [...entries];
  }

  /**
   * The highest-ranked entry claiming this surface.
   *
   * Ties break toward the entry registered later, so a change applied on top of
   * an equal-ranked one wins without an initiator having to guess a number.
   * An unresolvable surface returns undefined; the caller draws the registered
   * fallback and logs. Resolution never throws (AD5).
   */
  /**
   * The highest-ranked entry claiming this surface.
   *
   * Ties break toward the entry registered later, so a change applied on top of
   * an equal-ranked one wins without an initiator having to guess a number.
   * An unresolvable surface returns undefined; the caller draws the registered
   * fallback and logs. Resolution never throws (AD5).
   */
  resolve(surface: ResolvedSurface): Resolution | undefined {
    const descriptor: SurfaceDescriptor = Object.freeze({
      id: surface.id,
      nodeId: surface.nodeId,
      type: surface.type,
    });
    return this.#best((entry) => matchesSurface(entry.match, descriptor));
  }

  /** The highest-ranked entry claiming this region (decision 0030). */
  resolveRegion(region: RegionDescriptor): Resolution | undefined {
    const descriptor: RegionDescriptor = Object.freeze({ id: region.id, kind: region.kind });
    return this.#best((entry) => matchesRegion(entry.match, descriptor));
  }

  #best(claims: (entry: RegistryEntry) => boolean): Resolution | undefined {
    let best: RegistryEntry | undefined;
    for (const entry of this.#entries) {
      if (!claims(entry)) continue;
      if (best === undefined || entry.rank >= best.rank) best = entry;
    }
    if (best === undefined) return undefined;

    const definition = this.#catalogue.get(best.renderer);
    if (definition === undefined) return undefined;
    return { entryId: best.id, renderer: best.renderer, component: definition.component };
  }
}
