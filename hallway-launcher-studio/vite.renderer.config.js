// Vite config for the RENDERER bundle (React dashboard).
// This is the vite config the forge plugin uses to build src/main.jsx → the
// browser-side bundle loaded by index.html.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the built index.html resolves assets correctly when
  // loaded via file:// inside the packaged Electron app.
  base: './',
  plugins: [react()],
  // Vite's dev server, used by `npm run dev` only.
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // Production build target — Electron's bundled Chromium is modern.
    target: 'es2020',
    // Smaller, faster sourcemaps for the packaged app.
    sourcemap: true,
  },
});
