import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  worker: {
    format: 'es',
  },
  plugins: [solidPlugin(), tailwindcss()],
  root: '.',
  build: {
    target: 'esnext',
    outDir: 'dist/client',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1400,
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
          if (id.includes('node_modules/@kobalte/') || id.includes('node_modules/@corvu/')) {
            return 'vendor-solid-primitives';
          }
          if (id.includes('node_modules/@dnd-kit/')) {
            return 'vendor-dnd';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'cn': path.resolve(__dirname, 'src/lib/utils'),
      '@acc/core-isomorphic': path.resolve(__dirname, '../../packages/core-isomorphic/src'),
      '@acc/core-web': path.resolve(__dirname, '../../packages/core-web/src'),
      '@acc/core': path.resolve(__dirname, '../../packages/core/src'),
      '@acc/ir': path.resolve(__dirname, '../../packages/ir/src'),
      '@acc/effect-engines': path.resolve(__dirname, '../../packages/effect-engines/src'),
    },
  },
});
