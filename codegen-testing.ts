import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'src/testing/tests/schema.graphql',
  documents: ['src/testing/tests/**/*.ts', '!src/testing/tests/gql/**/*'],
  hooks: { afterOneFileWrite: ['prettier --write'] },
  generates: {
    './src/testing/tests/gql/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
    },
    './src/testing/tests/gql/resolvers.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        strictScalars: true,
        contextType: '@makerx/graphql-core#GraphQLContext',
      },
    },
  },
}

export default config
