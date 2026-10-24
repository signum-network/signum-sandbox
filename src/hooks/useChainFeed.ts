import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Block, Transaction } from '@signumjs/core'
import { ledger } from '@/lib/ledger'
import { isTransaction, mergeFeed, walkBack, type FeedItem } from '@/lib/chainFeed'
import { PAGE_SIZE, pageRange } from '@/lib/paginate'

/**
 * How far back the live stream looks: at least one page of blocks, and back
 * past however many empty ones it takes to fill a page of transactions. The
 * Blocks tab is where you walk the whole chain.
 */
const WALK_TARGET = { minBlocks: PAGE_SIZE, minTransactions: PAGE_SIZE }

const BLOCKS_KEY = ['blocks']

export function useBlocks(height: number | null, connected: boolean) {
  const queryClient = useQueryClient()
  return useQuery({
    // height is deliberately not part of the key: a changing key forces a hard
    // TanStack Query transition (data goes undefined until refetch), which
    // unmounts the feed's <ul> for its "empty" placeholder on every block and
    // destroys each row's open/closed state. useNodeSocket already invalidates
    // ['blocks'] on BLOCK_PUSHED, so a stable key plus that invalidation is
    // enough; refetchInterval below covers the socket-down case.
    queryKey: BLOCKS_KEY,
    queryFn: () =>
      walkBack(
        async (firstIndex, lastIndex) =>
          (await ledger.block.getBlocks(firstIndex, lastIndex, true)).blocks,
        // The last walk, so a new block costs one request rather than a walk
        // back through every empty block since the last transaction.
        queryClient.getQueryData<Block[]>(BLOCKS_KEY) ?? [],
        WALK_TARGET,
      ),
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

/**
 * One page of blocks, newest first, straight from the node.
 *
 * The stream's own window is fixed at the most recent page, so paging the
 * Blocks tab must not drag it along — hence a separate query with the page in
 * its key rather than a shared one. getBlocks counts backwards from the tip,
 * so page zero is the newest blocks.
 *
 * A new key would leave the data undefined until the next page arrives, and
 * the list would flash empty between the two. The page on screen stays until
 * the next one is in hand instead, and carries its own page number, so the
 * view turns the page once, when there is something to turn to.
 */
export function useBlockPage(page: number, connected: boolean, enabled: boolean) {
  const { firstIndex, lastIndex } = pageRange(page)
  return useQuery({
    queryKey: ['blockPage', firstIndex],
    queryFn: async () => {
      const { blocks } = await ledger.block.getBlocks(firstIndex, lastIndex, true)
      return { page, blocks }
    },
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: connected ? false : 10_000,
    retry: false,
  })
}
