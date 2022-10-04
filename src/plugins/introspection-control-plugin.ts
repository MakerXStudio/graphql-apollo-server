import { GraphQLContext, isIntrospectionQuery } from '@makerxstudio/graphql-core'
import { isProduction } from '@makerxstudio/node-common'
import { AuthenticationError } from 'apollo-server'
import { ApolloServerPlugin, GraphQLRequestContext, GraphQLRequestListener } from 'apollo-server-plugin-base'

export const introspectionControlPlugin: ApolloServerPlugin<GraphQLContext> = {
  requestDidStart: ({
    request: { query },
    context,
  }: GraphQLRequestContext<GraphQLContext>): Promise<GraphQLRequestListener<GraphQLContext> | void> => {
    if (isProduction && !context.user && isIntrospectionQuery(query))
      throw new AuthenticationError('Unauthenticated introspection is not supported')
    return Promise.resolve()
  },
}
