import { describe, expect } from 'vitest'
import { buildJwt } from '../jwt'
import { graphql } from './gql'
import { test } from './test-context'

const helloQuery = graphql(`
  query Hello($message: String) {
    hello(message: $message)
  }
`)

describe('hello query operation', () => {
  test('anonymous calls fail', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery, variables: { message: 'world' } })
    expect(result.errors?.[0]?.message).toBe('Not authenticated')
  })

  test('authenticated calls work', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery, variables: { message: 'world' } }, buildJwt())
    expect(result.data?.hello).toBe('Hello, world!')
  })

  test('user name is returned', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery }, buildJwt({ name: 'Magda' }))
    expect(result.data?.hello).toBe('Hello, Magda!')
  })

  test('user email is returned', async ({ executeOperation }) => {
    const result = await executeOperation({ query: helloQuery }, buildJwt({ email: 'magda@magda.net' }))
    expect(result.data?.hello).toBe('Hello, magda@magda.net!')
  })
})
