// Vite config for the Electron MAIN process bundle.
// `main.js` is bundled by the forge vite plugin into .vite/build/main.js.
// Electron + node builtins are externalized (never bundled).

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'child_process', 'path', 'fs', 'os', 'http', 'https', 'url'],
    },
    // Keep the main process readable in stack traces.
    sourcemap: true,
    target: 'es2020',
  },
});
