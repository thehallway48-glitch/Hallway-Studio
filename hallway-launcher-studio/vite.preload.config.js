// Vite config for the PRELOAD script bundle.
// The preload runs in an isolated world with nodeIntegration — it can use
// `require('electron')` (contextBridge / ipcRenderer) but must stay tiny and
// must NOT pull in renderer-side deps.

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
    },
    sourcemap: true,
    target: 'es2020',
  },
});
