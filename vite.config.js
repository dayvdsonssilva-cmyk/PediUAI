import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main:    'index.html',
        cliente: 'cliente.html',
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
