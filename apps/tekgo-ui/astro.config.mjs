import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
