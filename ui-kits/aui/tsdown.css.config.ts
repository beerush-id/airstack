import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.css', './src/desktop.css'],
  outDir: './dist',
  dts: true,
  clean: false,
  target: false,
  minify: true,
  format: ['esm'],
  platform: 'node',
});
