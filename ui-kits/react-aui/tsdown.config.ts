import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/**/*.ts', './src/**/*.tsx'],
  outDir: './dist',
  dts: true,
  clean: false,
  target: false,
  minify: false,
  format: ['esm'],
  unbundle: true,
  platform: 'neutral',
  external: ['react'],
});
