import type { JwtPayload } from '@makerx/graphql-core'
import { randomUUID } from 'node:crypto'

export interface BuildJwtInput {
  oid: string
  tid: string
  sub: string
  email: string
  scopes: string[]
  roles: string[]
  [key: string]: unknown
}

/**
 *
 * @param Optional JWT input
 * @returns A JWT payload with oid, tid and sub claims set to random values if not provided
 */
export function buildJwt({
  oid = randomUUID(),
  tid = randomUUID(),
  sub = randomUUID(),
  scopes = [],
  roles = [],
  ...rest
}: Partial<BuildJwtInput> = {}): JwtPayload {
  return {
    oid,
    tid,
    sub,
    scp: scopes.join(' '),
    roles,
    ...rest,
  }
}

/**
 *
 * @param Optional JWT input
 * @returns A JWT payload with oid, tid, sub and email claims set to random values if not provided
 */
export function buildUserJwt({ email = randomEmail(), ...rest }: Partial<BuildJwtInput> = {}): JwtPayload {
  return buildJwt({
    email,
    ...rest,
  })
}

export function randomEmail() {
  return `${(Math.random() + 1).toString(36).substring(2)}@test.net`
}
