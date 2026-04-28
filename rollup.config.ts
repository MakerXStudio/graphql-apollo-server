import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { isAbsolute } from 'node:path'
import type { RollupOptions } from 'rollup'

const isBareModuleImport = (id: string, importer: string | undefined) => importer !== undefined && !id.startsWith('.') && !isAbsolute(id)

const config: RollupOptions = {
  input: ['src/index.ts', 'src/testing/index.ts'],
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].js',
      exports: 'named',
      preserveModules: true,
      sourcemap: true,
      interop: 'auto',
    },
    {
      dir: 'dist',
      format: 'es',
      exports: 'named',
      entryFileNames: '[name].mjs',
      preserveModules: true,
      sourcemap: true,
    },
  ],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
  },
  external: isBareModuleImport,
  plugins: [
    typescript({
      tsconfig: 'tsconfig.build.json',
    }),
    nodeResolve(),
  ],
}

export default config
