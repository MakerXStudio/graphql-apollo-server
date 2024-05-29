import type { ApolloServer, GraphQLRequest } from '@apollo/server'
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import type { AnyGraphqlContext } from '@makerx/graphql-core'
import type { DocumentNode, FormattedExecutionResult } from 'graphql'

export type VariableValues = { [key: string]: any }

export type TypedGraphQLRequest<TData = Record<string, unknown>, TVariables extends VariableValues = VariableValues> = Omit<
  GraphQLRequest<TVariables>,
  'query'
> & {
  query?: string | DocumentNode | TypedDocumentNode<TData, TVariables>
}

export type ExecuteOperation = <
  TContext extends AnyGraphqlContext,
  TContextFunction extends (...args: any) => Promise<TContext>,
  TData = Record<string, unknown>,
  TVariables extends VariableValues = VariableValues,
>(
  request: TypedGraphQLRequest<TData, TVariables>,
  ...createContextArgs: Parameters<TContextFunction>
) => Promise<FormattedExecutionResult<TData>>

export function buildExecuteOperation<TContext extends AnyGraphqlContext, TContextFunction extends (...args: any) => Promise<TContext>>(
  server: ApolloServer<TContext>,
  createContext: TContextFunction,
) {
  return async function executeOperation<TData = Record<string, unknown>, TVariables extends VariableValues = VariableValues>(
    request: TypedGraphQLRequest<TData, TVariables>,
    ...createContextArgs: Parameters<TContextFunction>
  ): Promise<FormattedExecutionResult<TData>> {
    const response = await server.executeOperation(request, {
      contextValue: await createContext(...createContextArgs),
    })
    if (response.body.kind !== 'single') throw new Error('Incremental responses are not supported by this testing utility function')
    return response.body.singleResult as FormattedExecutionResult<TData>
  }
}
