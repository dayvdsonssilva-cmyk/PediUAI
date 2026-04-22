import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'index.html'),
        cliente:  resolve(__dirname, 'cliente.html'),
        admin:    resolve(__dirname, 'admin.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        garcom:   resolve(__dirname, 'garcom.html'),
        lojas:    resolve(__dirname, 'lojas.html'),
      },
    },
  },
});
