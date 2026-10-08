import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const page = (path: string) => resolve(import.meta.dirname, path);

export default defineConfig({
  plugins: [react()],
  // Module workers, so their dynamic imports (the WOFF2 encoder) become separate, lazily fetched chunks.
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        home: page('index.html'),
        studio: page('studio/index.html'),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
