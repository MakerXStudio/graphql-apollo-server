﻿# GraphQL Apollo Server

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

## Apollo Server test helpers

Apollo Server v4 introduced an `executeOperation` function to enable operations to be run directly against the server instance, without requiring an HTTP server or network calls.

Bypassing the HTTP stack supports complete control over JWT payloads and other operation context inputs required to set up complex test scenarios.

The `@makerx/graphql-apollo-server/testing` module supports testing your GraphQL implementation using this method:

- `buildExecuteOperation` accepts an `ApolloServer` instance and context creation function and returns an `executeOperation` function which:
  - is strongly typed to the GraphQL context
  - accepts `TypedDocumentNode` operations to provide strong operation typing
- `createTestContext` accepts a `JwtPayload` and returns a basic `GraphQLContext` which can be used in tests:
  - `requestInfo` is set to a `testRequestInfo` constant
  - `logger` is set to a no-op logger
  - `User` is constructed using the specified `JwtPayload`
- `buildJwt` creates a `JwtPayload` suitable for tests, using overridable random defaults

### GraphQL testing example

The following example demonstrates how to use the `buildExecuteOperation` to run strongly typed tests against an `ApolloServer` instance.

> The example uses a basic `createTestContext` function, it can be replaced with your own context creation function, which may be different for tests vs normal runtime.

The complete source code for this sample is available in the [src/testing/tests](./src/testing/tests/) directory.

Refer to the [GraphQL-Codegen documentation](https://the-guild.dev/graphql/codegen/docs/getting-started) for info on generating strongly typed operations.

#### test-context.ts

This file provides a [Vitest test context](https://vitest.dev/guide/test-context) which sets up an `ApolloServer` instance and provides the `executeOperation` function to tests.

```ts
import { buildExecuteOperation, createTestContext } from '@makerx/graphql-apollo-server/testing'
import type { GraphQLContext } from '@makerx/graphql-core'
import { test as testBase } from 'vitest'
import { createTestServer } from './server'

interface TestContext {
  executeOperation: ReturnType<typeof buildExecuteOperation<GraphQLContext, typeof createTestContext>>
}

export const test = testBase.extend<TestContext>({
  // eslint-disable-next-line no-empty-pattern
  executeOperation: async ({}, use) => {
    // setup
    const server = createTestServer<GraphQLContext>()
    const executeOperation = buildExecuteOperation(server, createTestContext)
    // test
    await use(executeOperation)
    // teardown
    server.stop()
  },
})
```

#### hello-query.test.ts

```ts
import { buildJwt } from '@makerx/graphql-apollo-server/testing'
import { describe, expect } from 'vitest'
import { graphql } from './gql'
import { test } from './test-context'

const helloQuery = graphql(`
  query Hello($message: String) {
    hello(message: $message)
  }
`)

describe('hello query operation', () => {
  test('anonymous calls fail', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery, variables: { message: 'world' } })
    expect(result.errors?.[0]?.message).toBe('Not authenticated')
  })

  test('authenticated calls work', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery, variables: { message: 'world' } }, buildJwt())
    expect(result.data?.hello).toBe('Hello, world!')
  })

  test('user name is returned', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery }, buildJwt({ name: 'Magda' }))
    expect(result.data?.hello).toBe('Hello, Magda!')
  })

  test('user email is returned', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery }, buildJwt({ email: 'magda@magda.net' }))
    expect(result.data?.hello).toBe('Hello, magda@magda.net!')
  })
})
```

#### important-mutation.test.ts

```ts
import { buildJwt } from '@makerx/graphql-apollo-server/testing'
import { describe, expect } from 'vitest'
import { graphql } from './gql'
import { test } from './test-context'

const importantMutation = graphql(`
  mutation Important {
    important
  }
`)

describe('important mutation operation', () => {
  test('anonymous calls fail', async ({ executeOperation }) => {
    const result = await executeOperation({ query: importantMutation })
    expect(result.errors?.[0]?.message).toBe('Not authorized')
  })

  test('non-admin calls fail', async ({ executeOperation }) => {
    const result = await executeOperation({ query: importantMutation }, buildJwt({ roles: ['User'] }))
    expect(result.errors?.[0]?.message).toBe('Not authorized')
  })

  test('admin calls work', async ({ executeOperation }) => {
    const result = await executeOperation({ query: importantMutation }, buildJwt({ roles: ['Admin'] }))
    expect(result.data?.important).toBe('Operation successful')
  })
})
```

#### me-query.test.ts

This test shows how the context input JWT payload can be easily controlled when operating underneath the HTTP layer where Bearer token validation and decoding would normally be required.

```ts
import { buildJwt } from '@makerx/graphql-apollo-server/testing'
import { describe, expect } from 'vitest'
import { graphql } from './gql'
import { test } from './test-context'

const meQuery = graphql(`
  query Me {
    me {
      id
      name
      email
      roles
    }
  }
`)

const jwtPayloads = {
  basicUser: buildJwt(),
  userWithRoles: buildJwt({ roles: ['Admin', 'Supervisor'] }),
  userWithName: buildJwt({ name: 'Magda' }),
}

describe('me query operation', () => {
  test('anonymous calls return null', async ({ executeOperation }) => {
    const result = await executeOperation({ query: meQuery })
    expect(result.data?.me).toBeNull()
  })

  test('returns basic user', async ({ executeOperation }) => {
    const result = await executeOperation({ query: meQuery }, jwtPayloads.basicUser)
    expect(result.data?.me).toMatchObject({
      id: jwtPayloads.basicUser.oid,
      email: jwtPayloads.basicUser.email,
    })
  })

  test('returns user roles', async ({ executeOperation }) => {
    const result = await executeOperation({ query: meQuery }, jwtPayloads.userWithRoles)
    expect(result.data?.me).toMatchObject({
      id: jwtPayloads.userWithRoles.oid,
      email: jwtPayloads.userWithRoles.email,
      roles: jwtPayloads.userWithRoles.roles,
    })
  })

  test('returns user name', async ({ executeOperation }) => {
    const result = await executeOperation({ query: meQuery }, jwtPayloads.userWithName)
    expect(result.data?.me).toMatchObject({
      id: jwtPayloads.userWithName.oid,
      email: jwtPayloads.userWithName.email,
      name: jwtPayloads.userWithName.name,
    })
  })
})
```
