/**
 * Stable, deterministic addressing (AD12) and identifier opacity (I5).
 *
 * Every addressable thing carries an identifier that survives serialization and
 * does not depend on array position. Authors may supply one; where none exists
 * the system derives one from content by hashing, never by concatenating, so an
 * identifier discloses no path, URL, or structure an initiator could exploit.
 */

/** Short tags marking what an identifier addresses. Type only — never a path. */
export const ID_TAGS = {
  workflow: 'wf',
  node: 'nd',
  surface: 'sf',
  transition: 'tr',
  registryEntry: 're',
  change: 'ch',
  proposal: 'pr',
} as const;

export type IdKind = keyof typeof ID_TAGS;

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** FNV-1a over UTF-8 bytes. Deterministic across runtimes and process runs. */
function fnv1a64(input: string): bigint {
  const bytes = new TextEncoder().encode(input);
  let hash = FNV_OFFSET_BASIS;
  for (const byte of bytes) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/**
 * Length-prefixes each part before hashing so that no arrangement of delimiters
 * inside a part can imitate a different set of parts.
 */
function canonicalize(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join('');
}

/**
 * Derives a stable identifier from content.
 *
 * The same parts always yield the same identifier, and different parts almost
 * never collide. Nothing in the result is parseable back into its input.
 */
export function deterministicId(kind: IdKind, ...parts: readonly string[]): string {
  const digest = fnv1a64(canonicalize(parts)).toString(36).padStart(13, '0');
  return `${ID_TAGS[kind]}_${digest}`;
}

const ID_PATTERN = /^[a-z]{2}_[0-9a-z]{13}$|^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * Accepts author-supplied identifiers and generated ones alike, and rejects
 * anything carrying path or URL structure (I5).
 */
export function isValidId(value: string): boolean {
  return ID_PATTERN.test(value);
}
