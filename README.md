# GraphQL Apollo Server

A set of MakerX plugins for Apollo Server

## Logging Plugin

`loggingPlugin` logs GraphQL operations in a [standard way](https://github.com/MakerXStudio/graphql-core/blob/main/src/logging.ts), using the [`logger`](https://github.com/MakerXStudio/node-common/blob/main/src/logger.ts) from the GraphQL [context](https://github.com/MakerXStudio/graphql-core/blob/main/src/context.ts).

Logging is performed via the `willSendResponse` hook, which will run for operations with errors.

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
