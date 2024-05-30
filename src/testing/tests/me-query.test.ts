import { describe, expect } from 'vitest'
import { buildJwt } from '../jwt'
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
