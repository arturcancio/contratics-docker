import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Proxy local para serviços do Supabase no ambiente de desenvolvimento
      proxy: {
        '/rest': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/realtime': {
          target: 'http://127.0.0.1:8000',
          ws: true,
          changeOrigin: true,
        },
        // Proxy transparente para consultas de APIs governamentais (Ipeadata)
        '/api-ipeadata': {
          target: 'https://www.ipeadata.gov.br',
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/api-ipeadata/, ''),
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
