import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const page = (path: string) => resolve(import.meta.dirname, path);

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        home: page('index.html'),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
