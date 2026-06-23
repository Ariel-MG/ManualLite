import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: 'esnext',
    // pdfmake embebe sus fuentes (~2MB) y se carga bajo demanda; el aviso no aplica.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      input: {
        editor: 'src/editor/index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
