import type { TsToolkitConfig } from '@makerx/ts-toolkit'

const config: TsToolkitConfig = {
  packageConfig: {
    srcDir: 'src',
    outDir: 'dist',
    moduleType: 'commonjs',
    main: 'index.ts',
    exports: {
      '.': 'index.ts',
      './testing': 'testing/index.ts',
    },
  },
}
export default config
