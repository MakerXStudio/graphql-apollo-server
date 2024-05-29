import type { GraphQLContext } from '@makerx/graphql-core'
import { test as testBase } from 'vitest'
import { createTestContext } from '../context'
import { buildExecuteOperation } from '../execute-operation'
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
