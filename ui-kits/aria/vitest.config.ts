import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.{ts,js}'],
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
