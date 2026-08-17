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
- `adjustQuery`: an optional callback that can be used to adjust the operation's query before logging
- `includeDeprecatedElements`: if `true`, the `@deprecated` schema elements the operation used will be logged as `deprecatedElements` (default: `false`) — see [Deprecation usage](#deprecation-usage)
- `maxVariableDepth`: bounds how deeply variable values are walked when collecting deprecated elements (default: `25`)
- `maxVariableNodes`: bounds how many variable values are walked when collecting deprecated elements (default: `10000`)
- `maxElements`: bounds how many deprecated elements are logged for one operation (default: `50`)

Note that `TLogger` cannot be inferred from `TContext`, so supply both type arguments explicitly if you use a custom log level:

```ts
graphqlOperationLoggingPlugin<GraphQLContext, Logger>({ logLevel: 'audit' })
```

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
- `deprecatedElements`: the `@deprecated` schema elements the operation used, if `includeDeprecatedElements` is `true` and it used any
- `deprecatedElementsTruncated`: `true` if any limit stopped collection early, meaning `deprecatedElements` may be incomplete

### Deprecation usage

Setting `includeDeprecatedElements: true` adds the `@deprecated` schema elements an operation used to its log entry, so you can tell whether a deprecated element is safe to remove:

```json
{
  "type": "query",
  "operationName": "GetWidget",
  "deprecatedElements": [
    { "kind": "output-field", "name": "Widget.legacyName", "deprecationReason": "Use name.", "path": "widget.legacyName" },
    { "kind": "input-field", "name": "WidgetFilterInput.legacyId", "deprecationReason": "Use id.", "path": "$input.legacyId" }
  ]
}
```

Because these ride on the operation's existing log entry, each record already carries whatever request and user metadata your context logger adds — so the telemetry answers _who_ is still using an element, not just _whether_ anyone is. Aggregate on `name`; `path` is a best-effort debugging aid.

Collection is skipped for operations that `shouldIgnore` or `ignoreIntrospectionQueries` filter out, and for subsequent payloads of an incremental response (the elements belong to the operation, not to each chunk). If collection fails it is logged via the context logger's `warn` and the operation is logged without the key — telemetry never turns a served request into a failed one.

**Check `deprecatedElementsTruncated` before concluding an element is unused.** Any of the three limits can stop collection early, and `maxVariableNodes` is the one a legitimate request can reach — a large batch mutation is shallow but wide. On a truncated entry the list is incomplete, so absence from it is not evidence of non-use. Exclude those entries when querying for usage rather than counting them as zero.

The collection itself is [`collectDeprecatedElementUsage`](https://github.com/MakerXStudio/graphql-core#collectdeprecatedelementusage) from `@makerx/graphql-core`, which documents the detected element kinds and the limitations worth designing around. The same option is available on that package's `useSubscriptionsServer` for the subscription path.

## Introspection Control Plugin

`introspectionControlPlugin` implements a standard pattern of rejecting unauthorized introspection requests in production.

- Unauthorized requests are those that do not have a `user` set on the GraphQL context.
- Production is determined according to `NODE_ENV === 'production'` via [node-common](https://github.com/MakerXStudio/node-common/blob/main/src/environment.ts)

## Apollo Server test helpers

Apollo Server v4 introduced an `executeOperation` function to enable operations to be run directly against the server instance, without requiring an HTTP server or network calls.

Bypassing the HTTP stack supports complete control over JWT payloads and other operation context inputs required to set up complex test scenarios.

The `@makerx/graphql-apollo-server/testing` module exports `buildExecuteOperation`, which accepts an `ApolloServer` instance and a context creation function and returns an `executeOperation` function which:

- is strongly typed to the GraphQL context
- accepts `TypedDocumentNode` operations to provide strong operation typing
- forwards any additional arguments to the supplied context creation function

The shape of the context creation function — and the JWT/user factories used to drive it — depends on your GraphQL implementation, so the examples below illustrate one common pattern using [Vitest test contexts](https://vitest.dev/guide/test-context).

### Vitest auth context example

Note: exact shape depends on your auth implementation.

`test/auth.ts`

```ts
export interface BuildJwtInput {
  oid: string
  tid: string
  sub: string
  iss: string
  aud: string | string[]
  email: string
  name: string
  scopes: string[]
  roles: string[]
  idtyp?: string | 'app'
}

const buildJwt = ({
  oid = randomUUID(),
  tid = randomUUID(),
  sub = randomUUID(),
  iss = randomUUID(),
  aud = randomUUID(),
  email = faker.internet.email(),
  name = faker.person.fullName(),
  scopes = [],
  roles = [],
  ...rest
}: Partial<BuildJwtInput> = {}): JwtPayload => ({
  oid,
  tid,
  sub,
  iss,
  aud,
  email,
  name,
  scp: scopes.join(' '),
  roles,
  ...rest,
})

const buildUserJwt = (input: Partial<BuildJwtInput> = {}): JwtPayload => buildJwt({ ...input, roles: [UserRoles.User] })
const buildSystemAdminJwt = (input: Partial<BuildJwtInput> = {}): JwtPayload => buildJwt({ ...input, roles: [UserRoles.SystemAdmin] })

export const test = baseTest.extend('auth', {
  buildJwt,
  buildUserJwt,
  buildSystemAdminJwt,
})
```

### Vitest GraphQL context example

Note: extend auth context or other context as required.

`test/graphql.ts`

```ts
import { test as baseTest } from './auth'

const requestInfo: RequestInfo = {
  source: 'http',
  protocol: 'http',
  baseUrl: 'http://localhost',
  host: 'localhost',
  url: '/graphql',
  method: 'TEST',
  origin: 'vitest',
  requestId: 'test',
}

const createContext = async (jwtPayload?: JwtPayload): Promise<GraphQLContext> => {
  const user = await findUpdateOrCreateUser(jwtPayload, randomUUID())
  const baseContext: BaseContext = { user, logger, requestInfo, started: Date.now() }
  const extraContext = await augmentContext(baseContext)
  return { ...baseContext, ...extraContext }
}

export const test = baseTest.extend('executeOperation', { scope: 'worker' }, async ({}, { onCleanup }) => {
  const schema = createSchema()
  const server = new ApolloServer<GraphQLContext>({ schema })
  onCleanup(() => server.stop())
  return buildExecuteOperation(server, createContext)
})
```

### hello-query.test.ts

The test files below use the `graphql` template-literal tag from [GraphQL-Codegen](https://the-guild.dev/graphql/codegen/docs/getting-started) to produce strongly typed operations.

```ts
import { describe, expect } from 'vitest'
import { graphql } from './gql'
import { test } from './graphql'

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

  test('authenticated calls work', async ({ executeOperation, buildUserJwt }) => {
    const result = await executeOperation({ query: helloQuery, variables: { message: 'world' } }, buildUserJwt())
    expect(result.data?.hello).toBe('Hello, world!')
  })

  test('user name is returned', async ({ executeOperation, buildUserJwt }) => {
    const result = await executeOperation({ query: helloQuery }, buildUserJwt({ name: 'Magda' }))
    expect(result.data?.hello).toBe('Hello, Magda!')
  })

  test('user email is returned', async ({ executeOperation, buildUserJwt }) => {
    const result = await executeOperation({ query: helloQuery }, buildUserJwt({ email: 'magda@magda.net' }))
    expect(result.data?.hello).toBe('Hello, magda@magda.net!')
  })
})
```

### important-mutation.test.ts

```ts
import { describe, expect } from 'vitest'
import { graphql } from './gql'
import { test } from './graphql'

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

  test('non-admin calls fail', async ({ executeOperation, buildUserJwt }) => {
    const result = await executeOperation({ query: importantMutation }, buildUserJwt())
    expect(result.errors?.[0]?.message).toBe('Not authorized')
  })

  test('admin calls work', async ({ executeOperation, buildSystemAdminJwt }) => {
    const result = await executeOperation({ query: importantMutation }, buildSystemAdminJwt())
    expect(result.data?.important).toBe('Operation successful')
  })
})
```

### me-query.test.ts

This test shows how the context input JWT payload can be easily controlled when operating underneath the HTTP layer where Bearer token validation and decoding would normally be required.

```ts
import { describe, expect } from 'vitest'
import { graphql } from './gql'
import { test } from './graphql'

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

describe('me query operation', () => {
  test('anonymous calls return null', async ({ executeOperation }) => {
    const result = await executeOperation({ query: meQuery })
    expect(result.data?.me).toBeNull()
  })

  test('returns basic user', async ({ executeOperation, buildUserJwt }) => {
    const jwt = buildUserJwt()
    const result = await executeOperation({ query: meQuery }, jwt)
    expect(result.data?.me).toMatchObject({
      id: jwt.oid,
      email: jwt.email,
    })
  })

  test('returns user roles', async ({ executeOperation, buildJwt }) => {
    const jwt = buildJwt({ roles: ['Admin', 'Supervisor'] })
    const result = await executeOperation({ query: meQuery }, jwt)
    expect(result.data?.me).toMatchObject({
      id: jwt.oid,
      email: jwt.email,
      roles: jwt.roles,
    })
  })

  test('returns user name', async ({ executeOperation, buildUserJwt }) => {
    const jwt = buildUserJwt({ name: 'Magda' })
    const result = await executeOperation({ query: meQuery }, jwt)
    expect(result.data?.me).toMatchObject({
      id: jwt.oid,
      email: jwt.email,
      name: jwt.name,
    })
  })
})
```
