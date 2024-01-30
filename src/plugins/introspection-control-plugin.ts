import type { ApolloServerPlugin, GraphQLRequestContext, GraphQLRequestListener } from '@apollo/server'
import type { GraphQLContext } from '@makerx/graphql-core'
import { isIntrospectionQuery } from '@makerx/graphql-core'
import { isProduction } from '@makerx/node-common'

export const introspectionControlPlugin: ApolloServerPlugin<GraphQLContext> = {
  requestDidStart: ({
    request: { query },
    contextValue: { user },
  }: GraphQLRequestContext<GraphQLContext>): Promise<GraphQLRequestListener<GraphQLContext> | void> => {
    if (isProduction && !user && isIntrospectionQuery(query)) throw new Error('Unauthenticated introspection is not supported')
    return Promise.resolve()
  },
}
