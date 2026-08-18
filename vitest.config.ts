import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        // `@apollo/server` is inlined alongside graphql-core so that it and the test files share a
        // single `graphql` module instance — graphql-js rejects a GraphQLSchema built in another
        // realm, which is what an externalised @apollo/server would see.
        inline: ['@makerx/graphql-core', '@apollo/server'],
      },
    },
  },
})
