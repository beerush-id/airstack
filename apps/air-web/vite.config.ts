import { airPages } from '@airlib/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    airPages({
      markdown: { extended: true },
      searchIndex: true,
    }),
  ],
  // The server build isn't minified by default, and its docs pages outgrow the Worker's size limit unminified.
  build: { minify: true },
});
