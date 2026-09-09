import { defineConfig } from 'vitest/config';
import { leylineAliases } from '../../vitest.shared';

export default defineConfig({
  resolve: { alias: leylineAliases },
  test: {
    name: 'vanilla',
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
