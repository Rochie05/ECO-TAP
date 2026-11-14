import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  build: {
    rollupOptions: {
      input: {
        home: 'index.html',
        portal: 'portal.html',
      },
    },
  },
});
