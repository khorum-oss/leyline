// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/** Packages that must never reach a UI framework (see the brief, §6). */
const FRAMEWORK_FREE = [
  'packages/schema/**',
  'packages/core/**',
  'packages/dsl/**',
  'packages/agent/**',
  'packages/vanilla/**',
];

const frameworkImports = [
  {
    group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
    message: 'This package must stay framework-free (brief §6).',
  },
  { group: ['svelte', 'svelte/*'], message: 'This package must stay framework-free (brief §6).' },
  {
    group: ['vue', 'vue/*', 'solid-js', 'solid-js/*'],
    message: 'This package must stay framework-free (brief §6).',
  },
  {
    group: ['xstate', 'xstate/*', '@xstate/*'],
    message: 'XState stays behind the internal facade in @leyline/core (AD3).',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.tsbuild/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '.changeset/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='eval']",
          message: 'Invariant I1: schema and change documents are never evaluated.',
        },
        {
          selector: "NewExpression[callee.name='Function']",
          message: 'Invariant I1: schema and change documents are never evaluated.',
        },
      ],
    },
  },
  {
    files: FRAMEWORK_FREE,
    rules: {
      'no-restricted-imports': ['error', { patterns: frameworkImports }],
    },
  },
  {
    // The XState facade is the one place allowed to name XState (AD3).
    files: ['packages/core/src/engine/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: frameworkImports.filter((p) => !p.group.includes('xstate')) },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'scripts/**', '*.config.ts', '*.config.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
