import type { Block, Transaction } from '@signumjs/core'
import type { SandboxAccount } from './accounts'
import type { Contacts } from './contacts'
import { toComparableId } from './recipient'

export type Query =
  | { kind: 'none' }
  | { kind: 'height'; height: number }
  | { kind: 'id'; value: string }
  | { kind: 'address'; value: string }
  | { kind: 'name'; value: string }

/**
 * A block height and an account id are both digits, so length decides: a
 * sandbox chain will not reach ten digits, and no Signum id is shorter.
 */
const ID_DIGITS = 10

/** One input, read differently depending on what it looks like. No syntax to learn. */
export function interpret(input: string): Query {
  const value = input.trim()
  if (!value) return { kind: 'none' }
  if (/^\d+$/.test(value)) {
    return value.length >= ID_DIGITS
      ? { kind: 'id', value }
      : { kind: 'height', height: Number(value) }
  }
  if (/^[A-Za-z]{1,4}-[A-Za-z0-9-]+$/.test(value)) return { kind: 'address', value }
  return { kind: 'name', value: value.toLowerCase() }
}

/**
 * A query plus the accounts it points at, resolved once instead of per row.
 *
 * Both an address and a name ultimately mean "this account", so the matchers
 * only ever compare numeric ids and never have to care which spelling was
 * typed or where the name came from.
 */
export interface ResolvedQuery {
  query: Query
  accountIds: ReadonlySet<string>
}

const NO_IDS: ReadonlySet<string> = new Set()

/**
 * Account ids the names the user can actually see resolve to — their own
 * accounts and their contacts — matched as substrings, the way the account
 * list filters. The node's own `getAccountsWithName` answers exact matches
 * only, so its result is merged in by the caller rather than derived here.
 */
export function localNameMatches(
  value: string,
  accounts: SandboxAccount[],
  contacts: Contacts,
): string[] {
  const needle = value.toLowerCase()
  return [
    ...new Set([
      ...accounts.filter((a) => a.name.toLowerCase().includes(needle)).map((a) => a.id),
      ...Object.entries(contacts)
        .filter(([, name]) => name.toLowerCase().includes(needle))
        .map(([id]) => id),
    ]),
  ]
}

/**
 * `nodeNameMatches` are the ids `getAccountsWithName` returned, which the
 * caller fetches only for a name query — see useNameLookup.
 */
export function resolveQuery(
  query: Query,
  accounts: SandboxAccount[],
  contacts: Contacts,
  nodeNameMatches: string[] = [],
): ResolvedQuery {
  if (query.kind === 'address') {
    return { query, accountIds: new Set([toComparableId(query.value)]) }
  }
  if (query.kind === 'name') {
    return {
      query,
      accountIds: new Set([
        ...localNameMatches(query.value, accounts, contacts),
        ...nodeNameMatches,
      ]),
    }
  }
  return { query, accountIds: NO_IDS }
}

/** A resolved query that filters nothing, for callers that have none. */
export const NO_QUERY: ResolvedQuery = { query: { kind: 'none' }, accountIds: NO_IDS }

/**
 * The predicate both the owned-accounts list and the contact book filter
 * through, so the one search field behaves the same way over both: a name
 * query matches case-insensitively as a substring, an address query matches
 * exactly (nobody types half an address), and every other kind — height, id,
 * or no query at all — doesn't apply to an account-shaped row, so it passes
 * everything rather than hiding rows a height or transaction id query was
 * never meant to filter.
 */
export function matchesAccountQuery(name: string, address: string, query: Query): boolean {
  if (query.kind === 'name') return name.toLowerCase().includes(query.value)
  if (query.kind === 'address') return address === query.value
  return true
}

export function matchesTransaction(tx: Transaction, resolved: ResolvedQuery): boolean {
  const { query, accountIds } = resolved
  switch (query.kind) {
    case 'none':
      return true
    case 'height':
      return tx.height === query.height
    case 'id':
      return tx.transaction === query.value
    case 'address':
      return party(tx, accountIds)
    case 'name':
      // A name reaches two different things: an account, and the free text a
      // token or alias carries in its attachment. Both are names the user saw
      // on screen, so both should be findable by typing what they read.
      return party(tx, accountIds) || attachmentMentions(tx, query.value)
  }
}

const party = (tx: Transaction, ids: ReadonlySet<string>) =>
  ids.has(tx.sender) || (tx.recipient !== undefined && ids.has(tx.recipient))

const attachmentMentions = (tx: Transaction, needle: string) =>
  JSON.stringify(tx.attachment ?? {})
    .toLowerCase()
    .includes(needle)

/**
 * A block is a container with one account attached to it — its forger — so an
 * address or a name filters the list to the blocks that account produced. An
 * id means the block's own id here rather than a transaction's: on this tab
 * that is the only id a block has of its own.
 */
export function matchesBlock(block: Block, resolved: ResolvedQuery): boolean {
  const { query, accountIds } = resolved
  switch (query.kind) {
    case 'none':
      return true
    case 'height':
      return block.height === query.height
    case 'id':
      return block.block === query.value
    case 'address':
    case 'name':
      return accountIds.has(block.generator)
  }
}
