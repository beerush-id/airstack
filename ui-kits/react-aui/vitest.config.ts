import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['development', 'import', 'default'],
  },
  test: {
    setupFiles: ['test/setup.ts'],
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.{ts,js,tsx,jsx}'],
    reporters: ['default', 'html'],
    outputFile: 'coverage/index.html',
    coverage: {
      provider: 'istanbul',
      enabled: true,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      reportsDirectory: './coverage/coverage',
    },
  },
});
