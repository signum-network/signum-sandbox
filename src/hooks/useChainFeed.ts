import { useQuery } from '@tanstack/react-query'
import type { Block, Transaction } from '@signumjs/core'
import { ledger } from '@/lib/ledger'
import { mergeFeed, type FeedItem } from '@/lib/chainFeed'

/** How far back the console looks. A sandbox chain is short; this is generous. */
const RECENT_BLOCKS = 25

export function useBlocks(height: number | null) {
  return useQuery({
    queryKey: ['blocks', height],
    queryFn: async () => {
      const firstIndex = 0
      const lastIndex = RECENT_BLOCKS - 1
      const { blocks } = await ledger.block.getBlocks(firstIndex, lastIndex, true)
      return blocks
    },
    enabled: height !== null,
    retry: false,
  })
}

export function useChainFeed(height: number | null): {
  items: FeedItem[]
  blocks: Block[]
} {
  const blocks = useBlocks(height)

  const unconfirmed = useQuery({
    queryKey: ['unconfirmed'],
    queryFn: async () => {
      const { unconfirmedTransactions } = await ledger.transaction.getUnconfirmedTransactions()
      return unconfirmedTransactions
    },
    retry: false,
  })

  // Block.transactions is typed as string[] | Transaction[]: ids unless the
  // request asked for the whole objects, which ours does. The guard is what
  // makes that assumption explicit instead of a cast.
  const isTransaction = (t: string | Transaction): t is Transaction => typeof t !== 'string'
  const confirmed: Transaction[] = (blocks.data ?? []).flatMap((b) =>
    (b.transactions ?? []).filter(isTransaction),
  )

  return {
    items: mergeFeed(unconfirmed.data ?? [], confirmed),
    blocks: blocks.data ?? [],
  }
}
