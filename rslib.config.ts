import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      // Preserve the stable root and unstable advanced subpath as separate
      // modules, and keep individual files tree-shakeable for game engines.
      syntax: 'es2018',
      bundle: false,
      dts: true,
      source: {
        entry: {
          index: ['./src/**'],
        },
      },
    },
  ],
});
