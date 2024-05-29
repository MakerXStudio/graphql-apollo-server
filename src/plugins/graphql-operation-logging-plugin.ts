import type {
  ApolloServerPlugin,
  GraphQLExperimentalFormattedSubsequentIncrementalExecutionResult,
  GraphQLRequestContextWillSendResponse,
  GraphQLRequestListener,
} from '@apollo/server'
import { isIntrospectionQuery, logGraphQLOperation, type GraphQLContext, type LoggerLogFunctions } from '@makerx/graphql-core'
import type { Logger } from '@makerx/node-common'
import { OperationTypeNode } from 'graphql'
import { omitNil } from '../utils'

export interface GraphQLOperationLoggingPluginOptions<TContext extends GraphQLContext<TLogger, any, any>, TLogger extends Logger = Logger> {
  /**
   * This level will be used to log operations via the logging method of the specified key (default: `info`)
   */
  logLevel?: keyof LoggerLogFunctions<TLogger>
  /***
   * If provided, this logger will be used to log context creation failures as errors
   */
  contextCreationFailureLogger?: Logger
  /***
   * If provided, will be bound to the plugin contextCreationDidFail hook, to log or otherwise react to context creation failures.
   * You may provide this option in addition to the contextCreationFailureLogger, both will be called.
   */
  contextCreationDidFail?: ApolloServerPlugin['contextCreationDidFail']
  /***
   * If provided, this function will be called to determine whether to ignore logging for a given response
   */
  shouldIgnore?: (ctx: GraphQLRequestContextWillSendResponse<TContext>) => boolean
  /**
   * If true, introspection queries will not be logged (default: `true`)
   */
  ignoreIntrospectionQueries?: boolean
  /**
   * If true, the response data will be logged for queries and mutations
   */
  includeResponseData?: boolean
  /**
   * If true, the response data will be logged for mutations
   */
  includeMutationResponseData?: boolean
  /**
   * Can be used to adjust the variables before logging, e.g. redacting sensitive data
   */
  adjustVariables?: (variables: Record<string, any>) => Record<string, any>
  /**
   * Can be used to adjust the result data before logging, e.g. redacting sensitive data
   */
  adjustResultData?: (data: Record<string, any>) => Record<string, any>
}

/**
 * This plugin logs GraphQL operations and context creation failure (if specified via options).
 * See options for more details.
 */
export function graphqlOperationLoggingPlugin<TContext extends GraphQLContext<TLogger, any, any>, TLogger extends Logger = Logger>({
  logLevel = 'info',
  contextCreationDidFail,
  contextCreationFailureLogger,
  shouldIgnore,
  ignoreIntrospectionQueries = true,
  includeResponseData,
  includeMutationResponseData,
  adjustVariables,
  adjustResultData,
}: GraphQLOperationLoggingPluginOptions<TContext, TLogger> = {}): ApolloServerPlugin<TContext> {
  return {
    contextCreationDidFail: async ({ error }) => {
      contextCreationFailureLogger?.error('Context creation failed', { error })
      await contextCreationDidFail?.({ error })
    },

    requestDidStart: ({ contextValue: { started, logger } }): Promise<GraphQLRequestListener<TContext>> => {
      function log(
        ctx: GraphQLRequestContextWillSendResponse<TContext>,
        subsequentPayload?: GraphQLExperimentalFormattedSubsequentIncrementalExecutionResult,
      ) {
        const { operationName, query, variables } = ctx.request
        const isIntrospection = query && isIntrospectionQuery(query)
        if (isIntrospection && ignoreIntrospectionQueries) return

        const type = ctx.operation?.operation
        const result = ctx.response.body.kind === 'single' ? ctx.response.body.singleResult : ctx.response.body.initialResult
        const errors = result.errors

        const adjustedVariables = adjustVariables && variables ? adjustVariables(variables) : variables

        const data = subsequentPayload ? subsequentPayload.incremental : result.data
        let adjustedData = includeResponseData
          ? data
          : includeMutationResponseData && type === OperationTypeNode.MUTATION
            ? data
            : undefined
        if (adjustResultData && adjustedData) adjustedData = adjustResultData(adjustedData)

        const adjustedResult = omitNil({ errors, data: adjustedData }) as Record<string, any>

        logGraphQLOperation({
          logger,
          logLevel,
          type,
          operationName,
          query,
          started,
          variables: adjustedVariables && Object.keys(adjustedVariables).length > 0 ? adjustedVariables : undefined,
          result: Object.keys(adjustedResult).length ? adjustedResult : undefined,
          isIntrospectionQuery: isIntrospection || undefined,
          isIncrementalResponse: ctx.response.body.kind === 'incremental' || undefined,
          isSubsequentPayload: !!subsequentPayload || undefined,
        })
      }

      const responseListener: GraphQLRequestListener<TContext> = {
        willSendResponse(ctx: GraphQLRequestContextWillSendResponse<TContext>): Promise<void> {
          if (shouldIgnore?.(ctx)) return Promise.resolve()
          log(ctx)
          return Promise.resolve()
        },
        willSendSubsequentPayload(ctx: GraphQLRequestContextWillSendResponse<TContext>, payload): Promise<void> {
          if (shouldIgnore?.(ctx)) return Promise.resolve()
          log(ctx, payload)
          return Promise.resolve()
        },
      }
      return Promise.resolve(responseListener)
    },
  }
}
