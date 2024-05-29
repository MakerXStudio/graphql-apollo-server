import type { GraphQLContext } from '@makerx/graphql-core'
import { describe, expect, test as testBase } from 'vitest'
import { createTestContext } from '../context'
import { buildExecuteOperation } from '../execute-operation'
import { buildJwt } from '../jwt'
import { graphql } from './gql'
import { createTestServer } from './server'

const helloQuery = graphql(`
  query Hello($message: String) {
    hello(message: $message)
  }
`)

interface TestContext {
  executeOperation: ReturnType<typeof buildExecuteOperation<GraphQLContext, typeof createTestContext>>
}

export const test = testBase.extend<TestContext>({
  executeOperation: async ({}, use) => {
    const server = createTestServer<GraphQLContext>()
    const executeOperation = buildExecuteOperation(server, createTestContext)
    await use(executeOperation)
    server.stop()
  },
})

describe('graphql tests using executeOperation', () => {
  test('anonymous call fails', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery, variables: { message: 'world' } })
    expect(result.errors?.[0]?.message).toBe('Not authenticated')
  })

  test('authenticated call succeeds', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery, variables: { message: 'world' } }, buildJwt())
    expect(result.data?.hello).toBe('Hello, world!')
  })

  test('receives user name from context', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery }, buildJwt({ name: 'Magda' }))
    expect(result.data?.hello).toBe('Hello, Magda!')
  })

  test('receives email from context', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery }, buildJwt({ email: 'magda@magda.net' }))
    expect(result.data?.hello).toBe('Hello, magda@magda.net!')
  })
})
