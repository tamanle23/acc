import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  worker: {
    format: 'es',
  },
  plugins: [react(), tailwindcss()],
  root: '.',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        /@napi-rs\/canvas/,
        /\.node$/,
      ],
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Resolve shadcn/ui bare 'cn' import to the project's clsx+tailwind-merge util
      'cn': path.resolve(__dirname, 'src/lib/utils'),
      '@acc/core-isomorphic': path.resolve(__dirname, '../../packages/core-isomorphic/src'),
      '@acc/core-web': path.resolve(__dirname, '../../packages/core-web/src'),
      '@acc/core': path.resolve(__dirname, '../../packages/core/src'),
      '@acc/ir': path.resolve(__dirname, '../../packages/ir/src'),
      '@acc/effect-engines': path.resolve(__dirname, '../../packages/effect-engines/src'),
    },
  },
});
