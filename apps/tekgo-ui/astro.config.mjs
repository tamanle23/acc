import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const shimCompilerRuntime = path.resolve(__dirname, './src/shims/react-compiler-runtime.ts');

const portableTextReactMain = require.resolve('@portabletext/react');
const portableTextReactServer = path.join(
  path.dirname(portableTextReactMain),
  'index.react-server.js'
);

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    preact({
      compat: true,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: [
        { find: '@portabletext/react', replacement: portableTextReactServer },
        { find: 'react/compiler-runtime', replacement: shimCompilerRuntime },
        { find: 'preact/compat/compiler-runtime', replacement: shimCompilerRuntime },
        { find: '@/data', replacement: path.resolve(__dirname, './data') },
        { find: '@', replacement: path.resolve(__dirname, './src') },
      ],
    },
    server: {
      fs: {
        allow: ['..'],
      },
    },
  },
});
