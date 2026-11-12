import { describe, expect, it } from 'vitest'
import type { Block } from '@signumjs/core'
import {
  BLOCKS_PER_REQUEST,
  PROBE_SIZE,
  fetchFullRange,
  mergeFeed,
  walkBack,
  withLookups,
  type FeedTransaction,
} from './chainFeed'

const tx = (
  id: string,
  timestamp: number,
  confirmations?: number,
  height?: number,
): FeedTransaction => ({ transaction: id, timestamp, confirmations, height }) as FeedTransaction

describe('mergeFeed', () => {
  it('puts unconfirmed transactions above confirmed ones regardless of time', () => {
    const feed = mergeFeed([tx('u1', 10)], [tx('c1', 999)])
    expect(feed.map((f) => f.id)).toEqual(['u1', 'c1'])
  })

  it('orders each group newest first', () => {
    const feed = mergeFeed([tx('u1', 5), tx('u2', 9)], [tx('c1', 1), tx('c2', 3)])
    expect(feed.map((f) => f.id)).toEqual(['u2', 'u1', 'c2', 'c1'])
  })

  it('marks which group each item came from', () => {
    const feed = mergeFeed([tx('u1', 5)], [tx('c1', 1)])
    expect(feed[0].confirmed).toBe(false)
    expect(feed[1].confirmed).toBe(true)
  })

  it('drops a transaction that appears in both, keeping the confirmed one', () => {
    const feed = mergeFeed([tx('x', 5)], [tx('x', 5, 1)])
    expect(feed).toHaveLength(1)
    expect(feed[0].confirmed).toBe(true)
  })

  it('survives a chain reset, where the confirmed set is suddenly empty', () => {
    expect(mergeFeed([], [])).toEqual([])
  })

  it('orders confirmed transactions by block height, not by timestamp', () => {
    // c1 was built earlier (lower timestamp) but confirmed in the later, higher block.
    const feed = mergeFeed([], [tx('c1', 5, undefined, 20), tx('c2', 999, undefined, 10)])
    expect(feed.map((f) => f.id)).toEqual(['c1', 'c2'])
  })
})

/** A chain of `length` blocks, tip first, with transactions at the given heights. */
const chain = (length: number, withTx: number[] = [], prefix = 'b'): Block[] =>
  Array.from({ length }, (_, i) => {
    const height = length - 1 - i
    return {
      block: `${prefix}${height}`,
      height,
      numberOfTransactions: withTx.includes(height) ? 1 : 0,
    } as Block
  })

/**
 * A node over `blocks` that, like the real one, returns at most a hundred per call and
 * a `nextIndex` until the bottom of the chain. With `maxTransactions` it also stops a
 * page once its blocks hold that many transactions, as signum-node#1084 does, always
 * returning at least one block.
 */
const node = (blocks: Block[], maxTransactions = Infinity) => {
  const calls: number[] = []
  const ranges: Array<[number, number]> = []
  const fetchRange = async (first: number, last: number) => {
    calls.push(first)
    ranges.push([first, last])
    const range = blocks.slice(first, Math.min(last, first + BLOCKS_PER_REQUEST - 1) + 1)
    const page: Block[] = []
    let transactions = 0
    for (const block of range) {
      if (page.length > 0 && transactions >= maxTransactions) break
      page.push(block)
      transactions += block.numberOfTransactions
    }
    const asked = Math.min(last - first + 1, BLOCKS_PER_REQUEST)
    const nextIndex = page.length < range.length || range.length === asked ? first + page.length : undefined
    return { blocks: page, nextIndex }
  }
  return { fetchRange, calls, ranges }
}

/** A chain of `length` blocks, tip first, each holding `perBlock` transactions. */
const busyChain = (length: number, perBlock: number): Block[] =>
  chain(length).map((block) => ({ ...block, numberOfTransactions: perBlock }))

const target = { minBlocks: 50, minTransactions: 2 }

