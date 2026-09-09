import type { Options } from 'tsup';

/**
 * Shared build settings. Every package ships compiled JavaScript plus
 * declaration files, so plain-JS consumers get the same API (brief §8).
 */
const base: Options = {
  // Declaration emit runs its own program, which cannot share the composite,
  // incremental project used for typechecking.
  tsconfig: 'tsconfig.build.json',
  format: ['esm', 'cjs'],
  target: 'es2022',
  platform: 'neutral',
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
};

export default base;
