/**
 * The queries a new block can invalidate — one list, so adding a query means
 * deciding here whether the chain can change its answer.
 *
 * It exists because the alternative was a handful of invalidate calls that
 * drifted: the paginated block list, the watched account and everything an
 * expanded account row loads were all left stale on a new block, each for the
 * same reason — whoever added the query did not know this list existed.
 *
 * Deliberately not everything. `networkInfo` is fixed for the life of a node,
 * an `asset`'s name and decimals never change, a `contract`'s activation amount is fixed at deployment, a decrypted message stays
 * decrypted, and `accountsWithName` answers a question about a name the user
 * typed rather than about the chain's latest state. The contract inspector
 * reads the same contract under `contractState`, which does change with
 * every block it runs in.
 */
export const STALE_ON_BLOCK = [
  'blockchainStatus',
  'blocks',
  'blockPage',
  'balance',
  'account',
  'accountTransactions',
  'accountSubscriptions',
  'sentBy',
  'receivedBy',
  'aliases',
  'assetsByOwner',
  // An id looked up while unconfirmed gains its block, and a height looked up
  // ahead of the tip comes into existence.
  'txLookup',
  'blockLookup',
  // What the contract inspector shows: the whole contract (balance, flags,
  // data stack) and whichever map entries are open.
  'contractState',
  'contractMap',
] as const

/** The unconfirmed pool changes on a pending transaction as well as a block. */
export const STALE_ON_PENDING = ['unconfirmed'] as const
