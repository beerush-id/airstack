import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [solid() as never],
  resolve: {
    conditions: ['development', 'browser'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    projects: [
      'packages/core',
      'packages/storage',
      'packages/router',
      'packages/react',
      'packages/solid',
      'packages/ssr',
      'packages/svelte',
      'packages/vue',

      'irpclib/irpc',
      'irpclib/http',
      'irpclib/ws',
      'irpclib/broadcast',

      'ui-kits/form',
      'ui-kits/react-form',
      'ui-kits/solid-form',
      'ui-kits/aria',
    ],
    exclude: ['packages/react-classic'],
    reporters: ['default', 'html'],
    outputFile: 'docs/.vitepress/dist/coverage/index.html',
    coverage: {
      provider: 'istanbul',
      enabled: true,
      include: [
        'packages/core/src/**/*.ts',
        'packages/storage/src/**/*.ts',
        'packages/router/src/**/*.{ts,tsx}',
        'packages/react/src/**/*.{ts,tsx}',
        'packages/solid/src/**/*.{ts,tsx}',
        'packages/ssr/src/**/*.{ts}',
        'packages/svelte/src/**/*.{ts}',
        'packages/vue/src/**/*.{ts}',

        'irpclib/irpc/src/**/*.{ts}',
        'irpclib/http/src/**/*.{ts}',
        'irpclib/ws/src/**/*.{ts}',
        'irpclib/broadcast/src/**/*.{ts}',

        'ui-kits/form/src/**/*.{ts}',
        'ui-kits/react-form/src/**/*.{ts,tsx}',
        'ui-kits/solid-form/src/**/*.{ts,tsx}',
        'ui-kits/aria/src/**/*.{ts}',
      ],
      exclude: ['packages/vite-ssr/src/pages/plugin.ts'],
      reportsDirectory: 'docs/.vitepress/dist/coverage/details',
    },
  },
});
