import { ApolloServer } from '@apollo/server'
import * as graphqlCore from '@makerx/graphql-core'
import type { GraphQLContext } from '@makerx/graphql-core'
import { buildSchema } from 'graphql'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GraphQLOperationLoggingPluginOptions } from './graphql-operation-logging-plugin'
import { graphqlOperationLoggingPlugin } from './graphql-operation-logging-plugin'

/**
 * Output fields are all nullable and there are no resolvers, so the default resolver returning
 * `undefined` produces a clean, error-free response without needing an executable schema.
 */
const schema = buildSchema(/* GraphQL */ `
  type Query {
    widget(id: ID, legacyId: ID @deprecated(reason: "Use id.")): Widget
  }

  type Mutation {
    saveWidget(input: WidgetFilterInput!): Widget
  }

  type Widget {
    name: String
    legacyName: String @deprecated(reason: "Use name.")
  }

  input WidgetFilterInput {
    id: ID
    legacyId: ID @deprecated(reason: "Use id.")
  }
`)

const makeLogger = () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), verbose: vi.fn(), debug: vi.fn(), audit: vi.fn() })

type TestLogger = ReturnType<typeof makeLogger>
type TestContext = GraphQLContext<TestLogger, any, undefined>

interface TestRequest {
  query: string
  variables?: Record<string, any>
  operationName?: string
}

async function run(request: TestRequest, options: GraphQLOperationLoggingPluginOptions<TestContext, TestLogger> = {}) {
  const logger = makeLogger()
  const contextValue: TestContext = { logger, requestInfo: {}, user: undefined, started: Date.now() }
  const server = new ApolloServer<TestContext>({
    schema,
    plugins: [graphqlOperationLoggingPlugin<TestContext, TestLogger>({ logLevel: 'audit', ...options })],
  })
  await server.start()
  try {
    const response = await server.executeOperation(request, { contextValue })
    const result = response.body.kind === 'single' ? response.body.singleResult : undefined
    return { logger, errors: result?.errors, entry: logger.audit.mock.calls[0]?.[1] as Record<string, any> | undefined }
  } finally {
    await server.stop()
  }
}

const widgetWithDeprecatedField = /* GraphQL */ `
  query GetWidget {
    widget(id: "w1") {
      legacyName
    }
  }
`

const widgetWithoutDeprecatedElements = /* GraphQL */ `
  query GetWidget {
    widget(id: "w1") {
      name
    }
  }
`

