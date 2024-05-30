import type { JwtPayload } from '@makerx/graphql-core'
import { randomUUID } from 'node:crypto'

export interface BuildJwtInput {
  oid: string
  tid: string
  sub: string
  email: string
  scopes: string[]
  roles: string[]
  [key: string]: any
}

export function buildJwt({
  oid = randomUUID(),
  tid = randomUUID(),
  sub = randomUUID(),
  email = randomEmail(),
  scopes = [],
  roles = [],
  ...rest
}: Partial<BuildJwtInput> = {}): JwtPayload {
  return {
    oid,
    tid,
    sub,
    email,
    scp: scopes.join(' '),
    roles,
    ...rest,
  }
}

export function randomEmail() {
  return `${(Math.random() + 1).toString(36).substring(7)}@test.net`
}
