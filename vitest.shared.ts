import { fileURLToPath } from 'node:url';

const at = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/**
 * Tests run against workspace sources rather than build output, so a red test
 * points at a source file and no build step stands between an edit and a run.
 */
export const leylineAliases: Record<string, string> = {
  '@leyline/core/testing': at('./packages/core/src/testing/index.ts'),
  '@leyline/schema': at('./packages/schema/src/index.ts'),
  '@leyline/core': at('./packages/core/src/index.ts'),
  '@leyline/dsl': at('./packages/dsl/src/index.ts'),
  '@leyline/agent': at('./packages/agent/src/index.ts'),
  '@leyline/react': at('./packages/react/src/index.ts'),
  '@leyline/svelte': at('./packages/svelte/src/index.ts'),
  '@leyline/vanilla': at('./packages/vanilla/src/index.ts'),
};