describe('graphqlOperationLoggingPlugin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs the operation via the configured level and not via any other', async () => {
    const { logger, entry } = await run({ query: widgetWithoutDeprecatedElements, operationName: 'GetWidget' })

    expect(logger.audit).toHaveBeenCalledTimes(1)
    expect(logger.info).not.toHaveBeenCalled()
    expect(entry).toMatchObject({ type: 'query', operationName: 'GetWidget' })
  })

  it('resolves the logger via resolveLogger in preference to the context logger', async () => {
    const custom = makeLogger()

    const { logger } = await run({ query: widgetWithoutDeprecatedElements }, { resolveLogger: () => custom })

    expect(custom.audit).toHaveBeenCalledTimes(1)
    expect(logger.audit).not.toHaveBeenCalled()
  })

  it('logs nothing when shouldIgnore returns true', async () => {
    const { logger } = await run({ query: widgetWithoutDeprecatedElements }, { shouldIgnore: () => true })

    expect(logger.audit).not.toHaveBeenCalled()
  })

  it('does not log introspection queries by default', async () => {
    const { logger } = await run({
      query: /* GraphQL */ `
        {
          __schema {
            types {
              name
            }
          }
        }
      `,
    })

    expect(logger.audit).not.toHaveBeenCalled()
  })

  it('detects an introspection query sent as a persisted query, which carries no query text', async () => {
    // Introspection is detected from `ctx.source`, not `ctx.request.query`: an automatic persisted
    // query omits the latter once registered, so detecting from it would log every APQ introspection.
    const query = /* GraphQL */ `
      {
        __schema {
          types {
            name
          }
        }
      }
    `
    const sha256Hash = createHash('sha256').update(query).digest('hex')
    const logger = makeLogger()
    const contextValue: TestContext = { logger, requestInfo: {}, user: undefined, started: Date.now() }
    const server = new ApolloServer<TestContext>({
      schema,
      plugins: [graphqlOperationLoggingPlugin<TestContext, TestLogger>({ logLevel: 'audit' })],
    })
    await server.start()

    try {
      const extensions = { persistedQuery: { version: 1, sha256Hash } }
      // Registers the document against its hash, then replays it by hash alone.
      await server.executeOperation({ query, extensions }, { contextValue })
      const replay = await server.executeOperation({ extensions }, { contextValue })

      const replayResult = replay.body.kind === 'single' ? replay.body.singleResult : undefined
      expect(replayResult?.errors).toBeUndefined()
      expect(logger.audit).not.toHaveBeenCalled()
    } finally {
      await server.stop()
    }
  })

  describe('deprecatedElements', () => {
    it('is absent unless collection is requested', async () => {
      const { entry } = await run({ query: widgetWithDeprecatedField })

      expect(entry).not.toHaveProperty('deprecatedElements')
    })

    it('reports elements named in the document', async () => {
      const { entry } = await run({ query: widgetWithDeprecatedField }, { includeDeprecatedElements: true })

      expect(entry?.deprecatedElements).toEqual([
        { kind: 'output-field', name: 'Widget.legacyName', deprecationReason: 'Use name.', path: 'widget.legacyName' },
      ])
    })

    it('reports input fields supplied via variables, which never appear in the document', async () => {
      const { entry } = await run(
        {
          query: /* GraphQL */ `
            mutation SaveWidget($input: WidgetFilterInput!) {
              saveWidget(input: $input) {
                name
              }
            }
          `,
          variables: { input: { legacyId: 'w1' } },
        },
        { includeDeprecatedElements: true },
      )

      expect(entry?.deprecatedElements).toEqual([
        { kind: 'input-field', name: 'WidgetFilterInput.legacyId', deprecationReason: 'Use id.', path: '$input.legacyId' },
      ])
    })

    it('omits the key entirely when the operation used no deprecated element', async () => {
      const { entry } = await run({ query: widgetWithoutDeprecatedElements }, { includeDeprecatedElements: true })

      expect(entry).toBeDefined()
      expect(entry).not.toHaveProperty('deprecatedElements')
    })

    it('flags truncation when the element cap is reached', async () => {
      const query = /* GraphQL */ `
        query GetWidget {
          widget(legacyId: "w1") {
            legacyName
          }
        }
      `

      const capped = await run({ query }, { includeDeprecatedElements: true, maxElements: 1 })
      expect(capped.entry?.deprecatedElements).toHaveLength(1)
      expect(capped.entry?.deprecatedElementsTruncated).toBe(true)

      const uncapped = await run({ query }, { includeDeprecatedElements: true })
      expect(uncapped.entry?.deprecatedElements).toHaveLength(2)
      expect(uncapped.entry).not.toHaveProperty('deprecatedElementsTruncated')
    })

    it('serves the request and warns when collection fails', async () => {
      vi.spyOn(graphqlCore, 'collectDeprecatedElementUsage').mockImplementation(() => {
        throw new Error('boom')
      })

      const { logger, errors, entry } = await run({ query: widgetWithDeprecatedField }, { includeDeprecatedElements: true })

      expect(errors).toBeUndefined()
      expect(entry).not.toHaveProperty('deprecatedElements')
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to collect deprecated schema element usage',
        expect.objectContaining({ error: expect.any(Error) }),
      )
    })

    it('leaves variable coercion failures to graphql, reporting no elements', async () => {
      // The walk reads raw variables before coercion, so a shape that contradicts the declared type
      // reaches it. The request must still fail on graphql's own error and no other.
      const { errors, entry } = await run(
        {
          query: /* GraphQL */ `
            mutation SaveWidget($input: WidgetFilterInput!) {
              saveWidget(input: $input) {
                name
              }
            }
          `,
          variables: { input: 'not-an-object' },
        },
        { includeDeprecatedElements: true },
      )

      expect(errors?.map((error) => error.message)).toEqual([
        expect.stringMatching(/^Variable "\$input" got invalid value .*Expected type "WidgetFilterInput" to be an object\.$/),
      ])
      expect(entry).not.toHaveProperty('deprecatedElements')
    })

    it('is not collected for introspection queries, which are skipped before collection', async () => {
      const collect = vi.spyOn(graphqlCore, 'collectDeprecatedElementUsage')

      await run(
        {
          query: /* GraphQL */ `
            {
              __schema {
                types {
                  name
                }
              }
            }
          `,
        },
        { includeDeprecatedElements: true },
      )

      expect(collect).not.toHaveBeenCalled()
    })
  })

  it('merges augmentLogEntry properties into the entry', async () => {
    const { entry } = await run({ query: widgetWithoutDeprecatedElements }, { augmentLogEntry: () => ({ tenant: 'acme' }) })

    expect(entry?.tenant).toBe('acme')
  })

  it('rejects a log level the logger does not have', () => {
    graphqlOperationLoggingPlugin<TestContext, TestLogger>({
      // @ts-expect-error 'nope' is not a method on TestLogger
      logLevel: 'nope',
    })
  })
})
