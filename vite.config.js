import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  // ✅ Correção principal para emojis e caracteres especiais
  esbuild: {
    charset: 'utf8'
  }
});
