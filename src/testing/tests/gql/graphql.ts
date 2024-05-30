/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> }
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> }
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never }
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string }
  String: { input: string; output: string }
  Boolean: { input: boolean; output: boolean }
  Int: { input: number; output: number }
  Float: { input: number; output: number }
}

export type Mutation = {
  __typename?: 'Mutation'
  /**
   * Runs an important operation.
   * The caller must have the `Admin` role to run this mutation.
   */
  important: Scalars['String']['output']
}

export type Query = {
  __typename?: 'Query'
  /**
   * Returns a hello message.
   * The `message` argument will be returned if supplied, otherwise the user's name or email will be used.
   * The caller must be logged in to run this query.
   */
  hello: Scalars['String']['output']
  /** Returns the current user or null if not logged in. */
  me?: Maybe<User>
}

export type QueryHelloArgs = {
  message?: InputMaybe<Scalars['String']['input']>
}

/** A user of the system. */
export type User = {
  __typename?: 'User'
  email?: Maybe<Scalars['String']['output']>
  id: Scalars['ID']['output']
  name?: Maybe<Scalars['String']['output']>
  roles: Array<Scalars['String']['output']>
}

export type HelloQueryVariables = Exact<{
  message?: InputMaybe<Scalars['String']['input']>
}>

export type HelloQuery = { __typename?: 'Query'; hello: string }

export type ImportantMutationVariables = Exact<{ [key: string]: never }>

export type ImportantMutation = { __typename?: 'Mutation'; important: string }

export type MeQueryVariables = Exact<{ [key: string]: never }>

export type MeQuery = {
  __typename?: 'Query'
  me?: { __typename?: 'User'; id: string; name?: string | null; email?: string | null; roles: Array<string> } | null
}

export const HelloDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'Hello' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'message' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'hello' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'message' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'message' } },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<HelloQuery, HelloQueryVariables>
export const ImportantDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'Important' },
      selectionSet: { kind: 'SelectionSet', selections: [{ kind: 'Field', name: { kind: 'Name', value: 'important' } }] },
    },
  ],
} as unknown as DocumentNode<ImportantMutation, ImportantMutationVariables>
export const MeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'Me' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'me' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                { kind: 'Field', name: { kind: 'Name', value: 'roles' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MeQuery, MeQueryVariables>
