import type { Block, Transaction } from '@signumjs/core'

export type FeedTransaction = Transaction

export interface FeedItem {
  id: string
  confirmed: boolean
  tx: FeedTransaction
}

/**
 * Block.transactions is typed as string[] | Transaction[]: ids unless the
 * request asked for the whole objects. Every caller here asks for objects
 * (see useChainFeed and BlockRow), so this guard is what makes that
 * assumption explicit instead of a cast repeated at each call site.
 */
export const isTransaction = (t: string | Transaction): t is Transaction => typeof t !== 'string'

const newestFirst = (a: FeedTransaction, b: FeedTransaction) => b.timestamp - a.timestamp

/**
 * A sender sets tx.timestamp before broadcasting, so a transaction built early
 * but confirmed late can carry a smaller timestamp than one from a later
 * block. Height comes from the block itself and is authoritative, so it sorts
 * first; timestamp only breaks ties within the same block.
 */
const newestBlockFirst = (a: FeedTransaction, b: FeedTransaction) =>
  (b.height ?? 0) - (a.height ?? 0) || b.timestamp - a.timestamp

/**
 * A transaction lives in the unconfirmed list until the node has digested the
 * block containing it, so during that window both sources return it. The
 * confirmed copy wins: it is the one carrying a block height.
 */
export function mergeFeed(
  unconfirmed: FeedTransaction[],
  confirmed: FeedTransaction[],
): FeedItem[] {
  const confirmedIds = new Set(confirmed.map((t) => t.transaction))
  return [
    ...[...unconfirmed]
      .filter((t) => !confirmedIds.has(t.transaction))
      .sort(newestFirst)
      .map((tx) => ({ id: tx.transaction, confirmed: false, tx })),
    ...[...confirmed]
      .sort(newestBlockFirst)
      .map((tx) => ({ id: tx.transaction, confirmed: true, tx })),
  ]
}

/**
 * The most blocks one getBlocks call returns. The node caps the range at 100
 * whatever lastIndex says — verified against v3.9.11 — so asking for more only
 * looks like it worked.
 */
export const BLOCKS_PER_REQUEST = 100

export interface WalkTarget {
  /** Never fewer blocks than this, so the window at the tip is always there. */
  minBlocks: number
  /** Keep walking back until this many transactions are in hand, or genesis. */
  minTransactions: number
}

/**
 * The blocks the stream reads its confirmed transactions from, newest first
 * and contiguous from the tip down.
 *
 * A fixed window at the tip is not enough: an auto-forged sandbox makes empty
 * blocks for as long as it runs, so after a few hundred of them the last
 * transaction falls out of any window and the stream claims there are none.
 * So the walk goes back until it has enough transactions to show, or reaches
 * genesis.
 *
 * Walking the whole way on every block would cost a request per hundred
 * blocks for each new one, so `previous` — the last walk's result — is reused:
 * as soon as the walk meets a block it already has, by id, the rest is taken
 * from there. Matching on id rather than height is what keeps this right after
 * a rewind, where the heights below the new tip are unchanged, and after a
 * node restart, where the same heights belong to different blocks and the
 * walk starts over.
 */
export async function walkBack(
  fetchRange: (firstIndex: number, lastIndex: number) => Promise<Block[]>,
  previous: Block[],
  target: WalkTarget,
): Promise<Block[]> {
  const known = new Map(previous.map((block, index) => [block.block, index]))
  const walked: Block[] = []
  let transactions = 0
  const enough = () => walked.length >= target.minBlocks && transactions >= target.minTransactions

  for (let firstIndex = 0; !enough(); firstIndex += BLOCKS_PER_REQUEST) {
    const chunk = await fetchRange(firstIndex, firstIndex + BLOCKS_PER_REQUEST - 1)
    for (const block of chunk) {
      const seen = known.get(block.block)
      if (seen !== undefined) return trim([...walked, ...previous.slice(seen)], target)
      walked.push(block)
      transactions += block.numberOfTransactions
    }
    // A short page is the bottom of the chain.
    if (chunk.length < BLOCKS_PER_REQUEST) break
  }
  return trim(walked, target)
}

/**
 * The node hands out blocks a hundred at a time, and splicing a new block onto
 * the last walk makes the result one block longer each time, so it is cut back to the shortest prefix that still meets the
 * target. A prefix that never meets it reached genesis, and stays whole.
 */
function trim(blocks: Block[], target: WalkTarget): Block[] {
  let transactions = 0
  for (let i = 0; i < blocks.length; i++) {
    transactions += blocks[i].numberOfTransactions
    if (i + 1 >= target.minBlocks && transactions >= target.minTransactions) {
      return blocks.slice(0, i + 1)
    }
  }
  return blocks
}

/**
 * Transactions a search fetched directly, added to the stream where it does
 * not already hold them, so that a transaction too old for the walk can still
 * be shown in full by asking for it. A copy carrying a block is confirmed.
 *
 * They go below the stream, newest block first: anything the stream lacks is
 * older than its window. Several accounts' histories can name the same
 * transaction — a payment between two of them — so it is kept once.
 */
export function withLookups(items: FeedItem[], found: FeedTransaction[]): FeedItem[] {
  const ids = new Set(items.map((item) => item.id))
  const extra = found.filter((tx) => !ids.has(tx.transaction) && ids.add(tx.transaction))
  if (extra.length === 0) return items
  return [
    ...items,
    ...extra
      .sort(newestBlockFirst)
      .map((tx) => ({ id: tx.transaction, confirmed: tx.block !== undefined, tx })),
  ]
}
