import { describe, expect, it } from 'vitest'
import type { Block } from '@signumjs/core'
import {
  BLOCKS_PER_REQUEST,
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

/** A node over `blocks` that, like the real one, returns at most a hundred per call. */
const node = (blocks: Block[]) => {
  const calls: number[] = []
  const fetchRange = async (first: number, last: number) => {
    calls.push(first)
    return blocks.slice(first, Math.min(last, first + BLOCKS_PER_REQUEST - 1) + 1)
  }
  return { fetchRange, calls }
}

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

  it('follows a rewind, dropping the blocks above the new tip', async () => {
    const first = await walkBack(node(chain(1068, [394, 200])).fetchRange, [], target)
    const walked = await walkBack(node(chain(1000, [394, 200])).fetchRange, first, target)
    expect(walked[0].height).toBe(999)
    expect(walked.at(-1)?.height).toBe(200)
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
