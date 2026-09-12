import type { Transaction } from '@signumjs/core'

export type FeedTransaction = Transaction

export interface FeedItem {
  id: string
  confirmed: boolean
  tx: FeedTransaction
}

const newestFirst = (a: FeedTransaction, b: FeedTransaction) => b.timestamp - a.timestamp

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
    ...[...confirmed].sort(newestFirst).map((tx) => ({ id: tx.transaction, confirmed: true, tx })),
  ]
}