describe('walkBack', () => {
  it('walks back past empty blocks to the last transactions', async () => {
    const { fetchRange } = node(chain(1068, [394, 200]))
    const walked = await walkBack(fetchRange, [], target)
    expect(walked.at(-1)?.height).toBe(200)
  })

  it('stops at genesis when the chain has fewer transactions than wanted', async () => {
    const { fetchRange } = node(chain(250, [10]))
    const walked = await walkBack(fetchRange, [], target)
    expect(walked).toHaveLength(250)
  })

  it('keeps at least the window at the tip on a busy chain', async () => {
    const { fetchRange } = node(chain(300, [299, 298, 297]))
    const walked = await walkBack(fetchRange, [], target)
    expect(walked).toHaveLength(50)
  })

  it('reuses the last walk, so a new block costs one request', async () => {
    const first = await walkBack(node(chain(1068, [394, 200])).fetchRange, [], target)
    const { fetchRange, calls } = node(chain(1069, [394, 200]))
    const walked = await walkBack(fetchRange, first, target)
    expect(calls).toEqual([0])
    expect(walked[0].height).toBe(1068)
    expect(walked.at(-1)?.height).toBe(200)
  })

  it('trims what it reused once a newer transaction fills the target', async () => {
    const first = await walkBack(node(chain(1068, [394, 200])).fetchRange, [], target)
    const walked = await walkBack(node(chain(1069, [1068, 394, 200])).fetchRange, first, target)
    expect(walked.at(-1)?.height).toBe(394)
  })

  it('starts over when the same heights now belong to other blocks', async () => {
    const first = await walkBack(node(chain(1068, [394, 200])).fetchRange, [], target)
    const fresh = chain(120, [5], 'n')
    const walked = await walkBack(node(fresh).fetchRange, first, target)
    expect(walked).toEqual(fresh)
  })

  it('asks only for a few blocks first when it can splice onto the last walk', async () => {
    const first = await walkBack(node(chain(1068, [394, 200])).fetchRange, [], target)
    const { fetchRange, ranges } = node(chain(1069, [394, 200]))
    await walkBack(fetchRange, first, target)
    expect(ranges).toEqual([[0, PROBE_SIZE - 1]])
  })

  it('walks on from the probe when more blocks than it covers are new', async () => {
    const first = await walkBack(node(chain(1068, [394, 200])).fetchRange, [], target)
    const { fetchRange, calls } = node(chain(1068 + 25, [394, 200]))
    const walked = await walkBack(fetchRange, first, target)
    expect(calls).toEqual([0, PROBE_SIZE])
    expect(walked[0].height).toBe(1092)
    expect(walked.at(-1)?.height).toBe(200)
  })

  it('follows nextIndex past a page the node cut short, instead of taking it for genesis', async () => {
    const { fetchRange, calls } = node(busyChain(300, 40), 100)
    const walked = await walkBack(fetchRange, [], { minBlocks: 10, minTransactions: 1 })
    // three blocks of 40 reach the node's budget of 100, so each page holds three
    expect(calls).toEqual([0, 3, 6, 9])
    expect(walked).toHaveLength(10)
  })

  it('stops at genesis when the last page is cut short and nothing follows', async () => {
    const { fetchRange } = node(busyChain(5, 40), 100)
    const walked = await walkBack(fetchRange, [], { minBlocks: 50, minTransactions: 1 })
    expect(walked.map((b) => b.height)).toEqual([4, 3, 2, 1, 0])
  })

  it('stops when the node answers with an empty page despite a nextIndex', async () => {
    const fetchRange = async () => ({ blocks: [], nextIndex: 5 })
    const walked = await walkBack(fetchRange, [], target)
    expect(walked).toEqual([])
  })

  it('follows a rewind, dropping the blocks above the new tip', async () => {
    const first = await walkBack(node(chain(1068, [394, 200])).fetchRange, [], target)
    const walked = await walkBack(node(chain(1000, [394, 200])).fetchRange, first, target)
    expect(walked[0].height).toBe(999)
    expect(walked.at(-1)?.height).toBe(200)
  })
})

describe('fetchFullRange', () => {
  it('returns the whole range in one request when the node does not cut it short', async () => {
    const blocks = chain(200)
    const { fetchRange, calls } = node(blocks)
    expect(await fetchFullRange(fetchRange, 50, 99)).toEqual(blocks.slice(50, 100))
    expect(calls).toEqual([50])
  })

  it('completes a page the node cut short from nextIndex', async () => {
    const blocks = busyChain(200, 40)
    const { fetchRange, calls } = node(blocks, 100)
    expect(await fetchFullRange(fetchRange, 50, 59)).toEqual(blocks.slice(50, 60))
    expect(calls).toEqual([50, 53, 56, 59])
  })

  it('returns fewer blocks at the bottom of the chain', async () => {
    const blocks = chain(70)
    expect(await fetchFullRange(node(blocks).fetchRange, 50, 99)).toEqual(blocks.slice(50))
  })

  it('stops on an empty page despite a nextIndex', async () => {
    const fetchRange = async () => ({ blocks: [], nextIndex: 7 })
    expect(await fetchFullRange(fetchRange, 0, 49)).toEqual([])
  })
})

describe('withLookups', () => {
  it('adds a looked-up transaction the stream does not hold', () => {
    const items = mergeFeed([], [tx('c1', 1, 1, 900)])
    const old = { ...tx('c0', 1, 1, 394), block: 'b394' } as FeedTransaction
    const merged = withLookups(items, [old])
    expect(merged.map((m) => m.id)).toEqual(['c1', 'c0'])
    expect(merged[1].confirmed).toBe(true)
  })

  it('does not duplicate one it already holds', () => {
    const items = mergeFeed([], [tx('c1', 1, 1, 900)])
    expect(withLookups(items, [tx('c1', 1, 1, 900)])).toBe(items)
  })

  it('keeps a transaction two looked-up accounts share once, newest block first', () => {
    const items = mergeFeed([], [tx('c9', 1, 1, 900)])
    const merged = withLookups(items, [tx('a', 1, 1, 100), tx('b', 1, 1, 300), tx('a', 1, 1, 100)])
    expect(merged.map((m) => m.id)).toEqual(['c9', 'b', 'a'])
  })
})
