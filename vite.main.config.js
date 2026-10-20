import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'child_process', 'path', 'fs', 'os', 'http', 'https', 'url'],
    },
    sourcemap: true,
    target: 'es2020',
  },
});
