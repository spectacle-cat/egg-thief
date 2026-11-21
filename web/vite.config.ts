import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the built game runs from any folder (itch.io serves from a sub-path).
  base: './',
  server: { port: 5183, strictPort: true, host: '127.0.0.1' },
  build: { target: 'esnext', chunkSizeWarningLimit: 2000 },
});
