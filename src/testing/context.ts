import { User, type GraphQLContext, type JwtPayload, type RequestInfo } from '@makerx/graphql-core'
import type { Logger } from '@makerx/node-common'

const requestInfo: RequestInfo = {
  protocol: 'http',
  host: 'localhost',
  url: 'http://localhost/graphql',
  method: 'POST',
  origin: 'test-origin',
  requestId: 'test-request',
}

const logger: Logger = {
  debug: () => {},
  verbose: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

export async function createTestContext(jwtPayload?: JwtPayload): Promise<GraphQLContext> {
  const user = jwtPayload ? new User(jwtPayload, '') : undefined
  return {
    logger,
    requestInfo,
    user,
    started: Date.now(),
  }
}
