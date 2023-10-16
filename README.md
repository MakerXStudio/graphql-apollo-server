# GraphQL Apollo Server

A set of MakerX plugins for Apollo Server

## GraphQL operation logging plugin

`graphqlOperationLoggingPlugin` logs GraphQL operations using the [`logger`](https://github.com/MakerXStudio/node-common/blob/main/src/logger.ts) from the GraphQL [context](https://github.com/MakerXStudio/graphql-core/blob/main/src/context.ts).

Logging is performed via the `willSendResponse` and `willSendSubsequentPayload` hooks, which will run for all query, mutation and subscription operations (including those with errors).

Logging of context creation failure can be enabled by supplying a logger to the `contextCreationFailureLogger` option.

### Options

- `logLevel`: the log level to use (default: `info`)
- `ignoreIntrospectionQueries`: if `true`, introspection queries will not be logged (default: `true`)
- `contextCreationFailureLogger`: The plugin does not have access to a logger prior to context creation, so if you wish to log context creation failures, supply a logger here (it will _only_ be called for context creation failure).
- `contextCreationDidFail`: If you wish to custom log or otherwise react to context creation failures, supply a handler for the plugin `contextCreationDidFail` hook (this will be called instead of logging to `contextCreationFailureLogger`).
- `shouldIgnore`: an optional callback that can be used to ignore certain operations, e.g. if you have a healthcheck operation that you prefer not to be logged.
- `includeResponseData`: if `true`, the operation's `result.data` will be included in the log output (default: `false`)
- `includeMutationResponseData`: if `true`, the operation's `result.data` will be included in the log output for mutations only (default: `false`)
- `adjustVariables`: an optional callback that can be used to adjust the operation's `variables` before logging
- `adjustResultData`: an optional callback that can be used to adjust the operation's `result.data` before logging

```ts
const plugins: ApolloServerPlugin<GraphQLContext>[] = [
  graphqlOperationLoggingPlugin<GraphQLContext, Logger>({
    logLevel: 'audit',
    contextCreationFailureLogger: logger,
    includeMutationResponseData: true,
    adjustVariables: (variables) => pruneKeys(variables, 'headers'),
  }),
]
```

Output includes:

- `type`: the GraphQL operation type: `query`, `mutation` or `subscription`
- `operationName`: the optional operation name
- `query`: the formatted operation
- `duration`: milliseconds taken to process the operation from context creation to `willSendResponse` hook
- `variables`: the optional operation variables, optionally adjusted by the `adjustVariables` callback
- `result.errors`: the operation's `GraphQLFormattedError[]`, if any
- `result.data`: the operation's data result, if `includeResponseData` is `true` or `includeMutationResponseData` is `true` and the operation is a mutation, optionally adjusted by the `adjustResultData` callback
- `isIncrementalResponse`: `true` if the operation is part of an incremental delivery response (`@defer` or `@stream`)
- `isSubsequentPayload`: `true` if the operation is a subsequent payload of an incremental delivery response

## Introspection Control Plugin

`introspectionControlPlugin` implements a standard pattern of rejecting unauthorized introspection requests in production.

- Unauthorized requests are those that do not have a `user` set on the GraphQL context.
- Production is determined according to `NODE_ENV === 'production'` via [node-common](https://github.com/MakerXStudio/node-common/blob/main/src/environment.ts)
