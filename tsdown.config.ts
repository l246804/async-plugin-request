import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsdown'

const entries = readdirSync(resolve(__dirname, 'src'))
  .filter((file) => !file.startsWith('_') && file.endsWith('.ts'))
  .map((file) => file.replace(/\.ts$/, ''))

export default defineConfig({
  entry: Object.fromEntries(entries.map((name) => [name, `src/${name}.ts`])),
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  dts: true,
  clean: true,
  noExternal: ['@vueuse/core', 'nice-fns'],
})
