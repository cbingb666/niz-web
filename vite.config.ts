import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { standalone } from './scripts/standalone';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), standalone()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: Infinity,
    rolldownOptions: { output: { format: 'iife', codeSplitting: false } },
  },
});
