import { airPages } from '@airlib/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    airPages({
      markdown: { extended: true },
      searchIndex: true,
    }),
  ],
});
