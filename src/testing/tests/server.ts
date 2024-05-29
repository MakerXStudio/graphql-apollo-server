import type { BaseContext } from '@apollo/server'
import { ApolloServer } from '@apollo/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolvers } from './resolvers'

export function createTestServer<TContext extends BaseContext>() {
  return new ApolloServer<TContext>({
    typeDefs: readFileSync(resolve(__dirname, './schema.graphql')).toString('utf-8'),
    resolvers,
  })
}
