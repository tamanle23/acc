import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: path.resolve(__dirname),
    include: ['src/bun/**/*.test.ts'],
  },
  resolve: {
    alias: {
      'electrobun/main': path.resolve(__dirname, './.hutch/devkit/api/sdks/main/index.ts'),
    },
  },
});
