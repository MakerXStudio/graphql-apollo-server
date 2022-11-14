import { ApolloServerPlugin, GraphQLRequestContextWillSendResponse, GraphQLRequestListener } from '@apollo/server'
import { GraphQLRequestContextWillSendSubsequentPayload } from '@apollo/server/dist/esm/externalTypes/requestPipeline'
import { GraphQLContext, logGraphQLOperation } from '@makerxstudio/graphql-core'

export const loggingPlugin: ApolloServerPlugin<GraphQLContext> = {
  requestDidStart: ({ contextValue: { started, logger } }): Promise<GraphQLRequestListener<GraphQLContext>> => {
    const responseListener: GraphQLRequestListener<GraphQLContext> = {
      willSendResponse({
        response: { body },
        request: { query, variables, operationName },
      }: GraphQLRequestContextWillSendResponse<GraphQLContext>): Promise<void> {
        const errors = body.kind === 'single' ? body.singleResult.errors : body.initialResult.errors
        logGraphQLOperation({
          started,
          operationName,
          query,
          variables,
          result: { errors },
          logger,
        })
        return Promise.resolve()
      },
      willSendSubsequentPayload({
        response: { body },
        request: { query, variables, operationName },
      }: GraphQLRequestContextWillSendSubsequentPayload<GraphQLContext>): Promise<void> {
        const errors = body.kind === 'single' ? body.singleResult.errors : body.initialResult.errors
        logGraphQLOperation({
          started,
          operationName,
          query,
          variables,
          result: { errors },
          logger,
        })
        return Promise.resolve()
      },
    }
    return Promise.resolve(responseListener)
  },
}
