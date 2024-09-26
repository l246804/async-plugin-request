import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    { input: 'src', builder: 'mkdist', format: 'esm', ext: 'js' },
    { input: 'src', builder: 'mkdist', format: 'cjs', ext: 'cjs' },
  ],
  outDir: 'dist',
  declaration: true,
  clean: true,
  failOnWarn: false,
})
