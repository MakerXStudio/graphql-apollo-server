import type { Resolvers } from './gql/resolvers'

export const resolvers: Resolvers = {
  Query: {
    hello: (_, args, { user }) => {
      if (!user) throw new Error('Not authenticated')
      const message = args.message ?? user.name ?? user.email
      return `Hello, ${message}!`
    },
  },
}
