import { describe, expect } from 'vitest'
import { buildJwt } from '../jwt'
import { graphql } from './gql'
import { test } from './test-context'

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

  test('non-admin calls fail', async ({ executeOperation }) => {
    const result = await executeOperation({ query: importantMutation }, buildJwt({ roles: ['User'] }))
    expect(result.errors?.[0]?.message).toBe('Not authorized')
  })

  test('admin calls work', async ({ executeOperation }) => {
    const result = await executeOperation({ query: importantMutation }, buildJwt({ roles: ['Admin'] }))
    expect(result.data?.important).toBe('Operation successful')
  })
})
