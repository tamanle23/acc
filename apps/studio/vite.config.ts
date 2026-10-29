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
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      external: [
        /@napi-rs\/canvas/,
        /\.node$/,
      ],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@huggingface/transformers/')) {
            return 'vendor-transformers';
          }
          if (id.includes('node_modules/onnxruntime-web/') || id.includes('node_modules/onnxruntime-common/')) {
            return 'vendor-onnx';
          }
          if (id.includes('node_modules/shiki/')) {
            return 'vendor-shiki';
          }
          if (id.includes('node_modules/wavesurfer.js/')) {
            return 'vendor-wavesurfer';
          }
          if (id.includes('node_modules/@radix-ui/') || id.includes('node_modules/@base-ui/')) {
            return 'vendor-ui-primitives';
          }
        },
      },
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
