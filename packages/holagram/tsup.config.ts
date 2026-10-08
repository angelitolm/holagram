import { defineConfig } from 'tsup'

export default defineConfig({
  // One output file per source file: 'use client' is a per-file directive, and bundling would merge files and drop it.
  entry: ['src/*.ts', 'src/*.tsx', '!src/*.test.ts'],
  bundle: false,
  format: ['esm'],
  dts: true,
  clean: true,
})
