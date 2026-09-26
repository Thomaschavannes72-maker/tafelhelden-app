import { defineConfig } from 'vite';

export default defineConfig({
  root: 'outputs',
  envDir: '..',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false
  }
});
