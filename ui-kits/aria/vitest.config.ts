import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.{ts,js}'],
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts', 'test/**/*.events.test.ts'],
      tsconfig: './tsconfig.test.json',
      ignoreSourceErrors: true,
    },
    reporters: ['default', 'html'],
    outputFile: './coverage/index.html',
    coverage: {
      provider: 'istanbul',
      enabled: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/types.ts'],
      reportsDirectory: './coverage/coverage',
    },
  },
});
