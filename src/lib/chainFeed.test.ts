import { describe, expect, it } from 'vitest'
import { mergeFeed, type FeedTransaction } from './chainFeed'

const tx = (id: string, timestamp: number, confirmations?: number): FeedTransaction =>
  ({ transaction: id, timestamp, confirmations }) as FeedTransaction

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
})
