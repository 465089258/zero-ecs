import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      syntax: ['node 22'],
      bundle: true,
      dts: true,
      source: {
        entry: {
          index: ['./src/**'],
        },
      },
    },
  ],
});
