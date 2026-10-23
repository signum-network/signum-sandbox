import { useQueries, useQuery } from '@tanstack/react-query'
import type { Block } from '@signumjs/core'
import { ledger } from '@/lib/ledger'
import { isTransaction, type FeedItem, type FeedTransaction } from '@/lib/chainFeed'
import { PAGE_SIZE } from '@/lib/paginate'
import type { Query, ResolvedQuery } from '@/lib/search'

/**
 * How many accounts a name search asks the node about. A short name matches
 * as a substring, so "a" can name most of the address book; the first few are
 * the ones anyone typing that little was likely after.
 */
const MAX_LOOKUP_ACCOUNTS = 10

/**
 * The transactions a search names, asked of the node directly.
 *
 * The stream only holds the recent end of the chain, so a transaction id, a
 * block height or an account whose activity lies further back — one picked
 * from the Blocks tab, say — would otherwise match nothing. An id or a height
 * is fetched only when the stream does not already have the answer, so a
 * search over what is on screen never touches the network. An account always
 * is: the stream holding some of its transactions says nothing about whether
 * it holds all of the recent ones.
 */
export function useTransactionLookup(resolved: ResolvedQuery, items: FeedItem[]): FeedTransaction[] {
  const { query, accountIds } = resolved
  const id = query.kind === 'id' ? query.value : null
  const height = query.kind === 'height' ? query.height : null
  const held =
    (id !== null && items.some((item) => item.id === id)) ||
    (height !== null && items.some((item) => item.tx.height === height))

  const direct = useQuery({
    queryKey: ['txLookup', id, height],
    queryFn: async (): Promise<FeedTransaction[]> => {
      // An id that is no transaction, or a height the chain has not reached,
      // is an answer of nothing rather than an error worth showing.
      try {
        if (id !== null) return [await ledger.transaction.getTransaction(id)]
        if (height !== null) {
          const block = await ledger.block.getBlockByHeight(height, true)
          return (block.transactions ?? []).filter(isTransaction)
        }
      } catch {
        // fall through
      }
      return []
    },
    enabled: (id !== null || height !== null) && !held,
    retry: false,
  })

  const byAccount = query.kind === 'address' || query.kind === 'name'
  const lookupIds = byAccount ? [...accountIds].slice(0, MAX_LOOKUP_ACCOUNTS) : []
  const accountHistories = useQueries({
    queries: lookupIds.map((accountId) => ({
      // Under 'accountTransactions' so a new block refreshes it with the rest,
      // and distinct from the account detail's own key, which asks for less.
      queryKey: ['accountTransactions', accountId, 'search'],
      queryFn: async (): Promise<FeedTransaction[]> => {
        try {
          const { transactions } = await ledger.account.getAccountTransactions({
            accountId,
            firstIndex: 0,
            lastIndex: PAGE_SIZE - 1,
          })
          return transactions
        } catch {
          // An id nobody has used yet is not on chain, and has no history.
          return []
        }
      },
      retry: false,
    })),
  })

  if (byAccount) return accountHistories.flatMap((history) => history.data ?? [])
  return held ? [] : (direct.data ?? [])
}

/**
 * The block a search names, asked of the node directly.
 *
 * The Blocks tab holds one page of the chain at a time, so a height or a
 * block id from any other page would match nothing on it. Only those two can
 * be fetched by themselves; a forger search still filters the page on screen.
 */
export function useBlockLookup(query: Query, page: Block[]): Block[] {
  const height = query.kind === 'height' ? query.height : null
  const id = query.kind === 'id' ? query.value : null
  const held = page.some((block) => block.height === height || block.block === id)

  const { data } = useQuery({
    queryKey: ['blockLookup', id, height],
    queryFn: async (): Promise<Block[]> => {
      // An id is just as likely a transaction's or an account's, and a height
      // can lie past the tip: neither is an error, only no block.
      try {
        if (height !== null) return [await ledger.block.getBlockByHeight(height, true)]
        if (id !== null) return [await ledger.block.getBlockById(id, true)]
      } catch {
        // fall through
      }
      return []
    },
    enabled: (id !== null || height !== null) && !held,
    retry: false,
  })

  return held ? page : [...page, ...(data ?? [])]
}
