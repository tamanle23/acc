import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [solidPlugin(), tailwindcss(),],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
});

