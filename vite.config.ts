import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { templateFileName, templatePdf } from './src/core/template/pdf';
import type { PaperSize } from './src/core/template/layout';

const page = (path: string) => resolve(import.meta.dirname, path);
const SIZES: PaperSize[] = ['a4', 'letter'];

/**
 * The printable templates are generated from the same layout the photo reader uses, at build time, so a
 * committed PDF can never drift out of step with it. In development they're served on the fly.
 */
function templates(): Plugin {
  return {
    name: 'handwriting-templates',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const size = SIZES.find((s) => req.url === `/templates/${templateFileName(s)}`);
        if (!size) return next();
        res.setHeader('Content-Type', 'application/pdf');
        res.end(Buffer.from(templatePdf(size)));
      });
    },
    generateBundle() {
      for (const size of SIZES) this.emitFile({ type: 'asset', fileName: `templates/${templateFileName(size)}`, source: templatePdf(size) });
    },
  };
}

export default defineConfig({
  plugins: [react(), templates()],
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
