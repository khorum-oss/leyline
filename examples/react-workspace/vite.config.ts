import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { leylineAliases } from '../../vitest.shared.js';

/**
 * `dev` reads the workspace sources, so a fresh clone runs the example without
 * a build first and an edit under `packages/` reaches the page immediately —
 * the same bargain `vitest.shared.ts` strikes for tests.
 *
 * `build` is deliberately left alone. It resolves `@leyline/*` through each
 * package's published `exports`, which is what makes CI's example build a real
 * check that the packaged entry points work.
 */
const RELAY = `http://localhost:${process.env['LEYLINE_RELAY_PORT'] ?? 5180}`;

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: { alias: command === 'serve' ? leylineAliases : {} },
  // One origin for the page: `/agent` is the relay, so the browser needs no
  // CORS and no second URL to know about.
  server: { proxy: { '/agent': { target: RELAY, changeOrigin: true } } },
}));
