import type {
  ApolloServerPlugin,
  GraphQLExperimentalFormattedSubsequentIncrementalExecutionResultAlpha2,
  GraphQLRequestContextWillSendResponse,
  GraphQLRequestListener,
} from '@apollo/server'
import {
  collectDeprecatedElementUsage,
  isIntrospectionQuery,
  logGraphQLOperation,
  type DeprecatedElementUsage,
  type GraphQLContext,
  type LoggerLogFunctions,
} from '@makerx/graphql-core'
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
  /**
   * Can be used to augment the log entry with additional properties
   */
  augmentLogEntry?: (ctx: TContext) => Record<string, any>
  /**
   * Can be used to resolve a logger for the plugin
   */
  resolveLogger?: (context: TContext) => TLogger
  /**
   * Can be used to adjust the query before logging
   */
  adjustQuery?: (query?: string) => string | null
  /**
   * If true, the `@deprecated` schema elements the operation used will be logged as
   * `deprecatedElements`, so you can tell whether a deprecated element is safe to remove.
   * The key is omitted when the operation used none.
   *
   * When a limit stops collection early the entry also carries `deprecatedElementsTruncated: true`,
   * meaning the list may be incomplete and absence from it does not prove an element is unused.
   */
  includeDeprecatedElements?: boolean
  /**
   * Bounds how deeply variable values are walked when collecting deprecated elements (default: `25`)
   */
  maxVariableDepth?: number
  /**
   * Bounds how many variable values are walked when collecting deprecated elements (default: `10000`)
   */
  maxVariableNodes?: number
  /**
   * Bounds how many deprecated elements are logged for one operation (default: `50`)
   */
  maxElements?: number
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
  augmentLogEntry,
  resolveLogger: resolveCustomLogger,
  adjustQuery,
  includeDeprecatedElements,
  maxVariableDepth,
  maxVariableNodes,
  maxElements,
}: GraphQLOperationLoggingPluginOptions<TContext, TLogger> = {}): ApolloServerPlugin<TContext> {
  return {
    contextCreationDidFail: async ({ error }) => {
      contextCreationFailureLogger?.error('Context creation failed', { error })
      await contextCreationDidFail?.({ error })
    },

    requestDidStart: ({ contextValue }): Promise<GraphQLRequestListener<TContext>> => {
      function log(
        ctx: GraphQLRequestContextWillSendResponse<TContext>,
        subsequentPayload?: GraphQLExperimentalFormattedSubsequentIncrementalExecutionResultAlpha2,
      ) {
        const { started } = contextValue
        const { logger } = resolveCustomLogger ? { logger: resolveCustomLogger(contextValue) } : contextValue
        const { operationName, query, variables } = ctx.request
        // `ctx.source` rather than `ctx.request.query`: an automatic persisted query carries no
        // `query` on the request, so detecting introspection from it would miss those entirely.
        const isIntrospection = isIntrospectionQuery(ctx.source)
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

        const additionalLogEntryProperties = augmentLogEntry ? (omitNil(augmentLogEntry(contextValue)) as Record<string, any>) : undefined

        let deprecatedElements: DeprecatedElementUsage[] | undefined
        let deprecatedElementsTruncated: boolean | undefined
        // Skipped for subsequent payloads: the elements belong to the operation, so collecting per
        // payload would repeat the same array on every chunk of a @defer/@stream response.
        // `document` and `operation` are absent when the request failed to parse or validate.
        if (includeDeprecatedElements && !subsequentPayload && ctx.document && ctx.operation) {
          try {
            const usage = collectDeprecatedElementUsage({
              schema: ctx.schema,
              document: ctx.document,
              operation: ctx.operation,
              operationName,
              // Deliberately the raw request variables: the walk resolves them against their
              // declared input types itself, and graphql-js never writes its coerced values back.
              variables,
              maxVariableDepth,
              maxVariableNodes,
              maxElements,
            })
            deprecatedElements = usage.elements
            deprecatedElementsTruncated = usage.truncated
          } catch (error) {
            // Telemetry must never turn a served request into a failed one.
            logger.warn('Failed to collect deprecated schema element usage', { error, operationName })
          }
        }

        logGraphQLOperation({
          logger,
          logLevel,
          type,
          operationName,
          query: adjustQuery ? adjustQuery(query) : query,
          started,
          variables: adjustedVariables && Object.keys(adjustedVariables).length > 0 ? adjustedVariables : undefined,
          result: Object.keys(adjustedResult).length ? adjustedResult : undefined,
          isIntrospectionQuery: isIntrospection || undefined,
          isIncrementalResponse: ctx.response.body.kind === 'incremental' || undefined,
          isSubsequentPayload: !!subsequentPayload || undefined,
          deprecatedElements,
          deprecatedElementsTruncated,
          ...additionalLogEntryProperties,
        })
      }

      const responseListener: GraphQLRequestListener<TContext> = {
        willSendResponse(ctx: GraphQLRequestContextWillSendResponse<TContext>): Promise<void> {
          if (shouldIgnore?.(ctx)) return Promise.resolve()
          log(ctx)
          return Promise.resolve()
        },
        willSendSubsequentPayload(
          ctx: GraphQLRequestContextWillSendResponse<TContext>,
          payload: GraphQLExperimentalFormattedSubsequentIncrementalExecutionResultAlpha2,
        ): Promise<void> {
          if (shouldIgnore?.(ctx)) return Promise.resolve()
          log(ctx, payload)
          return Promise.resolve()
        },
      }
      return Promise.resolve(responseListener)
    },
  }
}
