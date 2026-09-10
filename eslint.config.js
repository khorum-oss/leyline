// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
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
    /**
     * Rules SonarQube's quality gate enforces, run here so they fail locally
     * rather than after a push.
     *
     * These need type information — a sort is only suspect once you know what
     * it is sorting — so this block turns on the project service. That is why
     * it is scoped to package sources rather than applied workspace-wide: it
     * costs a TypeScript program, and configuration files do not need one.
     *
     * The set is deliberately narrow. It covers what the default quality
     * profile actually failed a build over, rather than importing all 279 of
     * the plugin's rules and then arguing with them.
     */
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    // Test files live outside the package tsconfigs, so the project service
    // cannot type them. They are covered by the untyped rules above.
    ignores: ['**/*.test.ts', '**/*.test.tsx', '**/testing/**'],
    plugins: { sonarjs },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-nested-conditional': 'error',
      'sonarjs/no-alphabetical-sort': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-element-overwrite': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-empty-collection': 'error',
      'sonarjs/no-unused-collection': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-gratuitous-expressions': 'error',
      'sonarjs/prefer-single-boolean-return': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'scripts/**', '*.config.ts', '*.config.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // A test may repeat a scenario deliberately; that is coverage, not copy-paste.
      'sonarjs/no-identical-functions': 'off',
    },
  },
);
