/**
 * Schema versioning (AD8).
 *
 * Within a major version, changes are additive only. Consumers that meet an
 * unknown node kind or surface type degrade through a fallback rather than
 * failing. Every document carries its version explicitly.
 */

/** The schema version this build of `@leyline/schema` produces. */
export const SCHEMA_VERSION = '1.0.0' as const;

/** Major versions this build can read. */
export const SUPPORTED_MAJOR_VERSIONS: readonly number[] = [1];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** Parses a schema version string, returning `undefined` when malformed. */
export function parseSchemaVersion(version: string): ParsedVersion | undefined {
  const match = SEMVER.exec(version);
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * Reports whether this build can read a document. A newer minor version stays
 * readable because evolution is additive; a different major does not.
 */
export function isSupportedSchemaVersion(version: string): boolean {
  const parsed = parseSchemaVersion(version);
  return parsed !== undefined && SUPPORTED_MAJOR_VERSIONS.includes(parsed.major);
}
