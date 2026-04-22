import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  shims: true,
  minify: false,
  // Keep node_modules external so we don't bloat the bundle; the @evita-lib
  // path alias resolves to source files in ../src/lib and gets bundled in.
  skipNodeModulesBundle: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
