# GraphQL Apollo Server

A set of MakerX plugins for Apollo Server

## Logging Plugin

`loggingPlugin` logs GraphQL operations in a [standard way](https://github.com/MakerXStudio/graphql-core/blob/main/src/logging.ts), using the [`logger`](https://github.com/MakerXStudio/node-common/blob/main/src/logger.ts) from the GraphQL [context](https://github.com/MakerXStudio/graphql-core/blob/main/src/context.ts).

Logging is performed via the `willSendResponse` and `willSendSubsequentPayload` hooks, which will run for operations with errors.

### Options

- `contextCreationFailureLogger`: The plugin does not have access to a logger prior to context creation, so if you wish to log context creation failures, supply a logger here (it will _only_ be called for context creation failure).
- `contextCreationDidFail`: If you wish to custom log or otherwise react to context creation failures, supply a handler for the plugin `contextCreationDidFail` hook (this will be called instead of logging to `contextCreationFailureLogger`).
- `shouldIgnore`: an optional callback that can be used to ignore certain operations, e.g. if you have a healthcheck operation that you prefer not to be logged.

```ts
const plugins: ApolloServerPlugin<GraphQLContext>[] = [createLoggingPlugin({ contextCreationFailureLogger: logger })]
```

Output includes:

- `duration`: milliseconds taken to process the operation from context creation to `willSendResponse` hook
- `operationName`: the optional operation name
- `query`: the formatted operation
- `variables`: the optional operation variables
- `result.errors`: the operation's `GraphQLFormattedError[]`, if any

## Introspection Control Plugin

`introspectionControlPlugin` implements a standard pattern of rejecting unauthorized introspection requests in production.

- Unauthorized requests are those that do not have a `user` set on the GraphQL context.
- Production is determined according to `NODE_ENV === 'production'` via [node-common](https://github.com/MakerXStudio/node-common/blob/main/src/environment.ts)
