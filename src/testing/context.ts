import { User, type GraphQLContext, type JwtPayload, type RequestInfo } from '@makerx/graphql-core'
import type { Logger } from '@makerx/node-common'

/**
 * A basic RequestInfo constant suitable for test GraphQL contexts (which expect `RequestInfo` but have no HTTP request to build one).
 */
const testRequestInfo: RequestInfo = {
  protocol: 'http',
  host: 'localhost',
  url: 'http://localhost/graphql',
  method: 'POST',
  origin: 'test-origin',
  requestId: 'test-request',
}

/**
 * A no-op logger suitable for test GraphQL contexts if you wish to avoid using a real logger.
 */
export const noOpLogger: Logger = {
  debug: () => {},
  verbose: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

/**
 * Builds a basic GraphQLContext for testing purposes using the supplied JWT payload.
 */
export async function createTestContext(jwtPayload?: JwtPayload): Promise<GraphQLContext> {
  const user = jwtPayload ? new User(jwtPayload, '') : undefined
  return {
    logger: noOpLogger,
    requestInfo: testRequestInfo,
    user,
    started: Date.now(),
  }
}
