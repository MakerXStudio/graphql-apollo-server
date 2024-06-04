import { describe, expect } from 'vitest'
import { buildJwt, buildUserJwt } from '../jwt'
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
  app: buildJwt(),
  user: buildUserJwt(),
  userWithRoles: buildUserJwt({ roles: ['Admin', 'Supervisor'] }),
  userWithName: buildUserJwt({ name: 'Magda' }),
}

describe('me query operation', () => {
  test('anonymous calls return null', async ({ executeOperation }) => {
    const result = await executeOperation({ query: meQuery })
    expect(result.data?.me).toBeNull()
  })

  test('returns basic app (no email)', async ({ executeOperation }) => {
    const result = await executeOperation({ query: meQuery }, jwtPayloads.app)
    expect(result.data?.me).toMatchObject({
      id: jwtPayloads.app.oid,
    })
  })

  test('returns basic user (with email)', async ({ executeOperation }) => {
    const result = await executeOperation({ query: meQuery }, jwtPayloads.user)
    expect(result.data?.me).toMatchObject({
      id: jwtPayloads.user.oid,
      email: jwtPayloads.user.email,
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
