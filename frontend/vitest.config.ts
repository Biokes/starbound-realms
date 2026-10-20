import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs in e2e/ run under `pnpm test:e2e`, not Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
