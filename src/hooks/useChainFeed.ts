import { useQuery } from '@tanstack/react-query'
import type { Block, Transaction } from '@signumjs/core'
import { ledger } from '@/lib/ledger'
import { isTransaction, mergeFeed, type FeedItem } from '@/lib/chainFeed'

/** How far back the console looks. A sandbox chain is short; this is generous. */
const RECENT_BLOCKS = 25

export function useBlocks(height: number | null, connected: boolean) {
  return useQuery({
    // height is deliberately not part of the key: a changing key forces a hard
    // TanStack Query transition (data goes undefined until refetch), which
    // unmounts the feed's <ul> for its "empty" placeholder on every block and
    // destroys each row's open/closed state. useNodeSocket already invalidates
    // ['blocks'] on BLOCK_PUSHED, so a stable key plus that invalidation is
    // enough; refetchInterval below covers the socket-down case.
    queryKey: ['blocks'],
    queryFn: async () => {
      const firstIndex = 0
      const lastIndex = RECENT_BLOCKS - 1
      const { blocks } = await ledger.block.getBlocks(firstIndex, lastIndex, true)
      return blocks
    },
    enabled: height !== null,
    refetchInterval: connected ? false : 10_000,
    retry: false,
  })
}

export function useChainFeed(
  height: number | null,
  connected: boolean,
): {
  items: FeedItem[]
  blocks: Block[]
} {
  const blocks = useBlocks(height, connected)

  const unconfirmed = useQuery({
    queryKey: ['unconfirmed'],
    queryFn: async () => {
      const { unconfirmedTransactions } = await ledger.transaction.getUnconfirmedTransactions()
      return unconfirmedTransactions
    },
    refetchInterval: connected ? false : 10_000,
    retry: false,
  })

  const confirmed: Transaction[] = (blocks.data ?? []).flatMap((b) =>
    (b.transactions ?? []).filter(isTransaction),
  )

  return {
    items: mergeFeed(unconfirmed.data ?? [], confirmed),
    blocks: blocks.data ?? [],
  }
}
