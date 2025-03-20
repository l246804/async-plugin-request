import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: true,
      bundle: false,
      source: {
        entry: {
          index: ['src/*.ts'],
        },
      },
      output: {
        target: 'web',
      },
    },
  ],
})
