import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { leylineAliases } from '../../vitest.shared';

export default defineConfig({
  // Tests compile the real components, so what they assert on is what ships.
  plugins: [svelte({ hot: false })],
  resolve: { alias: leylineAliases, conditions: ['browser'] },
  test: {
    name: 'svelte',
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
